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

  // Improved Footnote Functionality
  document.querySelectorAll('fn').forEach(fnElement => {
    const content = fnElement.textContent;
    fnElement.innerHTML = '';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'fn-content';
    contentDiv.innerHTML = content;
    document.body.appendChild(contentDiv);
    fnElement.contentDiv = contentDiv;

    fnElement.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasActive = fnElement.classList.contains('active');
      
      // Close all footnotes first
      document.querySelectorAll('fn').forEach(f => {
        f.classList.remove('active');
        f.contentDiv.style.display = 'none';
      });
      
      if (!wasActive) {
        const rect = fnElement.getBoundingClientRect();
        contentDiv.style.display = 'block';
        contentDiv.style.top = `${rect.top - contentDiv.offsetHeight - 5}px`;
        contentDiv.style.left = `${rect.left}px`;
        fnElement.classList.add('active');
      }
    });
  });

  // Close footnotes when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('fn') && !e.target.closest('.fn-content') && !e.target.closest('.popup')) {
      document.querySelectorAll('fn').forEach(f => {
        f.classList.remove('active');
        f.contentDiv.style.display = 'none';
      });
    }
  });

  // Update footnote positions on scroll/resize
  window.addEventListener('scroll', updateFnPositions);
  window.addEventListener('resize', updateFnPositions);

  // Popup Functionality
  const popupLinks = document.querySelectorAll(".popup-link");
  const closeButtons = document.querySelectorAll(".popup-close-button");

  // Handle popup links
  popupLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const popupId = link.getAttribute("data-popup");
      const popup = document.getElementById(popupId);
      if (popup) {
        popup.style.display = "block";
      }
    });
  });

  // Handle close buttons
  closeButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      const popup = btn.closest(".popup");
      if (popup) {
        popup.style.display = "none";
      }
    });
  });

  // Close popups when clicking outside
  window.addEventListener("click", function (e) {
    if (e.target.classList.contains("popup")) {
      e.target.style.display = "none";
    }
  });
});

// Position update function for footnotes
function updateFnPositions() {
  document.querySelectorAll('fn.active').forEach(fnElement => {
    const rect = fnElement.getBoundingClientRect();
    const contentDiv = fnElement.contentDiv;
    contentDiv.style.top = `${rect.top - contentDiv.offsetHeight - 5}px`;
    contentDiv.style.left = `${rect.left}px`;
  });
}

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
