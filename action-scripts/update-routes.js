// update-routes.js to fetch route data from OSM via Overpass and write to route-data/osm and route-data/geojson

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { mkdirp } = require('mkdirp');

const ROOT = path.join(__dirname, '..');
const OVERPASS_URL = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';
const PAUSE_BETWEEN_ROUTES_MS = 1500; // be polite to the Overpass mirror

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
async function overpassQuery(query, retries = 3, delay = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`  retrying (attempt ${attempt}/${retries})...`);
        await sleep(delay * (attempt - 1));
      }
      const response = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(query)}`, {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TransportForBandung-route-update/2.0 (+https://transportforbandung.org)'
        }
      });
      if (!response.data || !Array.isArray(response.data.elements)) {
        throw new Error('Unexpected Overpass response');
      }
      return response.data;
    } catch (error) {
      if (attempt === retries) throw new Error(`Overpass failed after ${retries} attempts: ${error.message}`);
    }
  }
}

// relation (tags + ordered members with roles), its ways (tags + node ids + geometry),
// and its member nodes (tags + coordinates), in a single request.
function routeQuery(relationId) {
  return `[out:json][timeout:60];
relation(${relationId});
out body;
way(r);
out geom;
node(r);
out body;`;
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

// ---------- process one route ----------
async function processRoute({ relationId, type }) {
  const raw = await overpassQuery(routeQuery(relationId));
  const { waysGeoJSON, stopsGeoJSON } = deriveGeojson(raw, relationId, type);

  const osmDir = path.join(ROOT, 'route-data', 'osm');
  const geoDir = path.join(ROOT, 'route-data', 'geojson', relationId);
  await mkdirp(osmDir);
  await mkdirp(geoDir);

  fs.writeFileSync(path.join(osmDir, `${relationId}.json`), serializeRaw(raw));
  fs.writeFileSync(path.join(geoDir, 'ways.geojson'), JSON.stringify(waysGeoJSON, null, 2));
  const stopsName = type === 'ways_with_points' ? 'stops.geojson' : 'endstops.geojson';
  fs.writeFileSync(path.join(geoDir, stopsName), JSON.stringify(stopsGeoJSON, null, 2));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- main ----------
if (require.main === module) {
  (async () => {
    const routes = loadRouteData();
    console.log(`Loaded ${routes.length} routes`);
    const failed = [];

    for (const route of routes) {
      console.log(`Processing ${route.relationId} (${route.type})`);
      try {
        await processRoute(route);
      } catch (error) {
        console.error(`  FAILED ${route.relationId}: ${error.message} (previous files kept)`);
        failed.push(route.relationId);
      }
      await sleep(PAUSE_BETWEEN_ROUTES_MS);
    }

    console.log(`Done: ${routes.length - failed.length} updated, ${failed.length} failed`);
    if (failed.length) console.log(`Failed: ${failed.join(', ')}`);
    if (failed.length === routes.length) process.exit(1);
  })();
}

module.exports = { deriveGeojson, serializeRaw, routeQuery };