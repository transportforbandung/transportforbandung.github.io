// Combined route-map.js
let activeRoutes = {};

// Local data version (neo)
function fetchLocalRoute(relationIds, displayType, routeColor) {
    return new Promise((resolve, reject) => {
        const layerGroup = L.layerGroup();
        const basePath = `data/${relationIds}`;

        fetch(`${basePath}/ways.geojson`)
            .then(response => response.json())
            .then(waysData => {
                waysData.features.forEach(feature => {
                    if (feature.geometry.type === "LineString") {
                        L.polyline(feature.geometry.coordinates.map(coord => [coord[1], coord[0]]), {
                            color: routeColor,
                            weight: 4
                        }).addTo(layerGroup);
                    }
                });

                const stopFile = displayType === "ways_with_points" ? 
                    "stops.geojson" : 
                    "endstops.geojson";
                
                fetch(`${basePath}/${stopFile}`)
                    .then(response => response.json())
                    .then(stopsData => {
                        stopsData.features.forEach(feature => {
                            if (feature.geometry.type === "Point") {
                                const coords = feature.geometry.coordinates;
                                const marker = L.circleMarker([coords[1], coords[0]], {
                                    radius: 5,
                                    color: routeColor,
                                    fillColor: "#ffffff",
                                    fillOpacity: 1
                                });
                                
                                marker.bindPopup(feature.properties?.name || "Unnamed Stop");
                                marker.addTo(layerGroup);
                            }
                        });
                        resolve(layerGroup);
                    })
                    .catch(reject);
            })
            .catch(reject);
    });
}

// Overpass API version (original)
function fetchOverpassRoute(relationId, displayType, routeColor) {
    return new Promise((resolve, reject) => {
        const layerGroup = L.layerGroup();
        const queries = {
            way: `[out:json];relation(${relationId});(way(r);>;);out geom;`,
            stop: `[out:json];relation(${relationId});node(r:"stop");out geom;node(r:"stop_entry_only");out geom;node(r:"stop_exit_only");out geom;`,
            endStop: `[out:json];relation(${relationId});node(r:"stop_entry_only");out geom;node(r:"stop_exit_only");out geom;`
        };

        fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(queries.way)}`)
            .then(response => response.json())
            .then(data => {
                data.elements.forEach(element => {
                    if (element.type === "way" && element.geometry) {
                        L.polyline(element.geometry.map(p => [p.lat, p.lon]), {
                            color: routeColor,
                            weight: 4
                        }).addTo(layerGroup);
                    }
                });

                const stopQuery = displayType === "ways_with_points" ? queries.stop : queries.endStop;
                fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(stopQuery)}`)
                    .then(response => response.json())
                    .then(data => {
                        data.elements.forEach(element => {
                            if (element.type === "node") {
                                const marker = L.circleMarker([element.lat, element.lon], {
                                    radius: 5,
                                    color: routeColor,
                                    fillColor: "#ffffff",
                                    fillOpacity: 1
                                });
                                marker.bindPopup(element.tags?.name || "Unnamed Stop");
                                marker.addTo(layerGroup);
                            }
                        });
                        resolve(layerGroup);
                    })
                    .catch(reject);
            })
            .catch(reject);
    });
}

// Unified event handler
document.querySelector('.map-checkbox-menu').addEventListener('change', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
        const dataset = e.target.dataset;
        const isLocal = 'relationIds' in dataset;
        const id = dataset.relationIds || dataset.relationId;
        const { displayType, routeColor } = dataset;

        if (!id) return;

        if (e.target.checked) {
            if (!activeRoutes[id]) {
                const fetchFunction = isLocal ? fetchLocalRoute : fetchOverpassRoute;
                fetchFunction(id, displayType, routeColor)
                    .then(layerGroup => {
                        activeRoutes[id] = layerGroup.addTo(map);
                    })
                    .catch(error => console.error("Error loading route:", error));
            } else {
                activeRoutes[id].addTo(map);
            }
        } else {
            activeRoutes[id]?.remove();
        }
    }
});
