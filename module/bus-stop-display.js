// module/bus-stop-display.js
let busStopLayer = null;
let busStopCheckbox = null;
let routeDataCache = null;

// Updated icon configurations
const busStopIcon = L.icon({
    iconUrl: 'assets/bus-stop-icon/Bus-Stop.svg',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    className: 'bus-stop-custom-icon'
});

// Load route data
async function loadRouteData() {
    if (routeDataCache) return routeDataCache;
    
    try {
        const response = await fetch('route-data/routes.json');
        const data = await response.json();
        
        const routeLookup = {};
        const categoryLookup = {};
        const categoryOrder = []; // NEW: Store category order from routes.json
        
        // Store categories in the order they appear in routes.json
        data.categories.forEach((category, index) => {
            categoryOrder.push({
                name: category.name,
                order: index
            });
            
            category.routes.forEach(route => {
                routeLookup[route.relationId] = {
                    ...route,
                    categoryName: category.name,
                    categoryOrder: index // Add category order to each route
                };
                
                if (!categoryLookup[category.name]) {
                    categoryLookup[category.name] = [];
                }
                categoryLookup[category.name].push(route.relationId);
            });
        });
        
        routeDataCache = { 
            routeLookup, 
            categoryLookup,
            categoryOrder // NEW: Store the order
        };
        console.log(`Loaded ${Object.keys(routeLookup).length} routes, ${categoryOrder.length} categories`);
        return routeDataCache;
        
    } catch (error) {
        console.error('Failed to load route data:', error);
        return { routeLookup: {}, categoryLookup: {}, categoryOrder: [] };
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

// Generate enhanced popup with proper category and route ordering
async function generateEnhancedPopup(stopProps) {
    const routeData = await loadRouteData();
    const routes = stopProps.routes || [];
    
    // Get category from stop properties
    const category = stopProps.category || "8_shelter_none_pole_none";
    
    // Determine if it has shelter based on category
    const hasShelter = category.includes('shelter_yes');
    
    // Map category to icon path (same as busStopIcons)
    const getIconPath = (category) => {
        const iconMap = {
            "1_shelter_yes_pole_none": 'assets/bus-stop-icon/Bus-Stop-Halte-Button.svg',
            "2_shelter_none_pole_sign": 'assets/bus-stop-icon/Bus-Stop-Rambu-Button.svg',
            "3_shelter_none_pole_totem": 'assets/bus-stop-icon/Bus-Stop-Totem-Button.svg',
            "4_shelter_none_pole_flag": 'assets/bus-stop-icon/Bus-Stop-Flag-Button.svg',
            "5_shelter_yes_pole_sign": 'assets/bus-stop-icon/Bus-Stop-Halte+Rambu-Button.svg',
            "6_shelter_yes_pole_totem": 'assets/bus-stop-icon/Bus-Stop-Halte+Totem-Button.svg',
            "7_shelter_yes_pole_flag": 'assets/bus-stop-icon/Bus-Stop-Halte+Flag-Button.svg',
            "8_shelter_none_pole_none": 'assets/bus-stop-icon/Bus-Stop-Virtual-Button.svg'
        };
        return iconMap[category] || iconMap["8_shelter_none_pole_none"];
    };
    
    // Function to get facility icon based on value
    const getFacilityIcon = (value, type) => {
        let iconSVG, color, text;
        if (value === 'yes') {
            color = '#28a745';
            text = 'Ya';
            
            if (type === 'bench') {
                iconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#28a745">
                <path d="M2 15v-2c0-1.1.9-2 2-2h16a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1zm16-8H6a2 2 0 0 0-2 2v2h16V9a2 2 0 0 0-2-2zm-2 6H4v2h12v-2z"/>
                </svg>`;
            } else if (type === 'bin') {
                iconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#28a745">
                <path d="M3 6h18v2H3V6zm2 2v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5zm3 2h8v9H8v-9zm8-5V3a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v2H5v2h14V5h-3z"/>
                </svg>`;
            } else if (type === 'lit') {
                iconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#28a745">
                <path d="M12 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm9 9h-1a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2zM4 12a1 1 0 0 1-1-1v-1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1zm7 7a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1zm6.95-2.535a1 1 0 0 1-1.414-1.414l.707-.707a1 1 0 1 1 1.414 1.414l-.707.707zM7.05 7.05a1 1 0 0 1 0-1.414l.707-.707a1 1 0 1 1 1.414 1.414l-.707.707a1 1 0 0 1-1.414 0zM16.95 16.95a1 1 0 0 1-1.414 0l-.707-.707a1 1 0 1 1 1.414-1.414l.707.707a1 1 0 0 1 0 1.414zM5.636 16.95a1 1 0 0 1-1.414-1.414l.707-.707a1 1 0 1 1 1.414 1.414l-.707.707zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
                </svg>`;
            } else {
                // Default check mark for unknown type
                iconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
                </svg>`;
            }    
        } else if (value === 'no') {
            color = '#dc3545';
            text = 'Tidak';
            if (type === 'bench') {
                iconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#dc3545">
                <path d="M2 15v-2c0-1.1.9-2 2-2h16a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1zm16-8H6a2 2 0 0 0-2 2v2h16V9a2 2 0 0 0-2-2zm-2 6H4v2h12v-2z" opacity="0.3"/>
                <line x1="4" y1="4" x2="20" y2="20" stroke="#dc3545" stroke-width="2"/>
                </svg>`;
            } else if (type === 'bin') {
                iconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#dc3545">
                <path d="M3 6h18v2H3V6zm2 2v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5zm3 2h8v9H8v-9zm8-5V3a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v2H5v2h14V5h-3z" opacity="0.3"/>
                <line x1="4" y1="4" x2="20" y2="20" stroke="#dc3545" stroke-width="2"/>
                </svg>`;
            } else if (type === 'lit') {
                iconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#dc3545">
                <path d="M12 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm9 9h-1a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2zM4 12a1 1 0 0 1-1-1v-1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1zm7 7a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1zm6.95-2.535a1 1 0 0 1-1.414-1.414l.707-.707a1 1 0 1 1 1.414 1.414l-.707.707zM7.05 7.05a1 1 0 0 1 0-1.414l.707-.707a1 1 0 1 1 1.414 1.414l-.707.707a1 1 0 0 1-1.414 0zM16.95 16.95a1 1 0 0 1-1.414 0l-.707-.707a1 1 0 1 1 1.414-1.414l.707.707a1 1 0 0 1 0 1.414zM5.636 16.95a1 1 0 0 1-1.414-1.414l.707-.707a1 1 0 1 1 1.414 1.414l-.707.707zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" opacity="0.3"/>
                <line x1="4" y1="4" x2="20" y2="20" stroke="#dc3545" stroke-width="2"/>
                </svg>`;
            } else {
                // Default X mark for unknown type
                iconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>`;
            }      
        } else {
            // null, undefined, or unknown
            color = '#6c757d';
            text = '?';
            
            if (type === 'bench') {
                iconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#6c757d" opacity="0.5">
                <path d="M2 15v-2c0-1.1.9-2 2-2h16a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1zm16-8H6a2 2 0 0 0-2 2v2h16V9a2 2 0 0 0-2-2zm-2 6H4v2h12v-2z"/>
                </svg>`;
            } else if (type === 'bin') {
                iconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#6c757d" opacity="0.5">
                <path d="M3 6h18v2H3V6zm2 2v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5zm3 2h8v9H8v-9zm8-5V3a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v2H5v2h14V5h-3z"/>
                </svg>`;
            } else if (type === 'lit') {
                iconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#6c757d" opacity="0.5">
                <path d="M12 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm9 9h-1a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2zM4 12a1 1 0 0 1-1-1v-1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1zm7 7a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1zm6.95-2.535a1 1 0 0 1-1.414-1.414l.707-.707a1 1 0 1 1 1.414 1.414l-.707.707zM7.05 7.05a1 1 0 0 1 0-1.414l.707-.707a1 1 0 1 1 1.414 1.414l-.707.707a1 1 0 0 1-1.414 0zM16.95 16.95a1 1 0 0 1-1.414 0l-.707-.707a1 1 0 1 1 1.414-1.414l.707.707a1 1 0 0 1 0 1.414zM5.636 16.95a1 1 0 0 1-1.414-1.414l.707-.707a1 1 0 1 1 1.414 1.414l-.707.707zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
                </svg>`;
            } else {
                // Default question mark for unknown type
                iconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>`;
            }
        }
        return {
            icon: iconSVG,
            color: color,
            text: text
        };
    };
    // Get facility data
    const benchData = getFacilityIcon(stopProps.bench, 'bench');
    const binData = getFacilityIcon(stopProps.bin, 'bin');
    const litData = getFacilityIcon(stopProps.lit, 'lit');
    
    // Group routes by category while preserving order
    const routesByCategory = {};
    
    // First, let's process each route ID from the bus stop
    routes.forEach(relationId => {
        // Try to find this route in our route data
        const routeInfo = routeData.routeLookup[relationId];
        
        if (routeInfo) {
            // Route found in our data
            const categoryName = routeInfo.categoryName || 'Lainnya';
            if (!routesByCategory[categoryName]) {
                routesByCategory[categoryName] = [];
            }
            let routeRef = routeInfo.ref || '';
            if (!routeRef && routeInfo.name) {
                const match = routeInfo.name.match(/^(?:Koridor|Corridor|Rute|Route)?\s*(\w+)/i);
                routeRef = match ? match[1] : '';
            }
            routesByCategory[categoryName].push({
                ...routeInfo,
                relationId,
                ref: routeRef,
                destination: extractDestination(routeInfo.name),
                textColor: getContrastColor(routeInfo.color || '#CCCCCC')
            });
        } else {
            // Route not found in our data - put in "Lainnya"
            const categoryName = 'Lainnya';
            if (!routesByCategory[categoryName]) {
                routesByCategory[categoryName] = [];
            }
            
            routesByCategory[categoryName].push({
                relationId,
                ref: '?',
                name: `Rute ${relationId}`,
                destination: `Rute ${relationId}`,
                color: '#CCCCCC',
                textColor: getContrastColor('#CCCCCC'),
                categoryName: 'Lainnya'
            });
        }
    });
    
    // Start building the HTML with the new two-column header
    let html = `
        <div class="bus-stop-popup-enhanced">
            <!-- New Two-Column Header -->
            <div class="popup-header" style="margin-bottom: 12px;">
                <div style="display: flex; align-items: stretch; min-height: 60px;">
                    <!-- Column 1: Icon (spans both rows) -->
                    <div style="flex: 0 0 60px; display: flex; align-items: center; justify-content: center; 
                         padding: 8px; background: #f8f9fa; border-radius: 8px 0 0 8px; border-right: 1px solid #e9ecef;">
                        <img src="${getIconPath(category)}" 
                             alt="Bus stop icon" 
                             style="width: 40px; height: 40px; object-fit: contain;">
                    </div>
                    
                    <!-- Column 2: Text (two rows) -->
                    <div style="flex: 1; padding: 8px 12px; background: #f8f9fa; border-radius: 0 8px 8px 0;
                         display: flex; flex-direction: column; justify-content: center;">
                        <!-- Row 1: HALTE/PERHENTIAN -->
                        <div style="font-size: 11px; color: #6c757d; font-weight: 600; 
                             text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
                            ${hasShelter ? 'HALTE' : 'PERHENTIAN'}
                        </div>
                        <!-- Row 2: Bus stop name -->
                        <div style="font-size: 16px; color: #00152B; font-weight: 700; line-height: 1.2;">
                            ${stopProps.name || 'Halte Tanpa Nama'}
                        </div>
                    </div>
                </div>
                
                <!-- Facility Information Grid -->
                <div class="facility-info" style="margin-top: 12px; background: #f8f9fa; border-radius: 8px; padding: 12px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <!-- First Column (Bench and Bin) -->
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <!-- Bench -->
                            <div style="display: flex; align-items: center;">
                                <span style="font-size: 16px; margin-right: 8px; color: ${benchData.color};">
                                    ${benchData.icon}
                                </span>
                                <span style="font-size: 12px; color: #333;">Bangku</span>
                                <span style="margin-left: auto; font-size: 11px; color: ${benchData.color};">
                                    ${benchData.text}
                                </span>
                            </div>
                            
                            <!-- Bin -->
                            <div style="display: flex; align-items: center;">
                                <span style="font-size: 16px; margin-right: 8px; color: ${binData.color};">
                                    ${binData.icon}
                                </span>
                                <span style="font-size: 12px; color: #333;">Tempat Sampah</span>
                                <span style="margin-left: auto; font-size: 11px; color: ${binData.color};">
                                    ${binData.text}
                                </span>
                            </div>
                        </div>
                        
                        <!-- Second Column (Lighting - spans both rows) -->
                        <div style="display: flex; align-items: center; justify-content: center;
                             border-left: 1px solid #e0e0e0; padding-left: 12px;">
                            <div style="text-align: center;">
                                <div style="font-size: 20px; color: ${litData.color}; margin-bottom: 4px;">
                                    ${litData.icon}
                                </div>
                                <div style="font-size: 11px; color: #333; margin-bottom: 2px;">
                                    Penerangan
                                </div>
                                <div style="font-size: 10px; color: ${litData.color};">
                                    ${litData.text}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Route count below facilities -->
                    <div style="text-align: center; margin-top: 12px; padding-top: 8px; border-top: 1px solid #e0e0e0;">
                        <span style="font-size: 11px; color: #666;">
                            Melayani <strong>${routes.length}</strong> rute
                        </span>
                    </div>
                </div>
            </div>
    `;
    
    // Now we need to sort the routes within each category by their original order
    // First, let's create a map to track category order
    const categoryOrderMap = new Map();
    routeData.categoryOrder.forEach((cat, index) => {
        categoryOrderMap.set(cat.name, index);
    });
    
    // Sort categories based on routes.json order
    const sortedCategories = Object.keys(routesByCategory)
        .filter(categoryName => routesByCategory[categoryName].length > 0)
        .sort((a, b) => {
            const orderA = categoryOrderMap.has(a) ? categoryOrderMap.get(a) : 9999;
            const orderB = categoryOrderMap.has(b) ? categoryOrderMap.get(b) : 9999;
            return orderA - orderB;
        });
    
    if (sortedCategories.length > 0) {
        html += `<div class="route-categories" style="max-height: 280px; overflow-y: auto; padding-right: 4px;">`;
        
        // Display categories in the correct order
        sortedCategories.forEach(categoryName => {
            const categoryRoutes = routesByCategory[categoryName];
            
            html += `
                <div class="category-group" style="margin-bottom: 16px;">
                    <h5 style="margin: 0 0 8px 0; color: #00568E; font-size: 0.9rem; 
                           border-bottom: 1px solid #eee; padding-bottom: 4px; font-weight: 600;">
                        ${categoryName}
                    </h5>
                    <div class="route-list">
            `;
            
            // Display routes for this category
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
    
    html += `</div>`;
    
    return html;
}

// Simple event handler for checkbox changes
function setupCheckboxEvents() {
    // Use event delegation for checkbox changes
    document.addEventListener('change', function(e) {
        if (e.target && e.target.classList.contains('popup-route-checkbox')) {
            const checkbox = e.target;
            const relationId = checkbox.dataset.relationId;
            
            // Update visual state
            const routeItem = checkbox.closest('.route-item');
            if (routeItem) {
                routeItem.style.backgroundColor = checkbox.checked ? 'rgba(0, 166, 79, 0.05)' : '';
            }
            
            // Sync with sidebar
            const sidebarCheckbox = document.querySelector(`.route-checkbox[data-relation-id="${relationId}"]`);
            if (sidebarCheckbox && sidebarCheckbox.checked !== checkbox.checked) {
                sidebarCheckbox.checked = checkbox.checked;
                sidebarCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    });
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
            
            // Use the single icon for all markers
            const marker = L.marker([coords[1], coords[0]], {
                icon: busStopIcon  // Use the single icon object directly
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
                } catch (error) {
                    popup.setContent('<div style="padding: 15px; text-align: center; color: #666; font-size: 0.85rem;">Gagal memuat data</div>');
                }
            });
            
            busStopLayer.addLayer(marker);
        });

        console.log(`✓ Loaded ${data.features.length} bus stops with single icon`);
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

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Set up checkbox event delegation
    setupCheckboxEvents();
    
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
