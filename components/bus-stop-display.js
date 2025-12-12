// components/bus-stop-display.js
let busStopLayer = null;
let busStopCheckbox = null;
let routeDataCache = null;

// Updated icon configurations
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

// Load route data
async function loadRouteData() {
    if (routeDataCache) return routeDataCache;
    
    try {
        const response = await fetch('route-data/routes.json');
        const data = await response.json();
        
        const routeLookup = {};
        const categoryLookup = {};
        
        data.categories.forEach(category => {
            category.routes.forEach(route => {
                routeLookup[route.relationId] = {
                    ...route,
                    categoryName: category.name
                };
                
                if (!categoryLookup[category.name]) {
                    categoryLookup[category.name] = [];
                }
                categoryLookup[category.name].push(route.relationId);
            });
        });
        
        routeDataCache = { routeLookup, categoryLookup };
        console.log(`Loaded ${Object.keys(routeLookup).length} routes`);
        return routeDataCache;
        
    } catch (error) {
        console.error('Failed to load route data:', error);
        return { routeLookup: {}, categoryLookup: {} };
    }
}

// Extract destination from route name
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

// Calculate text color for badge
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

// Check if route is displayed
function isRouteDisplayed(relationId) {
    const sidebarCheckbox = document.querySelector(`.route-checkbox[data-relation-id="${relationId}"]`);
    return sidebarCheckbox ? sidebarCheckbox.checked : false;
}

// Sync with sidebar
function syncWithSidebar(relationId, shouldDisplay) {
    const sidebarCheckbox = document.querySelector(`.route-checkbox[data-relation-id="${relationId}"]`);
    if (sidebarCheckbox && sidebarCheckbox.checked !== shouldDisplay) {
        sidebarCheckbox.checked = shouldDisplay;
        sidebarCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// Event delegation for popup interactions
function setupEventDelegation() {
    // Use event delegation for checkbox changes
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('popup-route-checkbox')) {
            const checkbox = e.target;
            const relationId = checkbox.dataset.relationId;
            const routeItem = checkbox.closest('.route-item');
            
            // Update visual state
            if (routeItem) {
                routeItem.style.backgroundColor = checkbox.checked ? 'rgba(0, 166, 79, 0.05)' : '';
            }
            
            // Sync with sidebar
            syncWithSidebar(relationId, checkbox.checked);
            
            // Update toggle button in the same popup
            updateToggleButton(routeItem?.closest('.bus-stop-popup-enhanced'));
        }
    });
    
    // Event delegation for button clicks
    document.addEventListener('click', function(e) {
        // Toggle all button
        if (e.target.classList.contains('btn-toggle-all') || e.target.closest('.btn-toggle-all')) {
            e.preventDefault();
            e.stopPropagation();
            
            const toggleBtn = e.target.classList.contains('btn-toggle-all') 
                ? e.target 
                : e.target.closest('.btn-toggle-all');
            
            if (!toggleBtn) return;
            
            const popup = toggleBtn.closest('.bus-stop-popup-enhanced');
            if (!popup) return;
            
            toggleAllRoutes(popup);
        }
        
        // Close button
        else if (e.target.classList.contains('btn-close-popup') || e.target.closest('.btn-close-popup')) {
            e.preventDefault();
            e.stopPropagation();
            
            // Find and close the popup
            const popup = document.querySelector('.leaflet-popup');
            if (popup) {
                const closeBtn = popup.querySelector('.leaflet-popup-close-button');
                if (closeBtn) closeBtn.click();
            }
        }
    });
    
    // Mouse events for toggle buttons (direct event handlers since they're safe)
    document.addEventListener('mouseover', function(e) {
        if (e.target.classList.contains('btn-toggle-all') || e.target.closest('.btn-toggle-all')) {
            const toggleBtn = e.target.classList.contains('btn-toggle-all') 
                ? e.target 
                : e.target.closest('.btn-toggle-all');
            
            if (!toggleBtn) return;
            
            const mode = toggleBtn.dataset.mode;
            if (mode === 'select') {
                toggleBtn.style.backgroundColor = '#008f43'; // Darker green
            } else {
                toggleBtn.style.backgroundColor = '#5a6268'; // Darker gray
            }
        }
    });
    
    document.addEventListener('mouseout', function(e) {
        if (e.target.classList.contains('btn-toggle-all') || e.target.closest('.btn-toggle-all')) {
            const toggleBtn = e.target.classList.contains('btn-toggle-all') 
                ? e.target 
                : e.target.closest('.btn-toggle-all');
            
            if (!toggleBtn) return;
            
            const mode = toggleBtn.dataset.mode;
            if (mode === 'select') {
                toggleBtn.style.backgroundColor = '#00A64F';
            } else {
                toggleBtn.style.backgroundColor = '#6c757d';
            }
        }
    });
}

