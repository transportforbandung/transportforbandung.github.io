// Initialize the map
function initMap() {
    const API_KEY = 'cajvPScYRyeaWL7RvReS';
    const STYLE_ID = '7cd7cac8-4971-44d1-952b-c04bc40da410'; // From MapTiler Cloud

    // MapTiler Cloud endpoint
    const mapTilerUrl = `https://api.maptiler.com/maps/${TYLE_ID}/style.json?key=${API_KEY}`;

    // Create map
    const map = L.map('map').setView([48.2082, 16.3738], 4); // Default center (Vienna)

    // Add MapTiler base layer
    L.tileLayer(`https://api.maptiler.com/maps/{styleId}/tiles/{z}/{x}/{y}.png?key=${API_KEY}`, {
        attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
        styleId: STYLE_ID,
        tileSize: 512,
        zoomOffset: -1,
        maxZoom: 18
    }).addTo(map);

// Initialize the map when page loads
window.onload = initMap;
