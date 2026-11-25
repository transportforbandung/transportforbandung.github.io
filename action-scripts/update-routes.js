// update-routes.js to fetch route data from OSM via Overpass and write to route-data/osm and route-data/geojson

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { mkdirp } = require('mkdirp');

const ROOT = path.join(__dirname, '..');
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const REPORT_PATH = path.join(ROOT, 'route-data', 'update-report.json');

const MAX_STRIKES = 3;               // attempts per route
const RETRY_AFTER_SUCCESSES = 3;     // other routes that must succeed before a retry
const PAUSE_BETWEEN_ROUTES_MS = 1500;
const COOLDOWN_AFTER_OVERLOAD_MS = 30000;   // after HTTP 429/503/504 or a server timeout
const DRAIN_PAUSE_MS = [30000, 60000];      // waits before retries when no fresh routes are left

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- load routes.json ----------
function loadRouteData() {
  const routesPath = path.join(ROOT, 'route-data', 'routes.json');
  const routesData = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
  const allRoutes = routesData.categories.flatMap(category => category.routes);

  const validated = allRoutes.map((route, index) => {
    if (!route.relationId) throw new Error(`Route at index ${index} is missing relationId`);
    if (!['ways_with_points', 'ways'].includes(route.type)) {
      throw new Error(`Route at index ${index} has invalid type: ${route.type}`);
    }
    return { relationId: route.relationId.toString(), type: route.type };
  });

  return [...new Map(validated.map(r => [r.relationId, r])).values()];
}

// ---------- Overpass ----------
class OverpassError extends Error {
  constructor(message, overloaded = false) {
    super(message);
    this.overloaded = overloaded;
  }
}

// relation (tags + ordered members with roles), its ways (tags + node ids + geometry),
// and its member nodes (tags + coordinates), in a single request.
function routeQuery(relationId) {
  return `[out:json][timeout:90];
relation(${relationId});
out body;
way(r);
out geom;
node(r);
out body;`;
}

