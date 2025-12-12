// components/bus-stop-display.js
let busStopLayer = null;
let busStopCheckbox = null;
let routeDataCache = null;

// Bus stop icons
const busStopIcons = {
    "1_shelter_yes_pole_none": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Halte-Button.svg',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        className: 'bus-stop-custom-icon'
    }),
    "2_shelter_none_pole_sign": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Rambu-Button.svg',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        className: 'bus-stop-custom-icon'
    }),
    "3_shelter_none_pole_totem": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Totem-Button.svg',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        className: 'bus-stop-custom-icon'
    }),
    "4_shelter_none_pole_flag": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Flag-Button.svg',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        className: 'bus-stop-custom-icon'
    }),
    "5_shelter_yes_pole_sign": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Halte+Rambu-Button.svg',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        className: 'bus-stop-custom-icon'
    }),
    "6_shelter_yes_pole_totem": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Halte+Totem-Button.svg',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        className: 'bus-stop-custom-icon'
    }),
    "7_shelter_yes_pole_flag": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Halte+Flag-Button.svg',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        className: 'bus-stop-custom-icon'
    }),
    "8_shelter_none_pole_none": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Virtual-Button.svg',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        className: 'bus-stop-custom-icon'
    })
};

// =============== UTILITY FUNCTIONS ===============

async function loadRouteData() {
    if (routeDataCache) return routeDataCache;
    
    try {
        const response = await fetch('route-data/routes.json');
        const data = await response.json();
        
        const routeLookup = {};
        data.categories.forEach(category => {
            category.routes.forEach(route => {
                routeLookup[route.relationId] = {
                    ...route,
                    categoryName: category.name
                };
            });
        });
        
        routeDataCache = { routeLookup };
        return routeDataCache;
        
    } catch (error) {
        console.error('Failed to load route data:', error);
        return { routeLookup: {} };
    }
}

function extractDestination(routeName) {
    const arrowIndex = routeName.indexOf('→');
    if (arrowIndex !== -1) {
        let destination = routeName.substring(arrowIndex + 1).trim();
        destination = destination.replace(/[.,;:]$/, '').trim();
        return destination;
    }
    
    const colonIndex = routeName.indexOf(':');
    if (colonIndex !== -1) {
        return routeName.substring(colonIndex + 1).trim();
    }
    
    return routeName;
}

function getContrastColor(hexColor) {
    if (!hexColor || !hexColor.startsWith('#') || hexColor.length !== 7) {
        return '#FFFFFF';
    }
    
    try {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.6 ? '#000000' : '#FFFFFF';
    } catch (error) {
        return '#FFFFFF';
    }
}

function isRouteDisplayed(relationId) {
    const sidebarCheckbox = document.querySelector(`.route-checkbox[data-relation-id="${relationId}"]`);
    return sidebarCheckbox ? sidebarCheckbox.checked : false;
}

