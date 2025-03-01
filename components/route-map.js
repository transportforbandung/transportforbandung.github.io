// Declare a global object to track active routes
let activeRoutes = {};

// Function to fetch and return a route layer group
function fetchRouteData(relationId, displayType, routeColor) {
    return new Promise((resolve, reject) => {
        const layerGroup = L.layerGroup();

        // Overpass query to fetch ways
        const queryWay = `
            [out:json];
            relation(${relationId});
            (way(r);>;);
            out geom;
        `;

        // Overpass query to fetch stop nodes
        const queryStop = `
            [out:json];
            relation(${relationId});
            node(r:"stop");
            out geom;
            relation(${relationId});
            node(r:"stop_entry_only");
            out geom;
            relation(${relationId});
            node(r:"stop_exit_only");
            out geom;
        `;

        // Fetch ways
        fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(queryWay)}`)
            .then(response => response.json())
            .then(data => {
                const ways = [];

                // Extract ways
                data.elements.forEach(element => {
                    if (element.type === "way" && element.geometry) {
                        ways.push(element);
                    }
                });

                // Draw ways
                ways.forEach(way => {
                    const coords = way.geometry.map(p => [p.lat, p.lon]);
                    L.polyline(coords, {
                        color: routeColor,
                        weight: 4
                    }).addTo(layerGroup);
                });

                // Fetch stop nodes after ways are drawn
                fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(queryStop)}`)
                    .then(response => response.json())
                    .then(data => {
                        const stopNodes = [];

                        // Extract stop nodes
                        data.elements.forEach(element => {
                            if (element.type === "node") {
                                stopNodes.push(element);
                            }
                        });

                        // Draw stop nodes (if enabled)
                        if (displayType === "ways_with_points") {
                            stopNodes.forEach(node => {
                                // Create a circle marker for the node
                                const marker = L.circleMarker([node.lat, node.lon], {
                                    radius: 5,
                                    color: routeColor,
                                    fillColor: "#ffffff",
                                    fillOpacity: 1
                                }).addTo(layerGroup);

                                // Add a popup with the node's name (if available)
                                if (node.tags?.name) {
                                    marker.bindPopup(node.tags.name); // Bind the name as a popup
                                } else {
                                    marker.bindPopup("Unnamed Stop"); // Default text if no name is available
                                }
                            });
                        }

                        resolve(layerGroup); // Resolve the promise with the layer group
                    })
                    .catch(error => reject(error));
            })
            .catch(error => reject(error));
    });
}

// Event listener for checkbox changes
document.querySelector('.map-checkbox-menu').addEventListener('change', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
        const { relationId, displayType, routeColor } = e.target.dataset;

        if (e.target.checked) {
            // If the route is not already loaded, fetch and display it
            if (!activeRoutes[relationId]) {
                fetchRouteData(relationId, displayType, routeColor)
                    .then(layerGroup => {
                        activeRoutes[relationId] = layerGroup; // Cache the layer group
                        layerGroup.addTo(map); // Add the layer group to the map
                    })
                    .catch(error => console.error("Error fetching route data:", error));
            } else {
                // If the route is already loaded, just add it to the map
                activeRoutes[relationId].addTo(map);
            }
        } else {
            // If the checkbox is unchecked, remove the route from the map
            if (activeRoutes[relationId]) {
                activeRoutes[relationId].remove();
            }
        }
    }
});

// document.getElementById("routeSelector").removeEventListener("change", ...);
