// route-loader.js
const routeCache = new Map();
const activeLayers = new Map();

// Optimized initialization with batch DOM operations
async function initializeRoutes() {
  try {
    const container = document.getElementById('route-container');
    const response = await fetch('data/routes.json');
    const { categories } = await response.json();

    const fragment = document.createDocumentFragment();

    categories.forEach((category, index) => {
      const accordionId = `accordion-category-${index}`;
      const collapseId = `collapse-category-${index}`;
      
      const categoryHTML = `
        <div class="accordion mb-3" id="${accordionId}">
          <div class="accordion-item">
            <div class="accordion-header" id="heading-${index}">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
                ${category.name}
              </button>
            </div>
            <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="heading-${index}" data-bs-parent="#${accordionId}">
              <div class="accordion-body">
                ${category.routes.map((route, routeIndex) => `
                  <div class="form-check mb-2" style="margin-bottom: 1.0rem !important;">
                    <input class="form-check-input" type="checkbox"
                           id="route-${index}-${routeIndex}"
                           data-relation-id="${route.relationId}"
                           data-display-type="${route.type}"
                           data-route-color="${route.color}">
                    <label class="form-check-label" for="route-${index}-${routeIndex}">
                      ${route.name}
                    </label>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = categoryHTML;
      fragment.appendChild(tempDiv.firstElementChild);
    });

    container.appendChild(fragment);
    setupEventDelegation();
  } catch (error) {
    console.error('Error initializing routes:', error);
  }
}


// More efficient event delegation
function setupEventDelegation() {
  const handler = async (e) => {
    const checkbox = e.target.closest('input[type="checkbox"]');
    if (!checkbox) return;

    const { relationId, displayType, routeColor } = checkbox.dataset;
    if (!relationId) return;

    try {
      checkbox.disabled = true; // Prevent rapid toggling
      if (checkbox.checked) {
        await loadRoute(relationId, displayType, routeColor);
      } else {
        unloadRoute(relationId);
      }
    } catch (error) {
      console.error(`Route operation failed for ${relationId}:`, error);
      checkbox.checked = false;
      // Consider adding visual error feedback
    } finally {
      checkbox.disabled = false;
    }
  };

  document.getElementById('route-container').addEventListener('change', handler);
}

// Improved layer management
async function loadRoute(relationId, displayType, routeColor) {
  if (activeLayers.has(relationId)) {
    map.addLayer(activeLayers.get(relationId));
    return;
  }

  try {
    const layerGroup = routeCache.has(relationId) 
      ? routeCache.get(relationId)
      : await fetchRouteData(relationId, displayType, routeColor);

    layerGroup.addTo(map);
    activeLayers.set(relationId, layerGroup);
    routeCache.set(relationId, layerGroup);
  } catch (error) {
    throw new Error(`Failed loading route ${relationId}: ${error.message}`);
  }
}

// Consolidated error handling
async function fetchRouteData(relationId, displayType, routeColor) {
  try {
    return await fetchLocalRoute(relationId, displayType, routeColor);
  } catch (localError) {
    console.warn(`Local data missing for ${relationId}:`, localError);
    try {
      return await fetchOverpassRoute(relationId, displayType, routeColor);
    } catch (overpassError) {
      throw new Error(`Both local and Overpass sources failed for ${relationId}`);
    }
  }
}

// Safer layer cleanup
function unloadRoute(relationId) {
  const layer = activeLayers.get(relationId);
  if (layer && map.hasLayer(layer)) {
    map.removeLayer(layer);
  }
  activeLayers.delete(relationId);
}

// Initialize after DOM and base map are ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof map !== 'undefined') initializeRoutes();
});