// Check if all routes in a specific popup are selected
function areAllRoutesSelected(popupElement) {
    if (!popupElement) return false;
    
    const checkboxes = popupElement.querySelectorAll('.popup-route-checkbox');
    if (checkboxes.length === 0) return false;
    
    for (let checkbox of checkboxes) {
        if (!checkbox.checked) return false;
    }
    return true;
}

// Update toggle button text and state for a specific popup
function updateToggleButton(popupElement) {
    if (!popupElement) return;
    
    const toggleBtn = popupElement.querySelector('.btn-toggle-all');
    if (!toggleBtn) return;
    
    const allSelected = areAllRoutesSelected(popupElement);
    
    if (allSelected) {
        toggleBtn.innerHTML = '<i class="bi bi-eye-slash me-1"></i>Sembunyikan Semua Rute';
        toggleBtn.dataset.mode = 'deselect';
        toggleBtn.style.backgroundColor = '#6c757d';
    } else {
        toggleBtn.innerHTML = '<i class="bi bi-check-all me-1"></i>Pilih Semua Rute';
        toggleBtn.dataset.mode = 'select';
        toggleBtn.style.backgroundColor = '#00A64F';
    }
}

// Toggle all routes in a specific popup
function toggleAllRoutes(popupElement) {
    if (!popupElement) return;
    
    const toggleBtn = popupElement.querySelector('.btn-toggle-all');
    if (!toggleBtn) return;
    
    const checkboxes = popupElement.querySelectorAll('.popup-route-checkbox');
    const mode = toggleBtn.dataset.mode;
    const shouldSelect = mode === 'select';
    
    // Update all checkboxes in the popup
    checkboxes.forEach(checkbox => {
        if (checkbox.checked !== shouldSelect) {
            checkbox.checked = shouldSelect;
            
            // Update visual state
            const routeItem = checkbox.closest('.route-item');
            if (routeItem) {
                routeItem.style.backgroundColor = shouldSelect ? 'rgba(0, 166, 79, 0.05)' : '';
            }
            
            // Sync with sidebar
            syncWithSidebar(checkbox.dataset.relationId, shouldSelect);
        }
    });
    
    // Update button for next click
    updateToggleButton(popupElement);
}

// Generate enhanced popup
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
    
    // Compact HTML
    let html = `
        <div class="bus-stop-popup-enhanced">
            <div class="popup-header">
                <h4 style="margin: 0 0 6px 0; color: #00152B; font-size: 1rem; font-weight: 600;">${stopProps.name || 'Halte Tanpa Nama'}</h4>
                <div class="stop-info" style="color: #666; font-size: 0.8rem; margin-bottom: 12px; line-height: 1.3;">
                    ${stopProps.shelter ? `Shelter: ${stopProps.shelter}<br>` : ''}
                    ${stopProps.pole ? `Tiang: ${stopProps.pole}<br>` : ''}
                    Melayani ${routes.length} rute
                </div>
            </div>
    `;
    
    if (Object.keys(routesByCategory).length > 0) {
        html += `<div class="route-categories" style="max-height: 240px; overflow-y: auto; padding-right: 4px;">`;
        
        Object.entries(routesByCategory).forEach(([categoryName, categoryRoutes]) => {
            html += `
                <div class="category-group" style="margin-bottom: 16px;">
                    <h5 style="margin: 0 0 8px 0; color: #00568E; font-size: 0.9rem; 
                           border-bottom: 1px solid #eee; padding-bottom: 4px; font-weight: 600;">
                        ${categoryName}
                    </h5>
                    <div class="route-list">
            `;
            
            categoryRoutes.forEach(route => {
                const isActive = isRouteDisplayed(route.relationId);
                
                html += `
                    <div class="route-item" data-relation-id="${route.relationId}" 
                         style="padding: 6px 0; border-bottom: 1px solid #f0f0f0;">
                        <label style="display: flex; align-items: center; cursor: pointer; margin: 0;">
                            <input type="checkbox" 
                                   class="popup-route-checkbox" 
                                   data-relation-id="${route.relationId}"
                                   ${isActive ? 'checked' : ''}
                                   style="margin-right: 8px; cursor: pointer; width: 14px; height: 14px;">
                            <span class="route-badge" 
                                  style="display: inline-flex; align-items: center; justify-content: center; 
                                         min-width: 26px; height: 26px; border-radius: 5px; 
                                         background-color: ${route.color || '#CCCCCC'}; 
                                         color: ${route.textColor}; font-weight: 600; 
                                         font-size: 0.8rem; margin-right: 8px; flex-shrink: 0;">
                                ${route.ref || '?'}
                            </span>
                            <span class="route-destination" style="font-size: 0.85rem; color: #333; line-height: 1.2;">
                                ke ${route.destination}
                            </span>
                        </label>
                    </div>
                `;
            });
            
            html += `</div></div>`;
        });
        
        html += `</div>`;
    } else {
        html += `<div style="text-align: center; padding: 16px 0;">
                    <p style="color: #666; font-style: italic; margin: 0; font-size: 0.85rem;">Data rute belum tersedia</p>
                 </div>`;
    }
    
    // Smart toggle button - initial text based on current selection
    const toggleText = initialAllSelected ? 
        '<i class="bi bi-eye-slash me-1"></i>Sembunyikan Semua Rute' : 
        '<i class="bi bi-check-all me-1"></i>Pilih Semua Rute';
    const toggleColor = initialAllSelected ? '#6c757d' : '#00A64F';
    
    html += `
        <div class="popup-actions" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee;">
            <button class="btn-toggle-all" 
                    data-mode="${initialAllSelected ? 'deselect' : 'select'}"
                    style="background-color: ${toggleColor}; color: white; border: none; border-radius: 20px; 
                           padding: 8px 16px; font-weight: 500; cursor: pointer; font-size: 0.85rem; 
                           margin-right: 8px; flex: 1; transition: background-color 0.2s ease;">
                ${toggleText}
            </button>
            <button class="btn-close-popup" 
                    style="background-color: transparent; color: #666; border: 1px solid #ddd; 
                           border-radius: 20px; padding: 8px 16px; font-weight: 400; cursor: pointer; 
                           font-size: 0.85rem; flex: 1;">
                Tutup
            </button>
        </div>
    </div>`;
    
    return html;
}