function syncWithSidebar(relationId, shouldDisplay) {
    const sidebarCheckbox = document.querySelector(`.route-checkbox[data-relation-id="${relationId}"]`);
    if (sidebarCheckbox && sidebarCheckbox.checked !== shouldDisplay) {
        sidebarCheckbox.checked = shouldDisplay;
        // Trigger the change event to load/unload route
        sidebarCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// =============== EVENT HANDLING ===============

function setupEventDelegation() {
    // Event delegation for checkbox changes
    document.addEventListener('change', function(e) {
        if (e.target && e.target.classList.contains('popup-route-checkbox')) {
            handleCheckboxChange(e.target);
        }
    });
    
    // Event delegation for button clicks
    document.addEventListener('click', function(e) {
        if (!e.target) return;
        
        // Toggle button
        if (e.target.classList.contains('btn-toggle-all') || e.target.closest('.btn-toggle-all')) {
            e.preventDefault();
            e.stopPropagation();
            const button = e.target.classList.contains('btn-toggle-all') 
                ? e.target 
                : e.target.closest('.btn-toggle-all');
            if (button) handleToggleAll(button);
        }
        
        // Close button
        else if (e.target.classList.contains('btn-close-popup') || e.target.closest('.btn-close-popup')) {
            e.preventDefault();
            e.stopPropagation();
            closePopup();
        }
    });
}

function handleCheckboxChange(checkbox) {
    const relationId = checkbox.dataset.relationId;
    const routeItem = checkbox.closest('.route-item');
    
    // Update visual state
    if (routeItem) {
        routeItem.style.backgroundColor = checkbox.checked ? 'rgba(0, 166, 79, 0.05)' : '';
    }
    
    // Sync with sidebar
    syncWithSidebar(relationId, checkbox.checked);
    
    // Update toggle button in the same popup
    const popup = checkbox.closest('.bus-stop-popup-enhanced');
    if (popup) updateToggleButton(popup);
}

function handleToggleAll(button) {
    const popup = button.closest('.bus-stop-popup-enhanced');
    if (!popup) return;
    
    const checkboxes = popup.querySelectorAll('.popup-route-checkbox');
    const mode = button.dataset.mode;
    const shouldSelect = mode === 'select';
    
    checkboxes.forEach(checkbox => {
        if (checkbox.checked !== shouldSelect) {
            checkbox.checked = shouldSelect;
            checkbox.dispatchEvent(new Event('change'));
        }
    });
}

function closePopup() {
    const popup = document.querySelector('.leaflet-popup');
    if (popup) {
        const closeButton = popup.querySelector('.leaflet-popup-close-button');
        if (closeButton) closeButton.click();
    }
}

function areAllRoutesSelected(popup) {
    if (!popup) return false;
    const checkboxes = popup.querySelectorAll('.popup-route-checkbox');
    if (checkboxes.length === 0) return false;
    
    return Array.from(checkboxes).every(checkbox => checkbox.checked);
}

function updateToggleButton(popup) {
    if (!popup) return;
    const button = popup.querySelector('.btn-toggle-all');
    if (!button) return;
    
    const allSelected = areAllRoutesSelected(popup);
    
    if (allSelected) {
        button.innerHTML = '<i class="bi bi-eye-slash me-1"></i>Sembunyikan Semua Rute';
        button.dataset.mode = 'deselect';
        button.style.backgroundColor = '#6c757d';
    } else {
        button.innerHTML = '<i class="bi bi-check-all me-1"></i>Pilih Semua Rute';
        button.dataset.mode = 'select';
        button.style.backgroundColor = '#00A64F';
    }
}

// =============== POPUP GENERATION ===============

async function generateEnhancedPopup(stopProps) {
    const routeData = await loadRouteData();
    const routes = stopProps.routes || [];
    
    // Group routes by category
    const routesByCategory = {};
    routes.forEach(relationId => {
        const routeInfo = routeData.routeLookup[relationId];
        if (routeInfo) {
            const category = routeInfo.categoryName || 'Lainnya';
            if (!routesByCategory[category]) {
                routesByCategory[category] = [];
            }
            
            let routeRef = routeInfo.ref || '';
            if (!routeRef && routeInfo.name) {
                const match = routeInfo.name.match(/^(?:Koridor|Corridor|Rute|Route)?\s*(\w+)/i);
                routeRef = match ? match[1] : '';
            }
            
            routesByCategory[category].push({
                ...routeInfo,
                relationId,
                ref: routeRef,
                destination: extractDestination(routeInfo.name),
                textColor: getContrastColor(routeInfo.color || '#CCCCCC')
            });
        }
    });
    
    // Check initial state for toggle button
    const initialAllSelected = routes.every(relationId => isRouteDisplayed(relationId));
    
    // Build HTML
    let html = `
        <div class="bus-stop-popup-enhanced">
            <div class="popup-header">
                <h4>${stopProps.name || 'Halte Tanpa Nama'}</h4>
                <div class="stop-info">
                    ${stopProps.shelter ? `<div>Shelter: ${stopProps.shelter}</div>` : ''}
                    ${stopProps.pole ? `<div>Tiang: ${stopProps.pole}</div>` : ''}
                    <div>Melayani ${routes.length} rute</div>
                </div>
            </div>
    `;
    
    if (Object.keys(routesByCategory).length > 0) {
        html += `<div class="route-categories">`;
        
        Object.entries(routesByCategory).forEach(([categoryName, categoryRoutes]) => {
            html += `
                <div class="category-group">
                    <h5>${categoryName}</h5>
                    <div class="route-list">
            `;
            
            categoryRoutes.forEach(route => {
                const isActive = isRouteDisplayed(route.relationId);
                html += `
                    <div class="route-item" data-relation-id="${route.relationId}">
                        <label>
                            <input type="checkbox" 
                                   class="popup-route-checkbox" 
                                   data-relation-id="${route.relationId}"
                                   ${isActive ? 'checked' : ''}>
                            <span class="route-badge" style="background-color: ${route.color || '#CCCCCC'}; color: ${route.textColor}">
                                ${route.ref || '?'}
                            </span>
                            <span class="route-destination">ke ${route.destination}</span>
                        </label>
                    </div>
                `;
            });
            
            html += `</div></div>`;
        });
        
        html += `</div>`;
    } else {
        html += `<div class="no-routes">Data rute belum tersedia</div>`;
    }
    
    // Toggle button
    const toggleText = initialAllSelected ? 
        '<i class="bi bi-eye-slash me-1"></i>Sembunyikan Semua Rute' : 
        '<i class="bi bi-check-all me-1"></i>Pilih Semua Rute';
    const toggleColor = initialAllSelected ? '#6c757d' : '#00A64F';
    
    html += `
        <div class="popup-actions">
            <button class="btn-toggle-all" data-mode="${initialAllSelected ? 'deselect' : 'select'}" style="background-color: ${toggleColor}">
                ${toggleText}
            </button>
            <button class="btn-close-popup">Tutup</button>
        </div>
    </div>`;
    
    return html;
}

// =============== BUS STOP MANAGEMENT ===============

async function loadBusStops() {
    if (busStopLayer) return busStopLayer;

    try {
        const response = await fetch('route-data/bus-stop/all_bus_stops.geojson');
        const data = await response.json();
        
        busStopLayer = L.layerGroup();
        
        data.features.forEach(stop => {
            const coords = stop.geometry.coordinates;
            const props = stop.properties;
            const category = props.category || "8_shelter_none_pole_none";
            
            const marker = L.marker([coords[1], coords[0]], {
                icon: busStopIcons[category]
            });
            
            marker.bindPopup('<div class="popup-loading">Memuat data rute...</div>', {
                maxWidth: 280,
                minWidth: 200,
                className: 'enhanced-bus-stop-popup'
            });
            
            marker.on('popupopen', async function() {
                const popup = this.getPopup();
                try {
                    const content = await generateEnhancedPopup(props);
                    popup.setContent(content);
                } catch (error) {
                    console.error('Error loading popup:', error);
                    popup.setContent('<div class="popup-error">Gagal memuat data</div>');
                }
            });
            
            busStopLayer.addLayer(marker);
        });

        console.log(`Loaded ${data.features.length} bus stops`);
        return busStopLayer;
        
    } catch (error) {
        console.error('Failed to load bus stops:', error);
        return L.layerGroup();
    }
}

function initializeBusStopControls() {
    const routeContainer = document.getElementById('route-container');
    if (!routeContainer) return;

    const busStopControl = document.createElement('div');
    busStopControl.className = 'bus-stop-control mb-3 p-2 border-bottom bg-light rounded';
    busStopControl.innerHTML = `
        <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="bus-stop-toggle" checked>
            <label class="form-check-label fw-bold" for="bus-stop-toggle">
                <i class="bi bi-geo-alt-fill me-1"></i>Tampilkan Halte Bus
            </label>
        </div>
        <small class="text-muted d-block mt-1">Klik halte untuk melihat rute</small>
        
        <div class="bus-stop-legend mt-2">
            <div class="legend-item"><span class="legend-color" style="background-color: #2ecc71;"></span>Halte</div>
            <div class="legend-item"><span class="legend-color" style="background-color: #3498db;"></span>Rambu</div>
            <div class="legend-item"><span class="legend-color" style="background-color: #e74c3c;"></span>Totem</div>
            <div class="legend-item"><span class="legend-color" style="background-color: #f39c12;"></span>Flag</div>
            <div class="legend-item"><span class="legend-color" style="background-color: #95a5a6;"></span>Virtual</div>
        </div>
    `;
    
    routeContainer.insertBefore(busStopControl, routeContainer.firstChild);
    
    busStopCheckbox = document.getElementById('bus-stop-toggle');
    
    loadBusStops().then(layer => {
        let isLayerVisible = false;
        
        busStopCheckbox.addEventListener('change', function() {
            if (this.checked && map.getZoom() >= 16) {
                map.addLayer(layer);
                isLayerVisible = true;
            } else {
                map.removeLayer(layer);
                isLayerVisible = false;
            }
        });
        
        map.on('zoomend', function() {
            if (busStopCheckbox.checked && map.getZoom() >= 16 && !isLayerVisible) {
                map.addLayer(layer);
                isLayerVisible = true;
            } else if (map.getZoom() < 16 && isLayerVisible) {
                map.removeLayer(layer);
                isLayerVisible = false;
            }
        });
        
        if (busStopCheckbox.checked && map.getZoom() >= 16) {
            map.addLayer(layer);
            isLayerVisible = true;
        }
    });
}

// =============== INITIALIZATION ===============

document.addEventListener('DOMContentLoaded', function() {
    // Set up event delegation
    setupEventDelegation();
    
    // Wait for map
    const checkMap = setInterval(() => {
        if (typeof map !== 'undefined') {
            clearInterval(checkMap);
            setTimeout(() => {
                initializeBusStopControls();
            }, 800);
        }
    }, 100);
});
