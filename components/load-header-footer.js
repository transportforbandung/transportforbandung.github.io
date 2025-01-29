function loadComponent(url, elementId) {
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.statusText}`);
      }
      return response.text();
    })
    .then(data => {
      document.getElementById(elementId).innerHTML = data;
    })
    .catch(error => {
      console.error(`Error loading ${url}:`, error);
    });
}

// Load header and footer
loadComponent('./components/header.html', 'header');
loadComponent('./components/footer.html', 'footer');