// Load bus stops
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
            
            // Initial loading popup
            marker.bindPopup('<div style="padding: 15px; text-align: center; font-size: 0.85rem;"><i class="bi bi-hourglass-split"></i><br>Memuat...</div>', {
                maxWidth: 280,
                minWidth: 200,
                className: 'enhanced-bus-stop-popup'
            });
            
            // Load popup content when opened
            marker.on('popupopen', async function() {
                const popup = this.getPopup();
                try {
                    const content = await generateEnhancedPopup(props);
                    popup.setContent(content);
                    
                    // No need to attach event listeners - they're handled by delegation
                    // But we should update the toggle button for this popup
                    setTimeout(() => {
                        const popupElement = popup.getElement()?.querySelector('.bus-stop-popup-enhanced');
                        if (popupElement) {
                            updateToggleButton(popupElement);
                        }
                    }, 10);
                    
                } catch (error) {
                    popup.setContent('<div style="padding: 15px; text-align: center; color: #666; font-size: 0.85rem;">Gagal memuat data</div>');
                }
            });
            
            busStopLayer.addLayer(marker);
        });

        console.log(`✓ Loaded ${data.features.length} bus stops`);
        return busStopLayer;
        
    } catch (error) {
        console.error('Failed to load bus stops:', error);
        return L.layerGroup();
    }
}

// Initialize bus stop controls
function initializeBusStopControls() {
    const routeContainer = document.getElementById('route-container');
    if (!routeContainer) return;

    // Control panel
    const busStopControl = document.createElement('div');
    busStopControl.className = 'bus-stop-control mb-3 p-2 border-bottom bg-light rounded';
    busStopControl.innerHTML = `
        <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="bus-stop-toggle" checked>
            <label class="form-check-label fw-bold" for="bus-stop-toggle" style="font-size: 0.9rem;">
                <i class="bi bi-geo-alt-fill me-1"></i>Tampilkan Halte Bus
            </label>
        </div>
        <small class="text-muted d-block mt-1" style="font-size: 0.75rem;">Klik halte untuk melihat rute</small>
        
        <!-- Compact legend -->
        <div class="bus-stop-legend mt-2" style="font-size: 0.65rem;">
            <div class="legend-item mb-1">
                <span class="legend-color" style="background-color: #2ecc71;"></span>
                Halte
            </div>
            <div class="legend-item mb-1">
                <span class="legend-color" style="background-color: #3498db;"></span>
                Rambu
            </div>
            <div class="legend-item mb-1">
                <span class="legend-color" style="background-color: #e74c3c;"></span>
                Totem
            </div>
            <div class="legend-item mb-1">
                <span class="legend-color" style="background-color: #f39c12;"></span>
                Flag
            </div>
            <div class="legend-item mb-1">
                <span class="legend-color" style="background-color: #95a5a6;"></span>
                Virtual
            </div>
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

// Initialize everything
document.addEventListener('DOMContentLoaded', function() {
    // Set up event delegation once
    setupEventDelegation();
    
    // Wait for map to be initialized
    const checkMap = setInterval(() => {
        if (typeof map !== 'undefined') {
            clearInterval(checkMap);
            setTimeout(() => {
                initializeBusStopControls();
            }, 800);
        }
    }, 100);
});
