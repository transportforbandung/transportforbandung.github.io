// components/bus-stop-display.js - ENHANCED VERSION
let busStopLayer = null;
let busStopCheckbox = null;
let routeDataCache = null;

// Updated icon configurations with your custom icons
const busStopIcons = {
    "1_shelter_yes_pole_none": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Halte-Button.svg',
        iconSize: [25, 25],
        iconAnchor: [12, 12],
        className: 'bus-stop-custom-icon'
    }),
    "2_shelter_none_pole_sign": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Rambu-Button.svg',
        iconSize: [25, 25],
        iconAnchor: [12, 12],
        className: 'bus-stop-custom-icon'
    }),
    "3_shelter_none_pole_totem": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Totem-Button.svg',
        iconSize: [25, 25],
        iconAnchor: [12, 12],
        className: 'bus-stop-custom-icon'
    }),
    "4_shelter_none_pole_flag": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Flag-Button.svg',
        iconSize: [25, 25],
        iconAnchor: [12, 12],
        className: 'bus-stop-custom-icon'
    }),
    "5_shelter_yes_pole_sign": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Halte+Rambu-Button.svg',
        iconSize: [25, 25],
        iconAnchor: [12, 12],
        className: 'bus-stop-custom-icon'
    }),
    "6_shelter_yes_pole_totem": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Halte+Totem-Button.svg',
        iconSize: [25, 25],
        iconAnchor: [12, 12],
        className: 'bus-stop-custom-icon'
    }),
    "7_shelter_yes_pole_flag": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Halte+Flag-Button.svg',
        iconSize: [25, 25],
        iconAnchor: [12, 12],
        className: 'bus-stop-custom-icon'
    }),
    "8_shelter_none_pole_none": L.icon({
        iconUrl: 'assets/bus-stop-icon/Bus-Stop-Virtual-Button.svg',
        iconSize: [25, 25],
        iconAnchor: [12, 12],
        className: 'bus-stop-custom-icon'
    })
};

// Load route data independently from routes.json
async function loadRouteData() {
    if (routeDataCache) return routeDataCache;
    
    try {
        const response = await fetch('route-data/routes.json');
        const data = await response.json();
        
        // Create lookup maps
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
        console.log(`Loaded ${Object.keys(routeLookup).length} routes from routes.json`);
        return routeDataCache;
        
    } catch (error) {
        console.error('Failed to load route data:', error);
        return { routeLookup: {}, categoryLookup: {} };
    }
}

// Extract destination from route name (text after arrow)
function extractDestination(routeName) {
    const arrowIndex = routeName.indexOf('→');
    if (arrowIndex !== -1) {
        let destination = routeName.substring(arrowIndex + 1).trim();
        // Clean up any trailing punctuation
        destination = destination.replace(/[.,;:]$/, '').trim();
        return destination;
    }
    
    // Fallback for routes without arrow
    const colonIndex = routeName.indexOf(':');
    if (colonIndex !== -1) {
        return routeName.substring(colonIndex + 1).trim();
    }
    
    return routeName; // Return original if no separator found
}

// Calculate text color for badge based on background color
function getContrastColor(hexColor) {
    // Handle invalid colors
    if (!hexColor || !hexColor.startsWith('#') || hexColor.length !== 7) {
        return '#FFFFFF'; // Default to white on error
    }
    
    try {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        
        // Calculate relative luminance (WCAG formula)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // Return white for dark backgrounds, black for light
        return luminance > 0.6 ? '#000000' : '#FFFFFF';
    } catch (error) {
        console.warn('Error calculating contrast color:', error);
        return '#FFFFFF';
    }
}

// Check if route is currently displayed by looking at sidebar checkboxes
function isRouteDisplayed(relationId) {
    const sidebarCheckbox = document.querySelector(`.route-checkbox[data-relation-id="${relationId}"]`);
    return sidebarCheckbox ? sidebarCheckbox.checked : false;
}

