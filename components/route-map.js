// route-map.js
let activeRoutes = new Map(); // Use Map for better performance

// Local data version (neo)
function fetchLocalRoute(relationId, displayType, routeColor) {
    return new Promise((resolve, reject) => {
        const layerGroup = L.layerGroup();
        const basePath = `data/${relationId}`;

        // Use Promise.all for parallel requests
        Promise.all([
            fetch(`${basePath}/ways.geojson`),
            fetch(`${basePath}/${displayType === "ways_with_points" ? "stops" : "endstops"}.geojson`)
        ]).then(async ([waysResponse, stopsResponse]) => {
            if (!waysResponse.ok || !stopsResponse.ok) throw new Error('Local files not found');
            
            const [waysData, stopsData] = await Promise.all([
                waysResponse.json(),
                stopsResponse.json()
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

            resolve(layerGroup);
        }).catch(reject);
    });
}

// Overpass API version (optimized queries)
function fetchOverpassRoute(relationId, displayType, routeColor) {
    return new Promise((resolve, reject) => {
        const layerGroup = L.layerGroup();
        const stopQuery = displayType === "ways_with_points" ? 
            `node(r:"stop"),node(r:"stop_entry_only"),node(r:"stop_exit_only")` : 
            `node(r:"stop_entry_only"),node(r:"stop_exit_only")`;

        const query = `[out:json];
            relation(${relationId});
            way(r);>;out geom;
            ${stopQuery};out geom;`;

        fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                data.elements.forEach(element => {
                    if (element.type === "way" && element.geometry) {
                        L.polyline(element.geometry.map(p => [p.lat, p.lon]), {
                            color: routeColor,
                            weight: 4
                        }).addTo(layerGroup);
                    }
                    else if (element.type === "node") {
                        L.circleMarker([element.lat, element.lon], {
                            radius: 5,
                            color: routeColor,
                            fillColor: "#ffffff",
                            fillOpacity: 1
                        }).bindPopup(element.tags?.name || "Unnamed Stop")
                        .addTo(layerGroup);
                    }
                });
                resolve(layerGroup);
            }).catch(reject);
    });
}
