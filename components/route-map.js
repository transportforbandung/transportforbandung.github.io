// route-map.js
const routeHandlers = new WeakMap();

function setupRouteInteractions() {
    const container = document.getElementById('route-container');
    if (!container || routeHandlers.has(container)) return;

    const handler = async (e) => {
        const checkbox = e.target.closest('input[type="checkbox"]');
        if (!checkbox || !checkbox.dataset.relationId) return;

        checkbox.disabled = true;
        try {
            if (checkbox.checked) {
                await loadRoute(checkbox.dataset.relationId);
            } else {
                await unloadRoute(checkbox.dataset.relationId);
            }
        } catch (error) {
            console.error('Route operation failed:', error);
            checkbox.checked = false;
        }
        checkbox.disabled = false;
    };

    container.addEventListener('change', handler);
    routeHandlers.set(container, handler);
}

// Initialize after route list loads
document.addEventListener('mapReady', setupRouteInteractions);
