// route-map.js
// Function to fetch and display a specific route
function displayRoute(relationId, displayType, routeColor) {
    routeLayer.clearLayers();

    const query = `
        relation(14270173);
        (way(r);>;);
        out geom;
        node(r:"stop");
        out geom;
    `;

    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            const ways = [];
            const stopNodes = [];

            // Separate ways and stop nodes
            data.elements.forEach(element => {
                if (element.type === "way" && element.geometry) {
                    ways.push(element);
                } else if (element.type === "node" && element.role === "stop") {
                    stopNodes.push(element);
                }
            });

            // Draw ways
            ways.forEach(way => {
                L.polyline(
                    way.geometry.map(p => [p.lat, p.lon]),
                    { color: routeColor, weight: 4 }
                ).addTo(routeLayer);
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
