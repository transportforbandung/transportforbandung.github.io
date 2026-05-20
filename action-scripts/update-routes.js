const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { mkdirp } = require('mkdirp');

// ── Overpass endpoints (rotated to avoid rate limiting) ────────────────────
// Ways query  → Private Coffee
// Stops query → Kumi Systems
// Neither instance sees two consecutive requests from this runner.
const OVERPASS_WAYS  = 'https://overpass.private.coffee/api/interpreter';
const OVERPASS_STOPS = 'https://overpass.kumi.systems/api/interpreter';

// ── Route data loader ──────────────────────────────────────────────────────
function loadRouteData() {
  const routesPath = path.join(__dirname, '..', 'route-data', 'routes.json');
  try {
    const fileContent = fs.readFileSync(routesPath, 'utf-8');
    const routesData = JSON.parse(fileContent);

    const allRoutes = routesData.categories.flatMap(category => category.routes);
    if (!Array.isArray(allRoutes)) {
      throw new Error('No routes found in categories array');
    }

    const validatedRoutes = allRoutes.map((route, index) => {
      if (!route.relationId) {
        throw new Error(`Route at index ${index} is missing relationId`);
      }
      if (!route.type) {
        throw new Error(`Route at index ${index} is missing type`);
      }
      if (!['ways_with_points', 'ways'].includes(route.type)) {
        throw new Error(`Route at index ${index} has invalid type: ${route.type}`);
      }
      return {
        relationId: route.relationId.toString(),
        type: route.type
      };
    });

    // Remove duplicate relation IDs
    return [...new Map(validatedRoutes.map(r => [r.relationId, r])).values()];
  } catch (error) {
    console.error('Failed to load route data:', error.message);
    process.exit(1);
  }
}

const uniqueRoutes = loadRouteData();
console.log(`Loaded ${uniqueRoutes.length} valid routes`);

// ── Overpass query with retry logic ───────────────────────────────────────
// endpoint: which Overpass mirror to use
// retries:  number of attempts before giving up
// delay:    base delay in ms between retries (multiplied by attempt number)
async function overpassQuery(query, endpoint, retries = 3, delay = 10000) {
  const url = `${endpoint}?data=${encodeURIComponent(query)}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`  Retrying query (attempt ${attempt}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, delay * (attempt - 1)));
      }
      const response = await axios.get(url, { timeout: 30000 });
      return response.data.elements;
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`Overpass query failed after ${retries} attempts: ${error.message}`);
      }
    }
  }
}

// ── GeoJSON builders ───────────────────────────────────────────────────────

// processWays: takes the combined elements array returned by the ways query
// (contains one relation element + multiple way elements). Extracts member
// order from the relation, then maps ways in that sequence.
function processWays(elements) {
  const relation = elements.find(el => el.type === 'relation');
  if (!relation) {
    console.warn('  Warning: no relation element found in ways response');
    return { type: 'FeatureCollection', features: [] };
  }

  // Ordered way IDs from relation members; exclude platform ways
  const orderedIds = relation.members
    .filter(m => m.type === 'way' && m.role !== 'platform')
    .map(m => m.ref);

  // Lookup map: way ID → element (geometry + tags)
  const wayMap = new Map(
    elements
      .filter(el => el.type === 'way')
      .map(way => [way.id, way])
  );

  const features = orderedIds
    .map(id => wayMap.get(id))
    .filter(Boolean)
    .map(way => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: way.geometry.map(coord => [coord.lon, coord.lat])
      },
      properties: {
        id: way.id,
        ...way.tags
      }
    }));

  return { type: 'FeatureCollection', features };
}

// processNodes: converts Overpass node elements to GeoJSON points
function processNodes(elements) {
  const features = elements
    .filter(el => el.type === 'node')
    .map(node => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [node.lon, node.lat]
      },
      properties: {
        id: node.id,
        ...node.tags
      }
    }));

  return { type: 'FeatureCollection', features };
}

// ── Single route processor ─────────────────────────────────────────────────
async function processRoute(route) {
  const { relationId, type } = route;
  const dir = path.join(__dirname, '..', 'route-data', 'geojson', relationId);

  try {
    await mkdirp(dir);
    console.log(`Processing route ${relationId} (${type})...`);

    // ── Ways (Private Coffee) ────────────────────────────────────────────
    // Combined query: relation out (for member order) + way(r) out geom tags
    // (for geometry and OSM tags). Both come back in one elements array which
    // processWays() joins by relation member sequence.
    await new Promise(resolve => setTimeout(resolve, 3000));

    const waysQuery = `[out:json];
relation(${relationId});
out;
way(r);
out geom tags;`;

    const waysElements = await overpassQuery(waysQuery, OVERPASS_WAYS);
    const waysGeoJSON  = processWays(waysElements);

    const relation    = waysElements.find(el => el.type === 'relation');
    const orderedCount = (relation?.members || [])
      .filter(m => m.type === 'way' && m.role !== 'platform').length;
    console.log(`  → ${waysGeoJSON.features.length}/${orderedCount} ordered ways written to ways.geojson`);

    fs.writeFileSync(
      path.join(dir, 'ways.geojson'),
      JSON.stringify(waysGeoJSON, null, 2)
    );

    // ── Stops (Kumi Systems) ─────────────────────────────────────────────
    // Separate endpoint so neither mirror gets two back-to-back requests.
    // ways_with_points: fetch stop + stop_entry_only + stop_exit_only nodes
    // ways:            fetch only stop_entry_only + stop_exit_only nodes
    await new Promise(resolve => setTimeout(resolve, 3000));

    const stopsQuery = type === 'ways_with_points'
      ? `[out:json];relation(${relationId});node(r:"stop");out geom;relation(${relationId});node(r:"stop_entry_only");out geom;relation(${relationId});node(r:"stop_exit_only");out geom;`
      : `[out:json];relation(${relationId});node(r:"stop_entry_only");out geom;relation(${relationId});node(r:"stop_exit_only");out geom;`;

    const stopsData   = await overpassQuery(stopsQuery, OVERPASS_STOPS);
    const stopsGeoJSON = processNodes(stopsData);

    const fileName = type === 'ways_with_points' ? 'stops.geojson' : 'endstops.geojson';
    fs.writeFileSync(
      path.join(dir, fileName),
      JSON.stringify(stopsGeoJSON, null, 2)
    );

    console.log(`  → ${stopsGeoJSON.features.length} stops written to ${fileName}`);
    console.log(`Successfully processed route ${relationId}`);
  } catch (error) {
    console.error(`Failed to process route ${relationId}:`, error.message);
    throw error;
  }
}

// ── Main execution ─────────────────────────────────────────────────────────
(async () => {
  try {
    for (const route of uniqueRoutes) {
      let attempts = 3;
      let success  = false;

      while (attempts > 0 && !success) {
        try {
          await processRoute(route);
          success = true;
        } catch (error) {
          attempts--;
          if (attempts === 0) {
            console.error(`Giving up on route ${route.relationId} after 3 attempts`);
          } else {
            console.log(`Will retry route ${route.relationId} (${attempts} attempts remaining)`);
          }
        }
      }
    }
    console.log('All routes processed successfully!');
  } catch (error) {
    console.error('Fatal error in main execution:', error.message);
    process.exit(1);
  }
})();
