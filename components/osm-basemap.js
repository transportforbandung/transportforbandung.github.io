// osm-basemap.js
let map;
let routeLayer;
let isGPSActive = false;
let watchId = null;
let userMarker = null;
let gpsButton;

function initMap() {
    const key = 'SYLu9i8cbX63FU8tAJg9'; // Your MapTiler API key

    // Create map centered on Bandung
    map = L.map('map').setView([-6.9104, 107.6183], 12);

    // Use custom MapTiler vector map
    const mtLayer = L.maptiler.maptilerLayer({
        apiKey: key,
        style: 'https://api.maptiler.com/maps/7cd7cac8-4971-44d1-952b-c04bc40da410/style.json',
    }).addTo(map);

    // When vector tiles load, hide the loader
    map.on('load', () => {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
    });

    // Apply visual filters to the base map (grayscale, brightness, saturation)
    mtLayer.getContainer().style.filter = 'grayscale(10%) brightness(90%) saturate(90%)';

    // Create empty layer group for routes
    routeLayer = L.layerGroup().addTo(map);

    // Add full-screen control
    const fullscreenControl = L.control.fullscreen({
        position: 'topleft',
        title: false,
        forceSeparateButton: true,
        fullscreenElement: false
    }).addTo(map);

    // Customize fullscreen button icons
    setTimeout(() => {
        const fullscreenButton = document.querySelector('a.leaflet-control-zoom-fullscreen.fullscreen-icon');
        if (fullscreenButton) {
            fullscreenButton.innerHTML = '<i class="bi bi-fullscreen"></i>';
            fullscreenButton.title = "Layar Penuh";

            map.on('enterFullscreen', () => {
                fullscreenButton.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
                fullscreenButton.title = "Keluar Layar Penuh";
            });

            map.on('exitFullscreen', () => {
                fullscreenButton.innerHTML = '<i class="bi bi-fullscreen"></i>';
                fullscreenButton.title = "Layar Penuh";
            });
        }
    }, 100);

    addRouteContainerControl();
    createGPSButton();
}

document.addEventListener('DOMContentLoaded', initMap);

// GPS tracking functions
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
            button.style.cssText = 'width: 34px; height: 34px; background-color: white; border: 2px solid rgba(0,0,0,0.2); cursor: pointer; color: #000; align-items: center; justify-content: center;';

            L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                isGPSActive ? stopGPSTracking() : initGPSTracking();
            });

            return button;
        }
    });

    gpsButton = new GPSButton({ position: 'topleft' }).addTo(map);
}

function addRouteContainerControl() {
    const sourceElement = document.getElementById('sidebar-map');
    if (!sourceElement) {
        console.error('Route container template not found!');
        return;
    }

    const mobileMediaQuery = window.matchMedia('(max-width: 768px)');

    const RouteContainerControl = L.Control.extend({
        options: { position: 'topright' },

        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'route-container-control shadow rounded m-2 position-absolute');
            container.style.top = '0';
            container.style.right = '0';

            const contentDiv = L.DomUtil.create('div', 'sidebar-content border bg-white shadow rounded overflow-auto position-absolute');
            contentDiv.style.zIndex = '1000';
            contentDiv.style.right = '-500px';
            contentDiv.style.top = '65px';
            contentDiv.style.maxHeight = '500px';
            contentDiv.style.transition = 'right 0.3s ease, width 0.3s ease';
            contentDiv.innerHTML = sourceElement.innerHTML;

            const updateDimensions = () => {
                if (mobileMediaQuery.matches) {
                    container.style.width = '250px';
                    contentDiv.style.width = '250px';
                    contentDiv.style.maxHeight = '250px';
                    contentDiv.style.top = '55px';
                } else {
                    container.style.width = '400px';
                    contentDiv.style.width = '400px';
                    contentDiv.style.maxHeight = '500px';
                    contentDiv.style.top = '65px';
                }
            };

            updateDimensions();
            mobileMediaQuery.addEventListener('change', updateDimensions);

            const toggleButton = L.DomUtil.create('button', 'btn btn-primary m-3 border shadow rounded position-absolute');
            toggleButton.innerHTML = '<i class="bi bi-list"></i>';
            toggleButton.style.top = '-.1rem';
            toggleButton.style.right = '0';
            toggleButton.style.zIndex = '1001';
            toggleButton.style.pointerEvents = 'all';

            L.DomEvent.disableScrollPropagation(contentDiv);

            container.appendChild(contentDiv);
            container.appendChild(toggleButton);

            let isSidebarVisible = false;

            toggleButton.addEventListener('pointerdown', function(e) {
                e.preventDefault();
                e.stopPropagation();

                if (isSidebarVisible) {
                    contentDiv.style.right = mobileMediaQuery.matches ? '-300px' : '-500px';
                    toggleButton.innerHTML = '<i class="bi bi-list"></i>';
                } else {
                    contentDiv.style.right = '16px';
                    toggleButton.innerHTML = '<i class="bi bi-x-lg"></i>';
                }

                isSidebarVisible = !isSidebarVisible;
            });

            map.on('remove', () => {
                mobileMediaQuery.removeEventListener('change', updateDimensions);
            });

            return container;
        }
    });

    map.addControl(new RouteContainerControl());
}
