document.addEventListener('DOMContentLoaded', () => {
  // Scroll Indicator Functionality
  const scrollIndicator = document.querySelector('.scroll-indicator .arrow-line');
  if (scrollIndicator) {
    window.addEventListener('scroll', () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPosition = window.scrollY;
      const progress = (scrollPosition / scrollHeight) * 100;
      scrollIndicator.style.height = `${100 - progress}%`;
    }, { passive: true });
  }

  // Initialize hamburger menu
  initializeHamburger();

  // Initialize footnotes
  initFootnotes();

  // Set up event delegation for the entire document
  document.addEventListener('click', handleDocumentClick);

  // Counting Animation Functionality
  initCounterAnimation();

  // Collapsible Bar Functionality
  initCollapsibleBars();

  // Guide Swipe Preview Functionality
  initGuideSliders();

  // Update footnote positions on scroll/resize
  window.addEventListener('scroll', updateFnPositions, { passive: true });
  window.addEventListener('resize', updateFnPositions);
});

// Event Delegation Handler
function handleDocumentClick(e) {
  // Handle popup links
  if (e.target.closest('.popup-link')) {
    e.preventDefault();
    const popupId = e.target.closest('.popup-link').getAttribute('data-popup');
    const popup = document.getElementById(popupId);
    if (popup) popup.style.display = 'block';
    return;
  }

  // Handle popup close buttons
  if (e.target.closest('.popup-close-button')) {
    const popup = e.target.closest('.popup');
    if (popup) popup.style.display = 'none';
    return;
  }

  // Handle popup background clicks
  if (e.target.classList.contains('popup')) {
    e.target.style.display = 'none';
    return;
  }

  // Handle footnote clicks
  if (e.target.closest('fn')) {
    const fnElement = e.target.closest('fn');
    e.stopPropagation();
    const wasActive = fnElement.classList.contains('active');
    
    // Close all footnotes first
    document.querySelectorAll('fn').forEach(f => {
      f.classList.remove('active');
      f.contentDiv.style.display = 'none';
    });
    
    if (!wasActive) {
      const rect = fnElement.getBoundingClientRect();
      fnElement.contentDiv.style.display = 'block';
      fnElement.contentDiv.style.top = `${rect.top - fnElement.contentDiv.offsetHeight - 5}px`;
      fnElement.contentDiv.style.left = `${rect.left}px`;
      fnElement.classList.add('active');
    }
    return;
  }

  // Close all footnotes when clicking outside
  if (!e.target.closest('fn') && !e.target.closest('.fn-content')) {
    document.querySelectorAll('fn').forEach(f => {
      f.classList.remove('active');
      f.contentDiv.style.display = 'none';
    });
  }
}

// Initialize Footnotes
function initFootnotes() {
  document.querySelectorAll('fn').forEach(fnElement => {
    const content = fnElement.textContent;
    fnElement.innerHTML = '';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'fn-content';
    contentDiv.innerHTML = content;
    document.body.appendChild(contentDiv);
    fnElement.contentDiv = contentDiv;
  });
}

// Initialize Counter Animation
function initCounterAnimation() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const counterElement = entry.target;
        if (counterElement.textContent === "0") {
          const targetNumber = parseInt(counterElement.getAttribute('data-target'), 10);
          startCountingAnimation(counterElement, targetNumber);
        }
        observer.unobserve(counterElement);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.counter-number').forEach(counter => {
    observer.observe(counter);
  });
}

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

// Initialize Collapsible Bars
function initCollapsibleBars() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('.collapsible-bar')) {
      const bar = e.target.closest('.collapsible-bar');
      const content = bar.nextElementSibling;
      const arrow = bar.querySelector('.collapsible-bar-arrow');

      bar.classList.toggle('active');
      content.classList.toggle('open');
      arrow.classList.toggle('rotate');
    }
  });
}

// Initialize Guide Sliders
function initGuideSliders() {
  document.querySelectorAll('.guide-preview-container').forEach(container => {
    const indicators = document.createElement('div');
    indicators.className = 'slide-indicators';
    container.parentNode.insertBefore(indicators, container.nextElementSibling);

    initSlider(container, indicators);
  });
}

function initSlider(container, indicators) {
  let items = container.querySelectorAll('.guide-preview-item');
  let isDragging = false;
  let startPos = 0;
  let prevTranslate = 0;
  let currentIndex = 0;

  function initIndicators() {
    indicators.innerHTML = '';
    items.forEach((_, index) => {
      const dot = document.createElement('span');
      if (index === 0) dot.classList.add('active');
      dot.addEventListener('click', () => goToIndex(index));
      indicators.appendChild(dot);
    });
  }

  function updateIndicators(index) {
    indicators.querySelectorAll('span').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }

  function goToIndex(index) {
    currentIndex = index;
    const itemWidth = container.offsetWidth;
    container.scrollTo({
      left: itemWidth * index,
      behavior: 'smooth'
    });
    updateIndicators(index);
  }

  // Event handlers
  const touchStart = (e) => {
    startPos = getPositionX(e);
    isDragging = true;
    container.classList.add('grabbing');
  };

  const touchMove = (e) => {
    if (!isDragging) return;
    const currentPosition = getPositionX(e);
    const diff = currentPosition - startPos;
    container.scrollLeft = prevTranslate - diff;
  };

  const touchEnd = () => {
    isDragging = false;
    const movedBy = prevTranslate - container.scrollLeft;
    container.classList.remove('grabbing');

    if (Math.abs(movedBy) >= 50) {
      currentIndex = movedBy > 0 ? currentIndex + 1 : currentIndex - 1;
      currentIndex = Math.max(0, Math.min(currentIndex, items.length - 1));
      goToIndex(currentIndex);
    }
  };

  const getPositionX = (event) => {
    return event.type.includes('mouse') ? event.pageX : event.touches[0].clientX;
  };

  // Add event listeners
  container.addEventListener('touchstart', touchStart, { passive: true });
  container.addEventListener('touchmove', touchMove, { passive: false });
  container.addEventListener('touchend', touchEnd);
  container.addEventListener('mousedown', touchStart);
  container.addEventListener('mousemove', touchMove);
  container.addEventListener('mouseup', touchEnd);
  container.addEventListener('mouseleave', touchEnd);

  container.addEventListener('scroll', () => {
    prevTranslate = container.scrollLeft;
    const itemWidth = container.offsetWidth;
    currentIndex = Math.round(container.scrollLeft / itemWidth);
    updateIndicators(currentIndex);
  }, { passive: true });

  initIndicators();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      items = container.querySelectorAll('.guide-preview-item');
      initIndicators();
      goToIndex(currentIndex);
    }, 250);
  });
}

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
    const newHamburger = hamburger.cloneNode(true);
    hamburger.parentNode.replaceChild(newHamburger, hamburger);

    newHamburger.addEventListener('click', () => {
      newHamburger.classList.toggle('active');
      navLinks.classList.toggle('active');
      body.classList.toggle('menu-open');
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.navbar') && navLinks.classList.contains('active')) {
        newHamburger.classList.remove('active');
        navLinks.classList.remove('active');
        body.classList.remove('menu-open');
      }
    });

    // Use event delegation for nav links
    navLinks.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        newHamburger.classList.remove('active');
        navLinks.classList.remove('active');
        body.classList.remove('menu-open');
      }
    });
  }
}

// Global exports
window.initializeHamburger = initializeHamburger;
