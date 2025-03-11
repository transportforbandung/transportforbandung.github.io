document.addEventListener('DOMContentLoaded', () => {
    const routedownloadBtn = document.getElementById('routedownloadBtn');
    const routeOptions = document.querySelectorAll('.route-download-option input');

    // Verify available routes
    routeOptions.forEach(option => {
        const relationId = option.dataset.relationId;
        const displayType = option.dataset.displayType;
        
        // Check required files
        const requiredFiles = ['ways.geojson'];
        if (displayType === 'ways_with_points') {
            requiredFiles.push('stops.geojson');
        }

        Promise.all(requiredFiles.map(file => 
            fetch(`data/${relationId}/${file}`)
                .then(r => r.ok)
                .catch(() => false)
        )).then(availability => {
            if (!availability.every(exists => exists)) {
                option.disabled = true;
                option.parentElement.parentElement.classList.add('unavailable');
            }
        });
    });

    // Handle selection changes
    routeOptions.forEach(option => {
        option.addEventListener('change', () => {
            routedownloadBtn.disabled = !document.querySelector('input[name="routeDownload"]:checked');
        });
    });

    // Handle download
    routedownloadBtn.addEventListener('click', async () => {
        const selected = document.querySelector('input[name="routeDownload"]:checked');
        if (!selected) return;

        const relationId = selected.dataset.relationId;
        const displayType = selected.dataset.displayType;
        const routeName = selected.parentElement.textContent.trim();

        try {
            // Fetch data
            const [ways, stops] = await Promise.all([
                fetch(`data/${relationId}/ways.geojson`).then(r => r.json()),
                displayType === 'ways_with_points' 
                    ? fetch(`data/${relationId}/stops.geojson`).then(r => r.json())
                    : Promise.resolve({features: []})
            ]);

            // Create enhanced GeoJSON
            const combinedGeoJSON = {
                type: "FeatureCollection",
                generator: "overpass-turbo via Transport for Bandung",
                copyright: "The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.",
                timestamp: new Date().toISOString(),
                features: [
                    ...ways.features,
                    ...stops.features
                ].map(feature => ({
                    ...feature,
                    properties: {
                        ...feature.properties,
                        source: "OpenStreetMap",
                        processed_by: "Transport for Bandung",
                        processed_date: new Date().toISOString()
                    }
                }))
            };

            // Generate filename
            const fileName = `relation-${relationId}-tfb-${
                displayType === 'ways_with_points' ? 'jalur-halte' : 'jalur'
            }-${new Date().toISOString().slice(0, 10)}.geojson`;

            // Create download
            const blob = new Blob([JSON.stringify(combinedGeoJSON, null, 2)], {
                type: "application/json"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Download error:', error);
            alert('Gagal mengunduh data. Data rute kemungkinan tidak tersedia.');
        }
    });
});
