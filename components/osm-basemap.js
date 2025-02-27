// Initialize the map
function initMap() {
    // Create map
    const map = L.map('map').setView([-6.9104, 107.6183], 12);

    // Add OpenStreetMap base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Optional: Add a marker
    //L.marker([-6.9104, 107.6183])
        //.addTo(map)
        //.bindPopup('Hello')
        //.openPopup();
}

// Initialize the map when page loads
window.onload = initMap;
