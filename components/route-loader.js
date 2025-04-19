const routeCache = new Map();
let activeLayers = new Map();

async function initializeRoutes() {
  try {
    const response = await fetch('data/routes.json');
    const { categories } = await response.json();
    const container = document.getElementById('route-container');

    categories.forEach(category => {
      const categoryHTML = `
        <div class="route-map-collapsible">
          <div class="route-map-collapsible-bar">
            <span>${category.name}</span>
            <span class="route-map-collapsible-bar-arrow">▼</span>
          </div>
          <div class="route-map-collapsible-content">
            ${category.routes.map(route => `
              <label class="route-option">
                <input type="checkbox"
                       data-relation-id="${route.relationId}"
                       data-display-type="${route.type}"
                       data-route-color="${route.color}">
                ${route.name}
              </label>
            `).join('')}
          </div>
        </div>
      `;
      container.insertAdjacentHTML('beforeend', categoryHTML);
    });

    initializeCollapsibles();
    setupEventDelegation();
  } catch (error) {
    console.error('Error initializing routes:', error);
  }
}

function setupEventDelegation() {
  document.getElementById('route-container').addEventListener('change', async (e) => {
    if (!e.target.matches('input[type="checkbox"]')) return;

    const { relationId, displayType, routeColor } = e.target.dataset;
    if (!relationId) return;

    try {
      if (e.target.checked) {
        await loadRoute(relationId, displayType, routeColor);
      } else {
        unloadRoute(relationId);
      }
    } catch (error) {
      console.error(`Route operation failed for ${relationId}:`, error);
      e.target.checked = false;
    }
  });
}

async function loadRoute(relationId, displayType, routeColor) {
  if (activeLayers.has(relationId)) {
    map.addLayer(activeLayers.get(relationId));
    return;
  }

  let layerGroup;
  if (routeCache.has(relationId)) {
    layerGroup = routeCache.get(relationId);
  } else {
    layerGroup = await fetchRouteData(relationId, displayType, routeColor);
    routeCache.set(relationId, layerGroup);
  }

  layerGroup.addTo(map);
  activeLayers.set(relationId, layerGroup);
}

async function fetchRouteData(relationId, displayType, routeColor) {
  try {
    return await fetchLocalRoute(relationId, displayType, routeColor);
  } catch (localError) {
    console.warn(`Local data not found for ${relationId}, using Overpass API`);
    return await fetchOverpassRoute(relationId, displayType, routeColor);
  }
}

function unloadRoute(relationId) {
  if (activeLayers.has(relationId)) {
    map.removeLayer(activeLayers.get(relationId));
    activeLayers.delete(relationId);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeRoutes);
export { initializeCollapsibles };