// Sync popup checkbox with sidebar checkbox
function syncWithSidebar(relationId, shouldDisplay) {
    const sidebarCheckbox = document.querySelector(`.route-checkbox[data-relation-id="${relationId}"]`);
    if (sidebarCheckbox && sidebarCheckbox.checked !== shouldDisplay) {
        sidebarCheckbox.checked = shouldDisplay;
        // Trigger the change event to activate route loading/unloading
        sidebarCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// Generate enhanced popup content with routes
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
            
            // Get route reference (number/name)
            let routeRef = routeInfo.ref || '';
            if (!routeRef && routeInfo.name) {
                // Try to extract from name (e.g., "Koridor 1: ..." → "1")
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
    
    // Build HTML structure
    let html = `
        <div class="bus-stop-popup-enhanced">
            <div class="popup-header">
                <h4 style="margin: 0 0 8px 0; color: #00152B; font-size: 1.1rem;">${stopProps.name || 'Halte Tanpa Nama'}</h4>
            </div>
    `;
    
    if (Object.keys(routesByCategory).length > 0) {
        html += `<div class="route-categories" style="max-height: 300px; overflow-y: auto; padding-right: 5px;">`;
        
        Object.entries(routesByCategory).forEach(([categoryName, categoryRoutes]) => {
            html += `
                <div class="category-group" style="margin-bottom: 20px;">
                    <h5 style="margin: 0 0 10px 0; color: #00568E; font-size: 1rem; 
                           border-bottom: 1px solid #eee; padding-bottom: 5px; font-weight: 600;">
                        ${categoryName}
                    </h5>
                    <div class="route-list">
            `;
            
            categoryRoutes.forEach(route => {
                const isActive = isRouteDisplayed(route.relationId);
                
                html += `
                    <div class="route-item" data-relation-id="${route.relationId}" 
                         style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; transition: background-color 0.2s;">
                        <label style="display: flex; align-items: center; cursor: pointer; margin: 0;">
                            <input type="checkbox" 
                                   class="popup-route-checkbox" 
                                   data-relation-id="${route.relationId}"
                                   ${isActive ? 'checked' : ''}
                                   style="margin-right: 10px; cursor: pointer; width: 16px; height: 16px;">
                            <span class="route-badge" 
                                  style="display: inline-flex; align-items: center; justify-content: center; 
                                         min-width: 32px; height: 32px; border-radius: 6px; 
                                         background-color: ${route.color || '#CCCCCC'}; 
                                         color: ${route.textColor}; font-weight: 600; 
                                         font-size: 0.9rem; margin-right: 10px; flex-shrink: 0;
                                         box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                ${route.ref || '?'}
                            </span>
                            <span class="route-destination" style="font-size: 0.95rem; color: #333; line-height: 1.3;">
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
        html += `<div style="text-align: center; padding: 20px 0;">
                    <p style="color: #666; font-style: italic; margin: 0;">Data rute belum tersedia</p>
                 </div>`;
    }
    
    // Add action buttons
    html += `
        <div class="popup-actions" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
            <button class="btn-select-all" 
                    style="background-color: #00A64F; color: white; border: none; border-radius: 25px; 
                           padding: 10px 20px; font-weight: 600; cursor: pointer; font-size: 0.9rem; 
                           margin-right: 10px; transition: background-color 0.3s; flex: 1;">
                Pilih Semua Rute
            </button>
            <button class="btn-close-popup" 
                    style="background-color: transparent; color: #666; border: 1px solid #ddd; 
                           border-radius: 25px; padding: 10px 20px; font-weight: 500; cursor: pointer; 
                           font-size: 0.9rem; transition: all 0.3s; flex: 1;">
                Tutup
            </button>
        </div>
    </div>`;
    
    return html;
}

// Attach event listeners to popup elements
function attachPopupEventListeners() {
    // Handle route checkbox changes
    document.querySelectorAll('.popup-route-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const relationId = this.dataset.relationId;
            
            // Update the visual state immediately
            const routeItem = this.closest('.route-item');
            if (routeItem) {
                if (this.checked) {
                    routeItem.style.backgroundColor = 'rgba(0, 166, 79, 0.05)';
                } else {
                    routeItem.style.backgroundColor = '';
                }
            }
            
            // Sync with sidebar
            syncWithSidebar(relationId, this.checked);
        });
        
        // Add hover effect for better UX
        checkbox.addEventListener('mouseover', function() {
            const routeItem = this.closest('.route-item');
            if (routeItem) {
                routeItem.style.backgroundColor = 'rgba(0, 166, 79, 0.02)';
            }
        });
        
        checkbox.addEventListener('mouseout', function() {
            const routeItem = this.closest('.route-item');
            if (routeItem && !this.checked) {
                routeItem.style.backgroundColor = '';
            }
        });
    });
    
    // "Pilih Semua Rute" button
    const selectAllBtn = document.querySelector('.btn-select-all');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', function() {
            const uncheckedCheckboxes = document.querySelectorAll('.popup-route-checkbox:not(:checked)');
            
            uncheckedCheckboxes.forEach(checkbox => {
                checkbox.checked = true;
                const relationId = checkbox.dataset.relationId;
                const routeItem = checkbox.closest('.route-item');
                
                if (routeItem) {
                    routeItem.style.backgroundColor = 'rgba(0, 166, 79, 0.05)';
                }
                
                syncWithSidebar(relationId, true);
            });
            
            // Button feedback
            this.style.backgroundColor = '#008f43';
            setTimeout(() => {
                this.style.backgroundColor = '#00A64F';
            }, 300);
        });
        
        // Button hover effects
        selectAllBtn.addEventListener('mouseover', function() {
            this.style.backgroundColor = '#008f43';
        });
        
        selectAllBtn.addEventListener('mouseout', function() {
            this.style.backgroundColor = '#00A64F';
        });
    }
    
    // "Tutup" button
    const closeBtn = document.querySelector('.btn-close-popup');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            const popup = document.querySelector('.leaflet-popup');
            if (popup) {
                const closeBtn = popup.querySelector('.leaflet-popup-close-button');
                if (closeBtn) closeBtn.click();
            }
        });
        
        // Button hover effects
        closeBtn.addEventListener('mouseover', function() {
            this.style.backgroundColor = '#f5f5f5';
            this.borderColor = '#ccc';
        });
        
        closeBtn.addEventListener('mouseout', function() {
            this.style.backgroundColor = 'transparent';
            this.borderColor = '#ddd';
        });
    }
}

// Load bus stops with enhanced popups
async function loadBusStops() {
    if (busStopLayer) {
        return busStopLayer;
    }

    try {
        // Load bus stops data
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
            marker.bindPopup('<div style="padding: 20px; text-align: center;"><i class="bi bi-hourglass-split"></i><br>Memuat data rute...</div>', {
                maxWidth: 350,
                minWidth: 250,
                className: 'enhanced-bus-stop-popup'
            });
            
            // Load popup content when opened
            marker.on('popupopen', async function() {
                const popup = this.getPopup();
                try {
                    const content = await generateEnhancedPopup(props);
                    popup.setContent(content);
                    
                    // Attach event listeners after content loads
                    setTimeout(() => attachPopupEventListeners(), 50);
                } catch (error) {
                    console.error('Error loading popup content:', error);
                    popup.setContent('<div style="padding: 20px; text-align: center; color: #666;">Gagal memuat data rute</div>');
                }
            });
            
            busStopLayer.addLayer(marker);
        });

        console.log(`✓ Loaded ${data.features.length} bus stops with enhanced popups`);
        return busStopLayer;
        
    } catch (error) {
        console.error('Failed to load bus stops:', error);
        return L.layerGroup();
    }
}

// Initialize bus stop controls
function initializeBusStopControls() {
    const routeContainer = document.getElementById('route-container');
    if (!routeContainer) {
        console.error('Route container not found');
        return;
    }

    // Create bus stop control section
    const busStopControl = document.createElement('div');
    busStopControl.className = 'bus-stop-control mb-3 p-3 border-bottom bg-light rounded';
    busStopControl.innerHTML = `
        <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="bus-stop-toggle" checked>
            <label class="form-check-label fw-bold" for="bus-stop-toggle">
                <i class="bi bi-geo-alt-fill me-2"></i>Tampilkan Halte Bus
            </label>
        </div>
        <small class="text-muted d-block mt-1">Klik halte untuk melihat rute yang dilayani</small>
        
        <!-- Legend -->
        <div class="bus-stop-legend mt-2" style="font-size: 0.7rem;">
            <div class="legend-item mb-1">
                <span class="legend-color" style="background-color: #2ecc71;"></span>
                Halte dengan bangunan
            </div>
            <div class="legend-item mb-1">
                <span class="legend-color" style="background-color: #3498db;"></span>
                Perhentian dengan rambu tempat pemberhentian bus
            </div>
            <div class="legend-item mb-1">
                <span class="legend-color" style="background-color: #e74c3c;"></span>
                Perhentian dengan signage tipe totem
            </div>
            <div class="legend-item mb-1">
                <span class="legend-color" style="background-color: #f39c12;"></span>
                Perhentian dengan signage tipe flag
            </div>
            <div class="legend-item mb-1">
                <span class="legend-color" style="background-color: #95a5a6;"></span>
                Perhentian virtual, tanpa bangunan halte atau rambu
            </div>
        </div>
    `;
    
    // Insert at the top of the route container
    routeContainer.insertBefore(busStopControl, routeContainer.firstChild);
    
    busStopCheckbox = document.getElementById('bus-stop-toggle');
    
    // Load bus stops and set up event handlers
    loadBusStops().then(layer => {
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
    // Wait for map to be initialized
    const checkMap = setInterval(() => {
        if (typeof map !== 'undefined') {
            clearInterval(checkMap);
            // Wait a bit more for route initialization
            setTimeout(() => {
                initializeBusStopControls();
            }, 1000);
        }
    }, 100);
});
