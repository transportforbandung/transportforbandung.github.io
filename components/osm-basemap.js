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

    // Create the GPS button after the map is initialized
    createGPSButton();
}

// Initialize the map when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initMap);

// Declare a global variable for the user's marker and GPS button
let userMarker;
let gpsButton;

// Function to initialize GPS tracking
function initGPSTracking() {
    // Check if the browser supports Geolocation
    if (!navigator.geolocation) {
        console.error("Geolocation is not supported by your browser.");
        alert("Geolocation is not supported by your browser.");
        return;
    }

    // Create a marker for the user's location
    const userIcon = L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png', // Default Leaflet marker icon
        iconSize: [25, 41], // Size of the icon
        iconAnchor: [12, 41], // Point of the icon that corresponds to the marker's location
    });

    userMarker = L.marker([0, 0], { icon: userIcon }).addTo(map); // Add marker to the map

    // Watch the user's position
    navigator.geolocation.watchPosition(
        (position) => {
            // Success callback: Update the marker's position
            const { latitude, longitude } = position.coords;
            userMarker.setLatLng([latitude, longitude]);

            // Optionally, center the map on the user's location
            map.setView([latitude, longitude], 15); // Zoom level 15
        },
        (error) => {
            // Error callback: Handle errors
            console.error("Error getting location:", error.message);
            alert("Unable to retrieve your location. Please enable location services and try again.");
        },
        {
            enableHighAccuracy: true, // Use high-accuracy mode
            timeout: 5000, // Maximum time to wait for a location (in milliseconds)
            maximumAge: 0, // Do not use a cached position
        }
    );

    // Update button appearance to indicate GPS is active
    gpsButton.classList.add('active');
}

// Function to create the GPS button
function createGPSButton() {
    // Create a custom control button
    const GPSButton = L.Control.extend({
        onAdd: function (map) {
            const button = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-gps');
            button.innerHTML = '<i class="fas fa-location-arrow"></i>'; // Font Awesome icon for GPS
            button.title = 'Aktifkan Pelacakan GPS'; // Tooltip
            button.style.backgroundColor = 'white'; // Button background color
            button.style.border = '2px solid rgba(0,0,0,0.2)';
            button.style.cursor = 'pointer';

            // Add click event listener
            L.DomEvent.on(button, 'click', function (e) {
                L.DomEvent.stopPropagation(e); // Prevent map click events
                initGPSTracking(); // Activate GPS tracking
            });

            return button;
        },
    });

    // Add the button to the map
    gpsButton = new GPSButton({ position: 'topleft' }).addTo(map);
}
