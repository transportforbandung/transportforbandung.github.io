// fetch-script.js
function loadComponent(url, elementId, callback) {
  console.log(`Loading ${url} into #${elementId}...`);
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error(`Failed to load ${url}: ${response.statusText}`);
      return response.text();
    })
    .then(data => {
      console.log(`Successfully loaded ${url}`);
      const container = document.getElementById(elementId);
      container.innerHTML = data;
      
      // Dispatch a custom event after insertion
      const event = new CustomEvent('component-loaded', {
        detail: { elementId, content: data }
      });
      container.dispatchEvent(event);
      
      if (callback) callback();
    })
    .catch(console.error);
}

// Load components with enhanced initialization
loadComponent('/components/header.html', 'header', () => {
  // Re-initialize hamburger after header load
  initializeHamburger();
  
  // Add mutation observer for dynamic content changes
  const headerObserver = new MutationObserver((mutations) => {
    initializeHamburger();
  });
  
  const header = document.getElementById('header');
  headerObserver.observe(header, {
    childList: true,
    subtree: true
  });
});

loadComponent('/components/footer.html', 'footer');