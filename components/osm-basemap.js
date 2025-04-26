let map;
let isMapInitialized = false;

function initMap() {
    if (isMapInitialized) return;
    
    // Cleanup previous map instance if exists
    if (map && typeof map.remove === 'function') {
        map.remove();
        map = null;
    }

    // Create fresh map instance
    map = L.map('map', {
        renderer: L.canvas(),
        preferCanvas: true,
        fadeAnimation: false,
        zoomControl: false,
        attributionControl: false
    }).setView([-6.9104, 107.6183], 12);

    // Lightweight tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        minZoom: 10,
        detectRetina: true
    }).addTo(map);

    // Delay non-essential controls
    setTimeout(() => {
        L.control.attribution({
            position: 'bottomright',
            prefix: '<a href="https://osm.org/copyright">© OpenStreetMap</a>'
        }).addTo(map);
        
        L.control.fullscreen({
            position: 'topleft',
            forceSeparateButton: true
        }).addTo(map);
    }, 2000);

    // Memory cleanup handler
    window.addEventListener('beforeunload', () => {
        if (map) {
            map.remove();
            map = null;
        }
        isMapInitialized = false;
    });

    isMapInitialized = true;
    document.dispatchEvent(new CustomEvent('mapReady'));
}

// Initialize after critical content loads
window.addEventListener('load', initMap);