// One request = one attempt. Retrying is handled by the strike queue, not here,
// so a struggling server is not hit again immediately.
async function fetchRaw(relationId) {
  let response;
  try {
    response = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(routeQuery(relationId))}`, {
      timeout: 120000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TransportForBandung-route-update/2.0 (+https://transportforbandung.org)'
      }
    });
  } catch (error) {
    const status = error.response && error.response.status;
    const overloaded = [429, 502, 503, 504].includes(status) || error.code === 'ECONNABORTED';
    throw new OverpassError(status ? `HTTP ${status}` : error.message, overloaded);
  }
  return response.data;
}

// Reject anything incomplete before a single file is written.
function checkComplete(raw, relationId) {
  if (!raw || !Array.isArray(raw.elements)) throw new OverpassError('response has no elements');
  if (raw.remark && /error|timed out|out of memory/i.test(raw.remark)) {
    throw new OverpassError(`Overpass remark: ${raw.remark.trim().slice(0, 160)}`, true);
  }
  const relation = raw.elements.find(e => e.type === 'relation' && String(e.id) === String(relationId));
  if (!relation) throw new OverpassError('relation missing from response');
  if (!Array.isArray(relation.members) || relation.members.length === 0) {
    throw new OverpassError('relation has no members');
  }

  const ways = new Map(raw.elements.filter(e => e.type === 'way').map(w => [w.id, w]));
  const nodes = new Set(raw.elements.filter(e => e.type === 'node').map(n => n.id));
  const missingWays = relation.members.filter(m => m.type === 'way').filter(m => {
    const w = ways.get(m.ref);
    return !w || !Array.isArray(w.geometry) || w.geometry.length < 2;
  });
  const missingNodes = relation.members.filter(m => m.type === 'node' && !nodes.has(m.ref));
  if (missingWays.length || missingNodes.length) {
    throw new OverpassError(`incomplete: ${missingWays.length} member ways, ${missingNodes.length} member nodes missing`);
  }
  return relation;
}

// ---------- derive the old GeoJSON files from the raw response ----------
function deriveGeojson(raw, relationId, type) {
  const els = raw.elements;
  const relation = els.find(e => e.type === 'relation' && String(e.id) === String(relationId));
  if (!relation) throw new Error(`Relation ${relationId} missing from response`);

  const ways = els.filter(e => e.type === 'way' && Array.isArray(e.geometry)).sort((a, b) => a.id - b.id);
  const nodes = new Map(els.filter(e => e.type === 'node').map(n => [n.id, n]));

  const waysGeoJSON = {
    type: 'FeatureCollection',
    features: ways.map(way => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: way.geometry.map(c => [c.lon, c.lat]) },
      properties: { id: way.id, ...way.tags }
    }))
  };

  // Same order as the old three-query output: each role group sorted by id.
  const nodesWithRole = role => {
    const ids = [...new Set(relation.members
      .filter(m => m.type === 'node' && m.role === role)
      .map(m => m.ref))];
    return ids.map(id => nodes.get(id)).filter(Boolean).sort((a, b) => a.id - b.id);
  };
  const roles = type === 'ways_with_points'
    ? ['stop', 'stop_entry_only', 'stop_exit_only']
    : ['stop_entry_only', 'stop_exit_only'];

  const stopsGeoJSON = {
    type: 'FeatureCollection',
    features: roles.flatMap(nodesWithRole).map(node => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [node.lon, node.lat] },
      properties: { id: node.id, ...node.tags }
    }))
  };

  return { waysGeoJSON, stopsGeoJSON };
}

// One element per line: small, readable git diffs between weekly runs.
function serializeRaw(raw) {
  const header = {
    version: raw.version,
    generator: raw.generator,
    timestamp_osm_base: raw.osm3s && raw.osm3s.timestamp_osm_base
  };
  return `{"meta":${JSON.stringify(header)},"elements":[\n` +
    raw.elements.map(e => JSON.stringify(e)).join(',\n') +
    '\n]}\n';
}

// ---------- process one route (one attempt) ----------
async function processRoute({ relationId, type }, deps = {}) {
  const fetch = deps.fetchRaw || fetchRaw;
  const raw = await fetch(relationId);
  checkComplete(raw, relationId);
  const { waysGeoJSON, stopsGeoJSON } = deriveGeojson(raw, relationId, type);
  if (deps.write) return deps.write(relationId, type, raw, waysGeoJSON, stopsGeoJSON);

  const osmDir = path.join(ROOT, 'route-data', 'osm');
  const geoDir = path.join(ROOT, 'route-data', 'geojson', relationId);
  await mkdirp(osmDir);
  await mkdirp(geoDir);

  fs.writeFileSync(path.join(osmDir, `${relationId}.json`), serializeRaw(raw));
  fs.writeFileSync(path.join(geoDir, 'ways.geojson'), JSON.stringify(waysGeoJSON, null, 2));
  const stopsName = type === 'ways_with_points' ? 'stops.geojson' : 'endstops.geojson';
  fs.writeFileSync(path.join(geoDir, stopsName), JSON.stringify(stopsGeoJSON, null, 2));
}

// ---------- the strike queue ----------
// Fresh routes run in order. A route that fails goes to the back of the retry
// queue, stamped with the success count at that moment. It is taken again once
// RETRY_AFTER_SUCCESSES more routes have succeeded. When no fresh routes are
// left, the remaining retries run after a pause. Three failures = give up.
async function runAll(routes, deps = {}) {
  const attempt = deps.attempt || (route => processRoute(route));
  const wait = deps.sleep || sleep;
  const log = deps.log || console.log;

  const fresh = [...routes];
  const retries = [];               // { route, strikes, errors, successesAtFail }
  const updated = [];
  const recovered = [];             // succeeded after at least one strike
  const failed = [];                // gave up after MAX_STRIKES
  let successes = 0;
  let drainRound = 0;

  while (fresh.length || retries.length) {
    let item;
    const due = retries.length && successes - retries[0].successesAtFail >= RETRY_AFTER_SUCCESSES;

    if (due) {
      item = retries.shift();
    } else if (fresh.length) {
      item = { route: fresh.shift(), strikes: 0, errors: [] };
    } else {
      // Only retries left and not enough successes to wait for: pause instead.
      const pause = DRAIN_PAUSE_MS[Math.min(drainRound, DRAIN_PAUSE_MS.length - 1)];
      drainRound++;
      log(`No fresh routes left; waiting ${pause / 1000}s before retrying ${retries.length} route(s)`);
      await wait(pause);
      item = retries.shift();
    }

    const { relationId } = item.route;
    const label = item.strikes ? ` (attempt ${item.strikes + 1}/${MAX_STRIKES})` : '';
    log(`Processing ${relationId}${label}`);

    try {
      await attempt(item.route);
      successes++;
      updated.push(relationId);
      if (item.strikes) recovered.push({ relationId, attempts: item.strikes + 1 });
    } catch (error) {
      item.strikes++;
      item.errors.push(error.message);
      if (item.strikes >= MAX_STRIKES) {
        log(`  GAVE UP ${relationId} after ${MAX_STRIKES} attempts: ${error.message} (previous files kept)`);
        failed.push({ relationId, errors: item.errors });
      } else {
        log(`  failed ${relationId}: ${error.message}; will retry after ${RETRY_AFTER_SUCCESSES} more successes`);
        item.successesAtFail = successes;
        retries.push(item);
      }
      if (error.overloaded) {
        log(`  server overloaded; cooling down ${COOLDOWN_AFTER_OVERLOAD_MS / 1000}s`);
        await wait(COOLDOWN_AFTER_OVERLOAD_MS);
      }
    }
    await wait(PAUSE_BETWEEN_ROUTES_MS);
  }

  return { updated, recovered, failed };
}

// Routes that failed last run go first, while the server is fresh.
function orderWithPreviousFailures(routes) {
  let previous = [];
  try {
    previous = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8')).failed.map(f => String(f.relationId));
  } catch { /* no report yet */ }
  const first = routes.filter(r => previous.includes(r.relationId));
  return { ordered: [...first, ...routes.filter(r => !previous.includes(r.relationId))], previous: first.length };
}

// ---------- main ----------
if (require.main === module) {
  (async () => {
    const startedAt = new Date().toISOString();
    const { ordered, previous } = orderWithPreviousFailures(loadRouteData());
    console.log(`Loaded ${ordered.length} routes${previous ? ` (${previous} that failed last run go first)` : ''}`);

    const result = await runAll(ordered);

    const report = {
      startedAt,
      finishedAt: new Date().toISOString(),
      total: ordered.length,
      updated: result.updated.length,
      recoveredAfterRetry: result.recovered,
      failed: result.failed
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');

    console.log(`Done: ${result.updated.length} updated (${result.recovered.length} after retry), ${result.failed.length} failed`);
    if (result.failed.length) console.log(`Failed: ${result.failed.map(f => f.relationId).join(', ')}`);
    if (result.failed.length === ordered.length) process.exit(1);
  })();
}

module.exports = { deriveGeojson, serializeRaw, routeQuery, checkComplete, processRoute, runAll };