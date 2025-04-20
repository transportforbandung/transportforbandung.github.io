document.addEventListener('DOMContentLoaded', () => {
  // ==== FILE 1 START ====
  // Scroll Indicator Functionality
  const scrollIndicator = document.querySelector('.scroll-indicator .arrow-line');
  const heroSection = document.querySelector('.hero');

  if (scrollIndicator && heroSection) {
    window.addEventListener('scroll', () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPosition = window.scrollY;
      const progress = (scrollPosition / scrollHeight) * 100;
      scrollIndicator.style.height = `${100 - progress}%`;
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

  // ==== FILE 2 START ====
  // Counting Animation Functionality
  function startCountingAnimation(counterElement, targetNumber) {
    let currentNumber = 0;
    const duration = 2000;
    const increment = targetNumber / (duration / 16);

    const updateCounter = () => {
      if (currentNumber < targetNumber) {
        currentNumber += increment;
        counterElement.textContent = Math.floor(currentNumber);
        requestAnimationFrame(updateCounter);
      } else {
        counterElement.textContent = targetNumber;
      }
    };
    updateCounter();
  }

  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
    );
  }

  document.addEventListener("scroll", () => {
    document.querySelectorAll(".counter-number").forEach((counterElement) => {
      const targetNumber = parseInt(counterElement.getAttribute("data-target"), 10);
      if (isInViewport(counterElement) && counterElement.textContent === "0") {
        startCountingAnimation(counterElement, targetNumber);
      }
    });
  });

  // ==== FILE 3 START ====
  // Collapsible Bars Functionality
  const collapsibleBars = document.querySelectorAll('.collapsible-bar');
  collapsibleBars.forEach(bar => {
    bar.addEventListener('click', function() {
      const content = bar.nextElementSibling;
      const arrow = bar.querySelector('.collapsible-bar-arrow');
      bar.classList.toggle('active');
      content.classList.toggle('open');
      arrow.classList.toggle('rotate');
    });
  });

  // ==== FILE 4 START ====
  // Slider Functionality
  document.querySelectorAll('.guide-preview-container').forEach(container => {
    const indicators = document.createElement('div');
    indicators.className = 'slide-indicators';
    container.parentNode.insertBefore(indicators, container.nextElementSibling);
    initSlider(container, indicators);
  });

  function initSlider(container, indicators) {
    // ... (keep original slider implementation code unchanged) ...
  }

  // ==== SHARED FUNCTIONS ====
  function updateFnPositions() {
    document.querySelectorAll('fn.active').forEach(fnElement => {
      const rect = fnElement.getBoundingClientRect();
      const contentDiv = fnElement.contentDiv;
      contentDiv.style.top = `${rect.top - contentDiv.offsetHeight - 5}px`;
      contentDiv.style.left = `${rect.left}px`;
    });
  }

  function initializeHamburger() {
    // ... (keep original hamburger implementation code unchanged) ...
  }

  window.initializeHamburger = initializeHamburger;
});
