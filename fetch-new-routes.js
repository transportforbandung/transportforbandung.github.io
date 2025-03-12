const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const axios = require('axios');
const { mkdirp } = require('mkdirp');

// Load HTML file
const html = fs.readFileSync('peta-dan-panduan.html', 'utf-8');
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

// Overpass API query function with retry logic
async function overpassQuery(query, retries = 3, delay = 2000) {
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise(resolve => setTimeout(resolve, delay)); // Delay between retries
      const response = await axios.get(url, { timeout: 10000 }); // 10-second timeout
      return response.data.elements;
    } catch (error) {
      console.error(`Overpass query failed (attempt ${i + 1}/${retries}):`, error.message);
      if (i === retries - 1) throw error; // Throw error on final retry
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

// Check if a relation already has data
function hasExistingData(relationId) {
  const dir = path.join(__dirname, 'data', relationId);
  if (!fs.existsSync(dir)) return false;

  const requiredFiles = ['ways.geojson', 'stops.geojson', 'endstops.geojson'];
  return requiredFiles.some(file => fs.existsSync(path.join(dir, file)));
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
    ? `[out:json];relation(${relationId});node(r:"stop");out geom;relation(${relationId});node(r:"stop_entry_only");out geom;relation(${relationId});node(r:"stop_exit_only");out geom;`
    : `[out:json];relation(${relationId});node(r:"stop_entry_only");out geom;relation(${relationId});node(r:"stop_exit_only");out geom;`;

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
      // Skip if data already exists
      if (hasExistingData(route.relationId)) {
        console.log(`Skipping relation ${route.relationId}: Data already exists.`);
        continue;
      }

      console.log(`Processing relation ${route.relationId}...`);

      // Retry processing up to 3 times if Overpass query fails
      let retries = 3;
      while (retries > 0) {
        try {
          await processRoute(route);
          break; // Exit retry loop if successful
        } catch (error) {
          console.error(`Error processing ${route.relationId}:`, error.message);
          retries--;
          if (retries === 0) {
            console.error(`Failed to process relation ${route.relationId} after 3 attempts.`);
          } else {
            console.log(`Retrying relation ${route.relationId} (${retries} attempts remaining)...`);
          }
        }
      }
    } catch (error) {
      console.error(`Fatal error processing relation ${route.relationId}:`, error.message);
    }
  }
  console.log('All routes processed!');
})();
