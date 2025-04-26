// route-loader.js
let isRoutesInitialized = false;
const ROUTE_LOAD_DELAY = 1000;

async function initializeRoutes() {
    if (isRoutesInitialized) return;
    
    try {
        // Wait for both map and DOM stability
        await Promise.all([
            new Promise(resolve => {
                if (document.readyState === 'complete') resolve();
                else window.addEventListener('load', resolve);
            }),
            new Promise(resolve => document.addEventListener('mapReady', resolve))
        ]);

        // Add artificial delay for main thread settling
        await new Promise(resolve => setTimeout(resolve, ROUTE_LOAD_DELAY));

        const container = document.getElementById('route-container');
        if (!container) throw new Error('Route container not found');

        // Minimal route list rendering
        const response = await fetch('data/routes.json');
        const { categories } = await response.json();
        
        container.innerHTML = categories.map(category => `
            <div class="route-category">
                <h3>${category.name}</h3>
                ${category.routes.map(route => `
                    <label class="route-option">
                        <input type="checkbox"
                            data-relation-id="${route.relationId}"
                            data-delay-load="true">
                        ${route.name}
                    </label>
                `).join('')}
            </div>
        `).join('');

        isRoutesInitialized = true;
    } catch (error) {
        console.error('Route initialization failed:', error);
        document.getElementById('route-container').innerHTML = 
            '<p>Failed to load routes. Please refresh the page.</p>';
    }
}

// Start initialization after main content render
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeRoutes, 0);
});
