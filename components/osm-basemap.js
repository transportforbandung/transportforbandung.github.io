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
    const fullscreenControl = L.control.fullscreen({
        position: 'topleft', // Position the button next to zoom controls
        title: {
            false: 'Layar Penuh', // Tooltip for entering fullscreen
            true: 'Keluar Layar Penuh' // Tooltip for exiting fullscreen
        },
        forceSeparateButton: true, // Ensure it's a separate button
        fullscreenElement: false // Use the entire map container for fullscreen
    }).addTo(map);

    // Wait for the DOM to update before querying the button
    setTimeout(() => {
        // Customize the fullscreen button with local SVG icons
        const fullscreenButton = document.querySelector('a.leaflet-control-zoom-fullscreen.fullscreen-icon');
        if (fullscreenButton) {
            // Set the initial icon (enter fullscreen)
            fullscreenButton.innerHTML = '<img src="https://transportforbandung.org/assets/fullscreen-enter.svg" alt="Enter Fullscreen" class="fullscreen-icon">';

            // Update the icon when the fullscreen state changes
            map.on('enterFullscreen', () => {
                fullscreenButton.innerHTML = '<img src="https://transportforbandung.org/assets/fullscreen-exit.svg" alt="Exit Fullscreen" class="fullscreen-icon">';
            });

            map.on('exitFullscreen', () => {
                fullscreenButton.innerHTML = '<img src="https://transportforbandung.org/assets/fullscreen-enter.svg" alt="Enter Fullscreen" class="fullscreen-icon">';
            });
        } else {
            console.error('Fullscreen button not found!');
        }
    }, 100); // Small delay to ensure the DOM is updated
}

// Initialize the map when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initMap);
