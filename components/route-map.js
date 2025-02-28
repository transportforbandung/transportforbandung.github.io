// route-map.js
// Function to fetch and display a specific route
function displayRoute(relationId, displayType, routeColor) {
    routeLayer.clearLayers();

    // Overpass query to fetch relation, ways, and platform nodes
    const query = `
        [out:json];
        relation(${relationId});
        (way(r);>;);
        out geom;
        node(r:"platform");
        out geom;
    `;

    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            const ways = [];
            const platformNodes = [];

            // Separate ways and platform nodes
            data.elements.forEach(element => {
                if (element.type === "way" && element.geometry) {
                    ways.push(element);
                }
                if (element.type === "node" && element.tags && element.tags.public_transport === "platform") {
                    platformNodes.push(element);
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

            // Draw platform nodes (if enabled)
            if (displayType === "ways_with_points") {
                platformNodes.forEach(node => {
                    L.circleMarker([node.lat, node.lon], {
                        radius: 5,
                        color: routeColor,
                        fillColor: "#ffffff",
                        fillOpacity: 1
                    }).addTo(routeLayer);
                });
            }
        })
        .catch(error => console.error("Error fetching data:", error));
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
