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

  // Hamburger Menu Initialization
  initializeHamburger();

  // Footnote Functionality
  document.querySelectorAll('fn').forEach(fnElement => {
    // Move content to a hidden div
    const content = fnElement.innerHTML;
    fnElement.innerHTML = '';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'fn-content';
    contentDiv.innerHTML = content;
    fnElement.appendChild(contentDiv);
    
    // Toggle on click
    fnElement.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasActive = fnElement.classList.contains('active');
      
      // Close all footnotes first
      document.querySelectorAll('fn').forEach(f => f.classList.remove('active'));
      
      // Toggle if clicking the same footnote
      if (!wasActive) {
        fnElement.classList.add('active');
      }
    });
  });

  // Close footnotes when clicking anywhere
  document.addEventListener('click', () => {
    document.querySelectorAll('fn').forEach(f => f.classList.remove('active'));
  });
});

// Hamburger Menu Function
function initializeHamburger() {
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  const body = document.body;

  if (hamburger && navLinks) {
    // Clone to remove existing event listeners
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

// Global exports
window.initializeHamburger = initializeHamburger;
