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

    // Add full-screen control
    L.control.fullscreen({
        position: 'topleft', // Position the button next to zoom controls
        title: {
            false: 'Layar Penuh', // Tooltip for entering fullscreen
            true: 'Keluar Layar Penuh' // Tooltip for exiting fullscreen
                },
        forceSeparateButton: true, // Ensure it's a separate button
        fullscreenElement: false // Use the entire map container for fullscreen
    ).addTo(map);
    
    // Customize the fullscreen button with SVG icons
    const fullscreenControl = document.querySelector('.leaflet-control-fullscreen a');
    if (fullscreenControl) {
        // Set the initial icon (enter fullscreen)
        fullscreenControl.innerHTML = '<img src="/assets/fullscreen-enter.svg" alt="Enter Fullscreen" style="width: 16px; height: 16px;">';
        // Update the icon when the fullscreen state changes
        map.on('enterFullscreen', () => {
            fullscreenControl.innerHTML = '<img src="/assets/fullscreen-exit.svg" alt="Exit Fullscreen" style="width: 16px; height: 16px;">';
        });
        map.on('exitFullscreen', () => {
            fullscreenControl.innerHTML = '<img src="/assets/fullscreen-enter.svg" alt="Enter Fullscreen" style="width: 16px; height: 16px;">';
        });
    }
}

// Initialize the map when page loads
window.onload = initMap;
