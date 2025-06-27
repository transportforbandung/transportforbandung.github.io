// intermap-display.js
const routeCache = new Map();
const activeLayers = new Map();
let activeRoutes = new Map();

// Configuration defaults
const config = {
  localRouteBasePath: 'route-data/geojson',
  routesDataUrl: 'route-data/routes.json',
  overpassEndpoint: 'https://overpass-api.de/api/interpreter',
  ...(window.routeConfig || {}) // Merge with user-provided config
};

// Route name lookup
let routeNameLookup = {};

async function loadRouteNameLookup() {
  if (Object.keys(routeNameLookup).length === 0) {
    const response = await fetch(config.routesDataUrl);
    const { categories } = await response.json();
    
    // Populate routeNameLookup from categories > routes
    for (const category of categories) {
      for (const route of category.routes) {
        routeNameLookup[route.relationId] = route.name;
      }
    }
  }
}

// route-map.js functions
function fetchLocalRoute(relationId, displayType, routeColor) {
    return new Promise((resolve, reject) => {
        const layerGroup = L.layerGroup();
        const basePath = `${config.localRouteBasePath}/${relationId}`;

        Promise.all([
            fetch(`${basePath}/ways.geojson`),
            fetch(`${basePath}/${displayType === "ways_with_points" ? "stops" : "endstops"}.geojson`)
        ]).then(async ([waysResponse, stopsResponse]) => {
            if (!waysResponse.ok || !stopsResponse.ok) throw new Error('Local files not found');
            
            const [waysData, stopsData] = await Promise.all([
                waysResponse.json(),
                stopsResponse.json()
            ]);

            // Ensure routeNameLookup is loaded
            const routeName = routeNameLookup[relationId] || `${name}`;

            // Load ways data
            waysData.features.forEach(feature => {
                if (feature.geometry.type === "LineString") {
                    L.polyline(feature.geometry.coordinates.map(coord => [coord[1], coord[0]]), {
                        color: routeColor,
                        weight: 4
                    }).bindPopup(routeName).addTo(layerGroup);
                }
            });

            // Load stops data
            stopsData.features.forEach(feature => {
                if (feature.geometry.type === "Point") {
                    const coords = feature.geometry.coordinates;
                    L.circleMarker([coords[1], coords[0]], {
                        radius: 5,
                        color: routeColor,
                        fillColor: "#ffffff",
                        fillOpacity: 1
                    }).bindPopup(feature.properties?.name || "Unnamed Stop")
                     .addTo(layerGroup);
                }
            });

            resolve(layerGroup);
        }).catch(reject);
    });
}

// Overpass API functions if local data is not available
function fetchOverpassRoute(relationId, displayType, routeColor) {
    return new Promise((resolve, reject) => {
        const layerGroup = L.layerGroup();
        const stopQuery = displayType === "ways_with_points" ? 
            `node(r:"stop"),node(r:"stop_entry_only"),node(r:"stop_exit_only")` : 
            `node(r:"stop_entry_only"),node(r:"stop_exit_only")`;

        const query = `[out:json];
            relation(${relationId});
            way(r);>;out geom;
            ${stopQuery};out geom;`;

        fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                data.elements.forEach(element => {
                    if (element.type === "way" && element.geometry) {
                        L.polyline(element.geometry.map(p => [p.lat, p.lon]), {
                            color: routeColor,
                            weight: 4
                        }).addTo(layerGroup);
                    }
                    else if (element.type === "node") {
                        L.circleMarker([element.lat, element.lon], {
                            radius: 5,
                            color: routeColor,
                            fillColor: "#ffffff",
                            fillOpacity: 1
                        }).bindPopup(element.tags?.name || "Unnamed Stop")
                          .addTo(layerGroup);
                    }
                });
                resolve(layerGroup);
            }).catch(reject);
    });
}

// route-loader.js functions
async function initializeRoutes() {
  try {
    const container = document.getElementById('route-container');
    const response = await fetch(config.routesDataUrl);
    const { categories } = await response.json();

    const fragment = document.createDocumentFragment();

    categories.forEach((category, index) => {
      const accordionId = `accordion-category-${index}`;
      const collapseId = `collapse-category-${index}`;
      
      // Create accordion HTML for each category on the sidebar
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
                <div class="form-check mb-3" style="margin-bottom: 1.5rem !important;">
                  <input class="form-check-input master-checkbox" 
                         type="checkbox" 
                         id="master-${index}"
                         data-category-index="${index}">
                  <label class="form-check-label fw-bold" for="master-${index}">
                    Pilih semua
                  </label>
                </div>
                ${category.routes.map((route, routeIndex) => `
                  <div class="form-check mb-2" style="margin-bottom: 1.0rem !important;">
                    <input class="form-check-input route-checkbox" 
                           type="checkbox"
                           id="route-${index}-${routeIndex}"
                           data-relation-id="${route.relationId}"
                           data-display-type="${route.type}"
                           data-route-color="${route.color}"
                           data-category-index="${index}">
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

function setupEventDelegation() {
  const container = document.getElementById('route-container');

  const updateMasterCheckbox = (categoryIndex) => {
    const checkboxes = container.querySelectorAll(
      `.route-checkbox[data-category-index="${categoryIndex}"]`
    );
    const master = container.querySelector(
      `.master-checkbox[data-category-index="${categoryIndex}"]`
    );
    const checkedCount = [...checkboxes].filter(c => c.checked).length;
    master.checked = checkedCount === checkboxes.length;
  };

  const handleMasterChange = async (masterCheckbox) => {
    const categoryIndex = masterCheckbox.dataset.categoryIndex;
    const checkboxes = container.querySelectorAll(
      `.route-checkbox[data-category-index="${categoryIndex}"]`
    );

    masterCheckbox.disabled = true;
    const isChecked = masterCheckbox.checked;

    // Process checkboxes sequentially
    for (const checkbox of checkboxes) {
      if (checkbox.checked !== isChecked) {
        checkbox.checked = isChecked;
        const { relationId, displayType, routeColor } = checkbox.dataset;
        
        try {
          checkbox.disabled = true;
          if (isChecked) {
            await loadRoute(relationId, displayType, routeColor);
          } else {
            unloadRoute(relationId);
          }
        } catch (error) {
          console.error(`Route operation failed for ${relationId}:`, error);
          checkbox.checked = false;
        } finally {
          checkbox.disabled = false;
        }
      }
    }

    masterCheckbox.disabled = false;
    updateMasterCheckbox(categoryIndex);
  };

  container.addEventListener('change', async (e) => {
    const checkbox = e.target;
    
    if (checkbox.classList.contains('master-checkbox')) {
      await handleMasterChange(checkbox);
      return;
    }

    if (checkbox.classList.contains('route-checkbox')) {
      const categoryIndex = checkbox.dataset.categoryIndex;
      const { relationId, displayType, routeColor } = checkbox.dataset;
      
      try {
        checkbox.disabled = true;
        if (checkbox.checked) {
          await loadRoute(relationId, displayType, routeColor);
        } else {
          unloadRoute(relationId);
        }
      } catch (error) {
        console.error(`Route operation failed for ${relationId}:`, error);
        checkbox.checked = false;
      } finally {
        checkbox.disabled = false;
        updateMasterCheckbox(categoryIndex);
      }
    }
  });
}

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

function unloadRoute(relationId) {
  const layer = activeLayers.get(relationId);
  if (layer && map.hasLayer(layer)) {
    map.removeLayer(layer);
  }
  activeLayers.delete(relationId);
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof map !== 'undefined') initializeRoutes();
});
