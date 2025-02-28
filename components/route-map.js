// Function to fetch and display a specific route
function displayRoute(relationId, displayType, routeColor) {
    // Ensure routeLayer is cleared before adding new data
    routeLayer.clearLayers();

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
                }).addTo(routeLayer);
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
                            L.circleMarker([node.lat, node.lon], {
                                radius: 5,
                                color: routeColor,
                                fillColor: "#ffffff",
                                fillOpacity: 1
                            }).addTo(routeLayer);
                        });
                    }
                })
                .catch(error => console.error("Error fetching stop nodes:", error));
        })
        .catch(error => console.error("Error fetching ways:", error));
}

// Event listener for dropdown
document.getElementById("routeSelector").addEventListener("change", (e) => {
    const selectedOption = e.target.options[e.target.selectedIndex];
    if (!selectedOption.value) return;

    const relationId = selectedOption.dataset.relationId;
    const displayType = selectedOption.dataset.displayType;
    const routeColor = selectedOption.dataset.routeColor || "#3388ff"; // Default color

    displayRoute(relationId, displayType, routeColor);
});
