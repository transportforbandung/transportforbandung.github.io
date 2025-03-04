// TESTING PHASE. PLEASE CHANGE "relationIds" to "relationId" AFTER TESTING COMPLETED.
// Declare a global object to track active routes
let activeRoutes = {};

// Modified function to load local GeoJSON data
function fetchRouteData(relationId, displayType, routeColor) {
    return new Promise((resolve, reject) => {
        const layerGroup = L.layerGroup();

        // Paths to local GeoJSON files (modify according to your structure)
        const basePath = `/data/${relationId}`;
        
        // Load ways data
        fetch(`${basePath}/ways.geojson`)
            .then(response => response.json())
            .then(waysData => {
                // Process ways data
                waysData.features.forEach(feature => {
                    if (feature.geometry.type === "LineString") {
                        L.polyline(feature.geometry.coordinates.map(coord => [coord[1], coord[0]]), {
                            color: routeColor,
                            weight: 4
                        }).addTo(layerGroup);
                    }
                });

                // Load stop data based on display type
                const stopFile = displayType === "ways_with_points" ? 
                    "stops.geojson" : 
                    "endstops.geojson";
                
                fetch(`${basePath}/${stopFile}`)
                    .then(response => response.json())
                    .then(stopsData => {
                        // Process stop data
                        stopsData.features.forEach(feature => {
                            if (feature.geometry.type === "Point") {
                                const coords = feature.geometry.coordinates;
                                const marker = L.circleMarker([coords[1], coords[0]], {
                                    radius: 5,
                                    color: routeColor,
                                    fillColor: "#ffffff",
                                    fillOpacity: 1
                                });
                                
                                if (feature.properties.name) {
                                    marker.bindPopup(feature.properties.name);
                                } else {
                                    marker.bindPopup("Unnamed Stop");
                                }
                                marker.addTo(layerGroup);
                            }
                        });
                        
                        resolve(layerGroup);
                    })
                    .catch(error => reject(error));
            })
            .catch(error => reject(error));
    });
}

// Keep the existing event listener unchanged
document.querySelector('.map-checkbox-menu').addEventListener('change', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
        const { relationId, displayType, routeColor } = e.target.dataset;

        if (e.target.checked) {
            if (!activeRoutes[relationId]) {
                fetchRouteData(relationId, displayType, routeColor)
                    .then(layerGroup => {
                        activeRoutes[relationId] = layerGroup;
                        layerGroup.addTo(map);
                    })
                    .catch(error => console.error("Error loading route data:", error));
            } else {
                activeRoutes[relationId].addTo(map);
            }
        } else {
            if (activeRoutes[relationId]) {
                activeRoutes[relationId].remove();
            }
        }
    }
});
