document.addEventListener('DOMContentLoaded', () => {
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

  closeButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      const popup = btn.closest(".popup");
      if (popup) {
        popup.style.display = "none";
      }
    });
  });

  window.addEventListener("click", function (e) {
    if (e.target.classList.contains("popup")) {
      e.target.style.display = "none";
    }
  });

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
    const counterNumberElements = document.querySelectorAll(".counter-number");
    
    counterNumberElements.forEach((counterElement) => {
      const targetNumber = parseInt(counterElement.getAttribute("data-target"), 10);
      
      if (isInViewport(counterElement)) {
        if (counterElement.textContent === "0") {
          startCountingAnimation(counterElement, targetNumber);
        }
      }
    });
  });

  // Collapsible Bar Functionality
  const collapsibleBars = document.querySelectorAll('.collapsible-bar');
  collapsibleBars.forEach(bar => {
    bar.addEventListener('click', () => {
      const content = bar.nextElementSibling;
      const arrow = bar.querySelector('.collapsible-bar-arrow');

      bar.classList.toggle('active');
      content.classList.toggle('open');
      arrow.classList.toggle('rotate');
    });
  });

  // Guide Swipe Preview Functionality
  document.querySelectorAll('.guide-preview-container').forEach(container => {
    const indicators = document.createElement('div');
    indicators.className = 'slide-indicators';
    container.parentNode.insertBefore(indicators, container.nextElementSibling);

    initSlider(container, indicators);
  });

  function initSlider(container, indicators) {
    let items = container.querySelectorAll('.guide-preview-item');
    let isDragging = false;
    let startPos = 0;
    let currentTranslate = 0;
    let prevTranslate = 0;
    let animationID = 0;
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

    container.addEventListener('touchstart', touchStart);
    container.addEventListener('touchmove', touchMove);
    container.addEventListener('touchend', touchEnd);

    container.addEventListener('mousedown', touchStart);
    container.addEventListener('mousemove', touchMove);
    container.addEventListener('mouseup', touchEnd);
    container.addEventListener('mouseleave', touchEnd);

    function getPositionX(event) {
      return event.type.includes('mouse') ? event.pageX : event.touches[0].clientX;
    }

    function touchStart(event) {
      startPos = getPositionX(event);
      isDragging = true;
      animationID = requestAnimationFrame(animation);
      container.classList.add('grabbing');
    }

    function touchMove(event) {
      if (!isDragging) return;
      const currentPosition = getPositionX(event);
      const diff = currentPosition - startPos;
      container.scrollLeft = prevTranslate - diff;
    }

    function touchEnd() {
      cancelAnimationFrame(animationID);
      isDragging = false;
      const movedBy = prevTranslate - container.scrollLeft;
      container.classList.remove('grabbing');

      if (Math.abs(movedBy) < 50) return;

      currentIndex = movedBy > 0 ? currentIndex + 1 : currentIndex - 1;
      currentIndex = Math.max(0, Math.min(currentIndex, items.length - 1));
      goToIndex(currentIndex);
    }

    function animation() {
      prevTranslate = container.scrollLeft;
      animationID = requestAnimationFrame(animation);
    }

    container.addEventListener('scroll', () => {
      const itemWidth = container.offsetWidth;
      currentIndex = Math.round(container.scrollLeft / itemWidth);
      updateIndicators(currentIndex);
    });

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
