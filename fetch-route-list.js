const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Load HTML file
const html = fs.readFileSync('./peta-dan-panduan.html', 'utf-8');
const $ = cheerio.load(html);

// Extract route information
const routes = [];
$('input[data-relation-id]').each((i, el) => {
  const $input = $(el);
  routes.push({
    relation_id: $input.attr('data-relation-id'),
    display_type: $input.attr('data-display-type'),
    route_color: $input.attr('data-route-color'),
    route_name: $(el).closest('label').text().trim()
  });
});

// Create output directory
const outputDir = path.join(__dirname, 'data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Save to JSON file
fs.writeFileSync(
  path.join(outputDir, 'routes.json'),
  JSON.stringify({ routes }, null, 2)
);

console.log(`Extracted ${routes.length} routes to data/route-list.json`);
