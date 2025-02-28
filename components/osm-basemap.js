// osm-basemap.js
// Declare map and routeLayer globally
let map;
let routeLayer;

// Initialize the map
function initMap() {
    // Create map
    map = L.map('map').setView([-6.9104, 107.6183], 12);

    // Add OpenStreetMap base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Initialize routeLayer and add it to the map
    routeLayer = L.layerGroup().addTo(map);
}

// Initialize the map when page loads
window.onload = initMap;
