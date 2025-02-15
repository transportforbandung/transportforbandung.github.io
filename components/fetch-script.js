function loadComponent(url, elementId, callback) {
  console.log(`Loading ${url} into #${elementId}...`);
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.statusText}`);
      }
      return response.text();
    })
    .then(data => {
      console.log(`Successfully loaded ${url}`);
      document.getElementById(elementId).innerHTML = data;
      if (callback) callback();
    })
    .catch(error => {
      console.error(`Error loading ${url}:`, error);
    });
}

// Load header and footer using root-relative paths
loadComponent('/components/header.html', 'header', () => {
  console.log('Header loaded. Initializing hamburger...');
  if (typeof initializeHamburger === 'function') {
    initializeHamburger();
  } else {
    console.error('initializeHamburger is not defined.');
  }
});
loadComponent('/components/footer.html', 'footer', () => {
  console.log('Footer loaded.');
});
