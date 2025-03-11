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
            // Always fetch ways
            const ways = await fetch(`data/${relationId}/ways.geojson`).then(r => r.json());
            
            // Conditionally fetch stops
            let stops = { features: [] };
            if (displayType === 'ways_with_points') {
                stops = await fetch(`data/${relationId}/stops.geojson`).then(r => r.json());
            }

            // Create combined GeoJSON
            const combined = {
                type: "FeatureCollection",
                features: [...ways.features, ...stops.features]
            };

            // Generate filename
            const fileName = `relation-${relationId}-tfb-${
                displayType === 'ways_with_points' ? 'jalur-halte' : 'jalur'
            }-${new Date().toISOString().slice(0, 10)}.geojson`;

            // Trigger download
            const blob = new Blob([JSON.stringify(combined)], { type: "application/json" });
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
