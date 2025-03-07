const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const axios = require('axios');
const mkdirp = require('mkdirp');

// Load your HTML file
const html = fs.readFileSync('./path/to/your/html/file.html', 'utf-8');
const $ = cheerio.load(html);

// Collect all unique routes with display types
const routes = [];
$('input[data-relation-ids], input[data-relation-id]').each((i, el) => {
  const $el = $(el);
  const relationId = $el.attr('data-relation-ids') || $el.attr('data-relation-id');
  const displayType = $el.attr('data-display-type');
  if (relationId) {
    routes.push({ relationId, displayType });
  }
});

// Remove duplicate entries
const uniqueRoutes = [...new Map(routes.map(route => [route.relationId, route])).values()];

// Overpass API query function with delay to avoid rate limiting
async function overpassQuery(query) {
  await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  try {
    const response = await axios.get(url);
    return response.data.elements;
  } catch (error) {
    console.error('Overpass query failed:', error.message);
    return [];
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
async function processRoute({ relationId, displayType }) {
  const dir = path.join(__dirname, 'data', relationId);
  await mkdirp(dir);

  // Fetch and save ways
  const waysQuery = `[out:json]; relation(${relationId}); way(r); out geom;`;
  const waysData = await overpassQuery(waysQuery);
  fs.writeFileSync(
    path.join(dir, 'ways.geojson'),
    JSON.stringify(processWays(waysData))
  );

  // Determine and fetch stops
  const stopsQuery = displayType === 'ways_with_points' 
    ? `[out:json]; relation(${relationId}); node(r:"stop"); node(r:"stop_entry_only"); node(r:"stop_exit_only"); out geom;`
    : `[out:json]; relation(${relationId}); node(r:"stop_entry_only"); node(r:"stop_exit_only"); out geom;`;

  const stopsData = await overpassQuery(stopsQuery);
  const fileName = displayType === 'ways_with_points' ? 'stops.geojson' : 'endstops.geojson';
  fs.writeFileSync(
    path.join(dir, fileName),
    JSON.stringify(processNodes(stopsData))
  );
}

// Execute for all routes
(async () => {
  for (const route of uniqueRoutes) {
    try {
      console.log(`Processing relation ${route.relationId}...`);
      await processRoute(route);
    } catch (error) {
      console.error(`Error processing ${route.relationId}:`, error.message);
    }
  }
  console.log('All routes processed!');
})();
