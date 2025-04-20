// osm-basemap.js - Merged and optimized
let map;
let routeLayer;
let isGPSActive = false;
let watchId = null;
let userMarker = null;
let gpsButton;
const activeRoutes = new Map();
const routeContainer = document.getElementById('route-container');
const GPS_OPTIONS = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };

// Map Initialization
function initMap() {
    map = L.map('map').setView([-6.9104, 107.6183], 12);
    
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap Contributors</a> | Data processing by <a href="https://transportforbandung.org/tentang-kami">Transport for Bandung</a>'
    }).addTo(map);
    
    if (tileLayer.getContainer) {
        tileLayer.getContainer().style.filter = 'grayscale(80%) brightness(90%) saturate(80%)';
    }
    routeLayer = L.layerGroup().addTo(map);
    
    initControls();
    setupFullscreenButton();
    setupMapReady();
}

function initControls() {
    const fullscreenControl = L.control.fullscreen({
        position: 'topleft',
        title: { false: 'Layar Penuh', true: 'Keluar Layar Penuh' },
        forceSeparateButton: true
    }).addTo(map);

    gpsButton = new (L.Control.extend({
        onAdd: () => {
            const button = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-gps');
            button.innerHTML = '<i class="fas fa-location-arrow"></i>';
            button.title = 'Aktifkan Pelacakan GPS';
            button.style.cssText = 'background-color: white; border: 2px solid rgba(0,0,0,0.2); cursor: pointer;';
            L.DomEvent.on(button, 'click', () => isGPSActive ? stopGPSTracking() : initGPSTracking());
            return button;
        }
    }))({ position: 'topleft' }).addTo(map);
}

function setupFullscreenButton() {
    setTimeout(() => {
        const fullscreenButton = document.querySelector('a.leaflet-control-zoom-fullscreen.fullscreen-icon');
        if (fullscreenButton) {
            const updateIcon = (isFull) => fullscreenButton.innerHTML = `<img src="https://transportforbandung.org/assets/fullscreen-${isFull ? 'exit' : 'enter'}.svg" alt="${isFull ? 'Exit' : 'Enter'} Fullscreen">`;
            updateIcon(false);
            map.on('enterFullscreen exitFullscreen', e => updateIcon(e.type === 'enterFullscreen'));
        }
    }, 100);
}

function setupMapReady() {
    map.whenReady(() => {
        initializeCollapsibles();
        initializeRoutes().catch(console.error);
    });
}

// GPS Tracking
function initGPSTracking() {
    if (isGPSActive || !navigator.geolocation) return alert("Geolocation not supported");
    
    const userIcon = L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
    });

    userMarker = L.marker([0, 0], { icon: userIcon }).addTo(map);
    let hasCentered = false;

    watchId = navigator.geolocation.watchPosition(
        ({ coords: { latitude, longitude } }) => {
            userMarker.setLatLng([latitude, longitude]);
            if (!hasCentered && (hasCentered = true)) map.setView([latitude, longitude], 15);
        },
        (error) => {
            console.error("Location error:", error.message);
            stopGPSTracking();
        },
        GPS_OPTIONS
    );

    isGPSActive = true;
    if (gpsButton && gpsButton.getContainer) {
        gpsButton.getContainer().classList.add('active');
    }
}

function stopGPSTracking() {
    watchId && navigator.geolocation.clearWatch(watchId);
    userMarker?.remove();
    userMarker = watchId = null;
    isGPSActive = false;
    gpsButton.getContainer().classList.remove('active');
}

// Route Handling
function initializeCollapsibles() {
    document.addEventListener('click', ({ target }) => {
        const header = target.closest('.route-map-collapsible-bar');
        if (!header) return;
        
        const content = header.nextElementSibling;
        const arrow = header.querySelector('.route-map-collapsible-bar-arrow');
        const isVisible = content.style.display === 'block';
        
        content.style.display = isVisible ? 'none' : 'block';
        arrow.style.transform = `rotate(${isVisible ? 0 : 180}deg)`;
    });
}

async function initializeRoutes() {
    try {
        const { categories } = await fetch('data/routes.json').then(res => res.json());
        
        categories.forEach(category => {
            const categoryHTML = `
                <div class="route-map-collapsible">
                    <div class="route-map-collapsible-bar">
                        <span>${category.name}</span>
                        <span class="route-map-collapsible-bar-arrow">▼</span>
                    </div>
                    <div class="route-map-collapsible-content" style="display:none">
                        ${category.routes.map(route => `
                            <label class="route-option">
                                <input type="checkbox"
                                       data-relation-id="${route.relationId}"
                                       data-display-type="${route.type}"
                                       data-route-color="${route.color}">
                                ${route.name}
                                <span class="route-link">(${route.type})</span>
                            </label>
                        `).join('')}
                    </div>
                </div>`;
            if (routeContainer) {
                routeContainer.insertAdjacentHTML('beforeend', categoryHTML);
            } else {
                console.error('Route container not found in DOM.');
            }
        });

        document.querySelector('.map-checkbox-menu').addEventListener('change', handleCheckboxChange);
    } catch (error) {
        console.error('Route initialization failed:', error);
        throw error;
    }
}

