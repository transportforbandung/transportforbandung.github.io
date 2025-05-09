const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { mkdirp } = require('mkdirp');

// Load routes data from JSON
const routesPath = path.join(__dirname, '..', 'data', 'routes.json');
const routesData = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));

// Collect all unique routes with their types
const routes = routesData.map(route => ({
  relationId: route.relationId.toString(),
  type: route.type
}));

// Remove duplicate entries based on relationId
const uniqueRoutes = [...new Map(routes.map(route => [route.relationId, route])).values()];

// Overpass API query function with retry logic
async function overpassQuery(query, retries = 3, delay = 2000) {
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise(resolve => setTimeout(resolve, delay));
      const response = await axios.get(url, { timeout: 10000 });
      return response.data.elements;
    } catch (error) {
      console.error(`Overpass query failed (attempt ${i + 1}/${retries}):`, error.message);
      if (i === retries - 1) throw error;
    }
  }
}

// Process ways into GeoJSON
function processWays(elements) {
  return {
    type: 'FeatureCollection',
    features: elements.filter(el => el.type === 'way').map(way => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: way.geometry.map(coord => [coord.lon, coord.lat])
      },
      properties: { id: way.id, ...way.tags }
    }))
  };
}

// Process nodes into GeoJSON
function processNodes(elements) {
  return {
    type: 'FeatureCollection',
    features: elements.filter(el => el.type === 'node').map(node => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [node.lon, node.lat]
      },
      properties: { id: node.id, ...node.tags }
    }))
  };
}

// Main processing function
async function processRoute({ relationId, type }) {
  const dir = path.join(__dirname, '..', 'data', relationId);
  await mkdirp(dir);

  // Fetch and overwrite ways data
  const waysQuery = `[out:json]; relation(${relationId}); way(r); out geom;`;
  const waysData = await overpassQuery(waysQuery);
  fs.writeFileSync(
    path.join(dir, 'ways.geojson'),
    JSON.stringify(processWays(waysData))
  );

  // Fetch and overwrite stops/endstops data
  const stopsQuery = type === 'ways_with_points' 
    ? `[out:json];relation(${relationId});node(r:"stop");out geom;relation(${relationId});node(r:"stop_entry_only");out geom;relation(${relationId});node(r:"stop_exit_only");out geom;`
    : `[out:json];relation(${relationId});node(r:"stop_entry_only");out geom;relation(${relationId});node(r:"stop_exit_only");out geom;`;

  const stopsData = await overpassQuery(stopsQuery);
  const fileName = type === 'ways_with_points' ? 'stops.geojson' : 'endstops.geojson';
  fs.writeFileSync(
    path.join(dir, fileName),
    JSON.stringify(processNodes(stopsData))
  );
}

// Execute for all routes with retries
(async () => {
  for (const route of uniqueRoutes) {
    let attempts = 3;
    while (attempts > 0) {
      try {
        console.log(`Processing relation ${route.relationId}...`);
        await processRoute(route);
        break;
      } catch (error) {
        attempts--;
        if (attempts === 0) {
          console.error(`Failed to process relation ${route.relationId} after 3 attempts`);
        } else {
          console.log(`Retrying relation ${route.relationId} (${attempts} attempts remaining)...`);
        }
      }
    }
  }
  console.log('All routes processed!');
})();
