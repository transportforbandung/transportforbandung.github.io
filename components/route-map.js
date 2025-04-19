// components/route-map.js
let activeRoutes = {};
let routeLayer;

// Initialize routes after map is ready
function initRoutes() {
    // Clear existing content first
    const container = document.getElementById('route-container');
    container.innerHTML = '';

    // Initialize collapsibles
    initializeCollapsibles();
    
    // Load route data
    initializeRoutes().catch(error => {
        console.error('Route initialization failed:', error);
    });
}

function initializeCollapsibles() {
    document.addEventListener('click', (e) => {
        const header = e.target.closest('.route-map-collapsible-bar');
        if (header) {
            const content = header.nextElementSibling;
            const arrow = header.querySelector('.route-map-collapsible-bar-arrow');
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
            arrow.style.transform = content.style.display === 'none' ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    });
}

async function initializeRoutes() {
    try {
        const response = await fetch('data/routes.json');
        const { categories } = await response.json();
        const container = document.getElementById('route-container');

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
                            </label>
                        `).join('')}
                    </div>
                </div>`;
            container.insertAdjacentHTML('beforeend', categoryHTML);
        });

        setupCheckboxHandlers();
    } catch (error) {
        console.error('Error initializing routes:', error);
        throw error;
    }
}

function setupCheckboxHandlers() {
    document.querySelector('.map-checkbox-menu').addEventListener('change', async (e) => {
        if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
            const dataset = e.target.dataset;
            const id = dataset.relationId;
            const { displayType, routeColor } = dataset;

            if (!id) return;

            if (e.target.checked) {
                if (!activeRoutes[id]) {
                    try {
                        let layerGroup = await fetchLocalRoute(id, displayType, routeColor);
                        if (!layerGroup) {
                            layerGroup = await fetchOverpassRoute(id, displayType, routeColor);
                        }
                        activeRoutes[id] = layerGroup.addTo(map);
                    } catch (error) {
                        console.error("Error loading route:", error);
                        e.target.checked = false;
                    }
                } else {
                    activeRoutes[id].addTo(map);
                }
            } else {
                activeRoutes[id]?.remove();
            }
        }
    });
}

// Local data fetcher
async function fetchLocalRoute(relationId, displayType, routeColor) {
    try {
        const layerGroup = L.layerGroup();
        const basePath = `data/${relationId}`;
        
        const [waysData, stopsData] = await Promise.all([
            fetch(`${basePath}/ways.geojson`).then(res => res.json()),
            fetch(`${basePath}/${displayType === "ways_with_points" ? "stops" : "endstops"}.geojson`).then(res => res.json())
        ]);

        // Process ways
        waysData.features.forEach(feature => {
            if (feature.geometry.type === "LineString") {
                L.polyline(feature.geometry.coordinates.map(coord => [coord[1], coord[0]]), {
                    color: routeColor,
                    weight: 4
                }).addTo(layerGroup);
            }
        });

        // Process stops
        stopsData.features.forEach(feature => {
            if (feature.geometry.type === "Point") {
                const coords = feature.geometry.coordinates;
                const marker = L.circleMarker([coords[1], coords[0]], {
                    radius: 5,
                    color: routeColor,
                    fillColor: "#ffffff",
                    fillOpacity: 1
                }).bindPopup(feature.properties?.name || "Unnamed Stop");
                marker.addTo(layerGroup);
            }
        });

        return layerGroup;
    } catch (error) {
        console.warn(`Local data not found for ${relationId}`);
        return null;
    }
}

// Overpass API fetcher
async function fetchOverpassRoute(relationId, displayType, routeColor) {
    try {
        const layerGroup = L.layerGroup();
        const queries = {
            way: `[out:json];relation(${relationId});(way(r);>;);out geom;`,
            stop: `[out:json];relation(${relationId});node(r:"stop");out geom;relation(${relationId});node(r:"stop_entry_only");out geom;relation(${relationId});node(r:"stop_exit_only");out geom;`
        };

        const [waysResponse, stopsResponse] = await Promise.all([
            fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(queries.way)}`),
            fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(queries.stop)}`)
        ]);

        const [waysData, stopsData] = await Promise.all([
            waysResponse.json(),
            stopsResponse.json()
        ]);

        // Process ways
        waysData.elements.forEach(element => {
            if (element.type === "way" && element.geometry) {
                L.polyline(element.geometry.map(p => [p.lat, p.lon]), {
                    color: routeColor,
                    weight: 4
                }).addTo(layerGroup);
            }
        });

        // Process stops
        stopsData.elements.forEach(element => {
            if (element.type === "node") {
                L.circleMarker([element.lat, element.lon], {
                    radius: 5,
                    color: routeColor,
                    fillColor: "#ffffff",
                    fillOpacity: 1
                }).bindPopup(element.tags?.name || "Unnamed Stop").addTo(layerGroup);
            }
        });

        return layerGroup;
    } catch (error) {
        console.error("Overpass API error:", error);
        throw error;
    }
}

// Cache cleanup
setInterval(() => {
    Object.keys(activeRoutes).forEach(id => {
        if (!document.querySelector(`input[data-relation-id="${id}"]:checked`)) {
            activeRoutes[id]?.remove();
            delete activeRoutes[id];
        }
    });
}, 3600000); // Cleanup hourly
