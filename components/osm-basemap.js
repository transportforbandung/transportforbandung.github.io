// osm-basemap.js
// Declare map and routeLayer globally
let map;
let routeLayer;
let isGPSActive = false;
let watchId = null;
let userMarker = null;
let gpsButton;

// Dynamically load boostrap CSS
function loadBootstrapScoped(container) {
    const shadowRoot = container.attachShadow({ mode: 'open' });

    // Add Bootstrap CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/css/bootstrap.min.css';
    shadowRoot.appendChild(link);

    // Add the original content of map-checkbox-menu
    const originalContent = container.innerHTML;
    container.innerHTML = ''; // Clear the container
    const wrapper = document.createElement('div');
    wrapper.innerHTML = originalContent;
    shadowRoot.appendChild(wrapper);

    return shadowRoot;
}

document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.map-checkbox-menu');
    if (container) {
        loadBootstrapScoped(container);
    }
});

// Initialize the map
function initMap() {
    // Create map
    map = L.map('map').setView([-6.9104, 107.6183], 12);

    // Add OpenStreetMap base layer
    var tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap Contributors</a> | <a href="https://transportforbandung.org/tentang-kami">Transport for Bandung</a>'
    }).addTo(map);

    // When tiles load, hide the loader
    map.on('load', () => {
        document.getElementById('loader').style.display = 'none';
    });

    tileLayer.getContainer().style.filter = 'grayscale(80%) brightness(90%) saturate(80%)';

    // Initialize routeLayer and add it to the map
    routeLayer = L.layerGroup().addTo(map);

    // Add full-screen control
    const fullscreenControl = L.control.fullscreen({
        position: 'topleft',
        title: {
            false: 'Layar Penuh',
            true: 'Keluar Layar Penuh'
        },
        forceSeparateButton: true,
        fullscreenElement: false
    }).addTo(map);

    // Fullscreen button customization
    setTimeout(() => {
        const fullscreenButton = document.querySelector('a.leaflet-control-zoom-fullscreen.fullscreen-icon');
        if (fullscreenButton) {
            fullscreenButton.innerHTML = '<img src="https://transportforbandung.org/assets/fullscreen-enter.svg" alt="Enter Fullscreen" class="fullscreen-icon">';
            map.on('enterFullscreen', () => {
                fullscreenButton.innerHTML = '<img src="https://transportforbandung.org/assets/fullscreen-exit.svg" alt="Exit Fullscreen" class="fullscreen-icon">';
            });
            map.on('exitFullscreen', () => {
                fullscreenButton.innerHTML = '<img src="https://transportforbandung.org/assets/fullscreen-enter.svg" alt="Enter Fullscreen" class="fullscreen-icon">';
            });
        }
    }, 100);

    // Create the GPS button
    createGPSButton();
}

document.addEventListener('DOMContentLoaded', initMap);

// GPS Tracking Functions
function initGPSTracking() {
    if (isGPSActive) return;

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    const userIcon = L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
    });

    userMarker = L.marker([0, 0], { icon: userIcon }).addTo(map);
    let hasCentered = false;

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            userMarker.setLatLng([latitude, longitude]);
            if (!hasCentered) {
                map.setView([latitude, longitude], 15);
                hasCentered = true;
            }
        },
        (error) => {
            console.error("Error getting location:", error.message);
            stopGPSTracking();
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    isGPSActive = true;
    gpsButton.getContainer().classList.add('active');
}

function stopGPSTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
    }
    isGPSActive = false;
    gpsButton.getContainer().classList.remove('active');
}

function createGPSButton() {
    const GPSButton = L.Control.extend({
        onAdd: function(map) {
            const button = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-gps');
            button.innerHTML = '<i class="bi bi-cursor-fill"></i>';
            button.title = 'Aktifkan Pelacakan GPS';
            button.style.cssText = 'background-color: white; border: 2px solid rgba(0,0,0,0.2); cursor: pointer;';

            L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                isGPSActive ? stopGPSTracking() : initGPSTracking();
            });

            return button;
        }
    });

    gpsButton = new GPSButton({ position: 'topleft' }).addTo(map);
}
