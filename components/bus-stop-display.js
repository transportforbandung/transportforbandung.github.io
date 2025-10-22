// bus-stop-display.js
let busStopLayer = null;
let busStopCheckbox = null;

// Icon configurations for each category
const busStopIcons = {
    "1_shelter_yes_pole_none": L.divIcon({
        html: '<div style="background-color: #2ecc71; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
        className: 'bus-stop-icon',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    }),
    "2_shelter_none_pole_sign": L.divIcon({
        html: '<div style="background-color: #3498db; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
        className: 'bus-stop-icon',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    }),
    "3_shelter_none_pole_totem": L.divIcon({
        html: '<div style="background-color: #e74c3c; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
        className: 'bus-stop-icon',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    }),
    "4_shelter_none_pole_flag": L.divIcon({
        html: '<div style="background-color: #f39c12; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
        className: 'bus-stop-icon',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    }),
    "5_shelter_yes_pole_sign": L.divIcon({
        html: '<div style="background-color: #9b59b6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
        className: 'bus-stop-icon',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    }),
    "6_shelter_yes_pole_totem": L.divIcon({
        html: '<div style="background-color: #1abc9c; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
        className: 'bus-stop-icon',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    }),
    "7_shelter_yes_pole_flag": L.divIcon({
        html: '<div style="background-color: #d35400; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
        className: 'bus-stop-icon',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    }),
    "8_shelter_none_pole_none": L.divIcon({
        html: '<div style="background-color: #95a5a6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
        className: 'bus-stop-icon',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    })
};

// Function to load all bus stop data from single file
async function loadBusStops() {
    if (busStopLayer) {
        return busStopLayer;
    }

    try {
        const response = await fetch('route-data/bus-stop/all_bus_stops.geojson');
        const data = await response.json();
        
        // Create layer group with all stops
        busStopLayer = L.layerGroup();
        
        data.features.forEach(stop => {
            const coords = stop.geometry.coordinates;
            const props = stop.properties;
            const category = props.category || "8_shelter_none_pole_none";
            
            const marker = L.marker([coords[1], coords[0]], {
                icon: busStopIcons[category]
            });
            
            // Create popup content
            const popupContent = `
                <div class="bus-stop-popup">
                    <strong>${props.name || 'Unnamed Stop'}</strong><br>
                    ${props.shelter ? `Shelter: ${props.shelter}<br>` : ''}
                    ${props.pole ? `Pole: ${props.pole}<br>` : ''}
                    ${props.routes && props.routes.length > 0 ? 
                        `Routes: ${props.routes.length}` : 'No route data'}
                    <br><small>Category: ${category}</small>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            busStopLayer.addLayer(marker);
        });

        console.log(`Loaded ${data.features.length} bus stops`);
        return busStopLayer;
        
    } catch (error) {
        console.error('Failed to load bus stops:', error);
        // Return empty layer group if loading fails
        return L.layerGroup();
    }
}

// Function to initialize bus stop controls
function initializeBusStopControls() {
    // Add checkbox to the route container
    const routeContainer = document.getElementById('route-container');
    if (!routeContainer) return;

    const busStopControl = document.createElement('div');
    busStopControl.className = 'bus-stop-control mb-3 p-3 border-bottom';
    busStopControl.innerHTML = `
        <div class="form-check">
            <input class="form-check-input" type="checkbox" id="bus-stop-toggle" checked>
            <label class="form-check-label fw-bold" for="bus-stop-toggle">
                <i class="bi bi-geo-alt-fill"></i> Tampilkan Halte Bus
            </label>
        </div>
    `;
    
    // Insert at the top of the route container
    routeContainer.insertBefore(busStopControl, routeContainer.firstChild);
    
    busStopCheckbox = document.getElementById('bus-stop-toggle');
    
    // Load bus stops and set up event handlers
    loadBusStops().then(layer => {
        // Start with layer hidden (will show at zoom 15 if checked)
        let isLayerVisible = false;
        
        // Set up checkbox event
        busStopCheckbox.addEventListener('change', function() {
            if (this.checked && map.getZoom() >= 15) {
                map.addLayer(layer);
                isLayerVisible = true;
            } else {
                map.removeLayer(layer);
                isLayerVisible = false;
            }
        });
        
        // Set up zoom event to show/hide based on zoom level
        map.on('zoomend', function() {
            if (busStopCheckbox.checked && map.getZoom() >= 15 && !isLayerVisible) {
                map.addLayer(layer);
                isLayerVisible = true;
            } else if (map.getZoom() < 15 && isLayerVisible) {
                map.removeLayer(layer);
                isLayerVisible = false;
            }
        });
        
        // Initial check based on current zoom
        if (busStopCheckbox.checked && map.getZoom() >= 15) {
            map.addLayer(layer);
            isLayerVisible = true;
        }
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (typeof map !== 'undefined') {
        initializeBusStopControls();
    } else {
        // Wait for map to be initialized
        const checkMap = setInterval(() => {
            if (typeof map !== 'undefined') {
                clearInterval(checkMap);
                initializeBusStopControls();
            }
        }, 100);
    }
});
