// combined main.js and hamburger.js
document.addEventListener('DOMContentLoaded', () => {
  // Scroll Indicator Functionality
  const scrollIndicator = document.querySelector('.scroll-indicator');
  const heroSection = document.querySelector('.hero');

  if (scrollIndicator && heroSection) {
    window.addEventListener('scroll', () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPosition = window.scrollY;
      const progress = (scrollPosition / scrollHeight) * 100;
      scrollIndicator.style.width = `${progress}%`;
    });
  }

  // Initialize hamburger for static content
  initializeHamburger();
});

// Hamburger function needs to be available globally
function initializeHamburger() {
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  const body = document.body;

  if (hamburger && navLinks) {
    // Remove existing event listeners to prevent duplicates
    const newHamburger = hamburger.cloneNode(true);
    hamburger.parentNode.replaceChild(newHamburger, hamburger);

    newHamburger.addEventListener('click', () => {
      newHamburger.classList.toggle('active');
      navLinks.classList.toggle('active');
      body.classList.toggle('menu-open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.navbar') && navLinks.classList.contains('active')) {
        newHamburger.classList.remove('active');
        navLinks.classList.remove('active');
        body.classList.remove('menu-open');
      }
    });

    // Close menu after clicking a link
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', () => {
        newHamburger.classList.remove('active');
        navLinks.classList.remove('active');
        body.classList.remove('menu-open');
      });
    });
  }
}

// Make available for dynamic loading
window.initializeHamburger = initializeHamburger;