async function handleCheckboxChange({ target }) {
    if (!target.matches('input[type="checkbox"]')) return;
    
    const { relationId: id, displayType, routeColor } = target.dataset;
    if (!id) return;

    try {
        if (target.checked) {
            if (!activeRoutes.has(id)) {
                const layerGroup = await fetchRouteData(id, displayType, routeColor);
                activeRoutes.set(id, layerGroup.addTo(routeLayer));
            } else {
                activeRoutes.get(id).addTo(routeLayer);
            }
        } else {
            activeRoutes.get(id)?.removeFrom(routeLayer);
        }
    } catch (error) {
        console.error("Route loading error:", error);
        target.checked = false;
    }
}

async function fetchRouteData(id, displayType, color) {
    try {
        // Only load data when checkbox is checked
        const layerGroup = L.layerGroup();
        const result = localData.value || overpassData.value || null;
        if (!result) {
            throw new Error('Failed to fetch route data.');
        }
        return result;
        
        return localData.value || overpassData.value;
    } catch (error) {
        console.error("Failed to fetch route data:", error);
        throw error;
    }
}

// Data Fetching (Keep Overpass queries unchanged)
async function fetchLocalRoute(relationId, displayType, routeColor) {
    try {
        const layerGroup = L.layerGroup();
        const basePath = `data/${relationId}`;
        
        const [waysData, stopsData] = await Promise.all([
            fetch(`${basePath}/ways.geojson`).then(res => res.json()),
            fetch(`${basePath}/${displayType === "ways_with_points" ? "stops" : "endstops"}.geojson`).then(res => res.json())
        ]);

        processGeoJSONData(layerGroup, waysData, stopsData, routeColor);
        return layerGroup;
    } catch {
        return null;
    }
}

async function fetchOverpassRoute(relationId, displayType, routeColor) {
    const layerGroup = L.layerGroup();
    const queries = {
        way: `[out:json];relation(${relationId});(way(r);>;);out geom;`,
        stop: `[out:json];relation(${relationId});node(r:"stop");out geom;relation(${relationId});node(r:"stop_entry_only");out geom;relation(${relationId});node(r:"stop_exit_only");out geom;`
    };

    const [waysData, stopsData] = await Promise.all([
        fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(queries.way)}`).then(res => res.json()),
        fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(queries.stop)}`).then(res => res.json())
    ]);

    processOverpassData(layerGroup, waysData, stopsData, routeColor);
    return layerGroup;
}

// Data Processing
function processGeoJSONData(layerGroup, waysData, stopsData, routeColor) {
    waysData.features.forEach(({ geometry }) => {
        if (geometry.type === "LineString") {
            L.polyline(geometry.coordinates.map(([lng, lat]) => [lat, lng]), {
                color: routeColor,
                weight: 4
            }).addTo(layerGroup);
        }
    });

    stopsData.features.forEach(({ geometry, properties }) => {
        if (geometry.type === "Point") {
            createStopMarker(layerGroup, geometry.coordinates[1], geometry.coordinates[0], routeColor, properties?.name);
        }
    });
}

function processOverpassData(layerGroup, waysData, stopsData, routeColor) {
    waysData.elements.forEach(element => {
        if (element.type === "way" && element.geometry) {
            L.polyline(element.geometry.map(({ lat, lon }) => [lat, lon]), {
                color: routeColor,
                weight: 4
            }).addTo(layerGroup);
        }
    });

    stopsData.elements.forEach(({ lat, lon, tags }) => {
        createStopMarker(layerGroup, lat, lon, routeColor, tags?.name);
    });
}

function createStopMarker(layerGroup, lat, lng, color, name) {
    L.circleMarker([lat, lng], {
        radius: 5,
        color: color,
        fillColor: "#ffffff",
        fillOpacity: 1
    }).bindPopup(name || "Unnamed Stop").addTo(layerGroup);
}

// Cache Maintenance
setInterval(() => {
    activeRoutes.forEach((layer, id) => {
        if (!document.querySelector(`input[data-relation-id="${id}"]:checked`)) {
            layer.removeFrom(routeLayer);
            activeRoutes.delete(id);
        }
    });
}, 3.6e6);

document.addEventListener('DOMContentLoaded', initMap);
