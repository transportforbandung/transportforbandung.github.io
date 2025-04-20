document.addEventListener('DOMContentLoaded', () => {
  // ===== FILE 1 FUNCTIONALITY =====
  // Scroll Indicator
  const scrollIndicator = document.querySelector('.scroll-indicator .arrow-line');
  const heroSection = document.querySelector('.hero');
  if (scrollIndicator && heroSection) {
    window.addEventListener('scroll', () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / scrollHeight) * 100;
      scrollIndicator.style.height = `${100 - progress}%`;
    });
  }

  // Hamburger Menu
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

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.navbar') && navLinks.classList.contains('active')) {
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
  initializeHamburger();

  // Footnotes
  function updateFnPositions() {
    document.querySelectorAll('fn.active').forEach(fnElement => {
      const rect = fnElement.getBoundingClientRect();
      const contentDiv = fnElement.contentDiv;
      contentDiv.style.top = `${rect.top - contentDiv.offsetHeight - 5}px`;
      contentDiv.style.left = `${rect.left}px`;
    });
  }

  document.querySelectorAll('fn').forEach(fnElement => {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'fn-content';
    contentDiv.innerHTML = fnElement.textContent;
    document.body.appendChild(contentDiv);
    fnElement.contentDiv = contentDiv;

    fnElement.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasActive = fnElement.classList.contains('active');
      
      document.querySelectorAll('fn').forEach(f => {
        f.classList.remove('active');
        f.contentDiv.style.display = 'none';
      });
      
      if (!wasActive) {
        const rect = fnElement.getBoundingClientRect();
        contentDiv.style.display = 'block';
        fnElement.classList.add('active');
        updateFnPositions();
      }
    });
  });

  // Popups
  document.querySelectorAll(".popup-link").forEach(link => {
    link.addEventListener("click", function(e) {
      e.preventDefault();
      const popup = document.getElementById(link.dataset.popup);
      if (popup) popup.style.display = "block";
    });
  });

  document.querySelectorAll(".popup-close-button").forEach(btn => {
    btn.addEventListener("click", () => {
      const popup = btn.closest(".popup");
      if (popup) popup.style.display = "none";
    });
  });

  // ===== FILE 2 FUNCTIONALITY =====
  // Counter Animation
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
    return rect.top <= window.innerHeight && rect.bottom >= 0;
  }

  document.addEventListener("scroll", () => {
    document.querySelectorAll(".counter-number:not([data-triggered])").forEach(counter => {
      if (isInViewport(counter)) {
        startCountingAnimation(counter, parseInt(counter.dataset.target, 10));
        counter.dataset.triggered = "true";
      }
    });
  });

  // ===== FILE 3 FUNCTIONALITY =====
  // Collapsible Bars
  document.querySelectorAll('.collapsible-bar').forEach(bar => {
    bar.addEventListener('click', function() {
      const content = this.nextElementSibling;
      const arrow = this.querySelector('.collapsible-bar-arrow');
      this.classList.toggle('active');
      content.classList.toggle('open');
      arrow.classList.toggle('rotate');
    });
  });

  // ===== FILE 4 FUNCTIONALITY =====
  // Sliders
  document.querySelectorAll('.guide-preview-container').forEach(container => {
    const indicators = document.createElement('div');
    indicators.className = 'slide-indicators';
    container.parentNode.insertBefore(indicators, container.nextElementSibling);

    let currentIndex = 0;
    let items = container.querySelectorAll('.guide-preview-item');
    let isDragging = false;
    let startPos = 0;
    let prevTranslate = 0;

    // Initialize indicators
    indicators.innerHTML = Array.from(items, (_, i) => 
      `<span class="${i === 0 ? 'active' : ''}"></span>`
    ).join('');

    indicators.querySelectorAll('span').forEach((dot, i) => {
      dot.addEventListener('click', () => {
        currentIndex = i;
        container.scrollTo({
          left: container.offsetWidth * i,
          behavior: 'smooth'
        });
        updateIndicators();
      });
    });

    function updateIndicators() {
      indicators.querySelectorAll('span').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentIndex);
      });
    }

    // Touch/mouse handlers
    const handleMove = (clientX) => {
      if (!isDragging) return;
      const diff = clientX - startPos;
      container.scrollLeft = prevTranslate - diff;
    };

    container.addEventListener('mousedown', e => {
      isDragging = true;
      startPos = e.clientX;
      prevTranslate = container.scrollLeft;
    });

    container.addEventListener('mousemove', e => handleMove(e.clientX));
    container.addEventListener('mouseup', () => isDragging = false);
    container.addEventListener('mouseleave', () => isDragging = false);

    container.addEventListener('touchstart', e => {
      isDragging = true;
      startPos = e.touches[0].clientX;
      prevTranslate = container.scrollLeft;
    });

    container.addEventListener('touchmove', e => handleMove(e.touches[0].clientX));
    container.addEventListener('touchend', () => isDragging = false);

    // Update on scroll/resize
    container.addEventListener('scroll', () => {
      currentIndex = Math.round(container.scrollLeft / container.offsetWidth);
      updateIndicators();
    });

    window.addEventListener('resize', () => {
      items = container.querySelectorAll('.guide-preview-item');
      container.scrollTo({ left: container.offsetWidth * currentIndex });
    });
  });

  // ===== SHARED EVENT LISTENERS =====
  window.addEventListener('click', (e) => {
    // Close footnotes
    if (!e.target.closest('fn') && !e.target.closest('.fn-content')) {
      document.querySelectorAll('fn').forEach(f => {
        f.classList.remove('active');
        f.contentDiv.style.display = 'none';
      });
    }

    // Close popups
    if (e.target.classList.contains('popup')) {
      e.target.style.display = 'none';
    }
  });

  window.addEventListener('resize', updateFnPositions);
  window.addEventListener('scroll', updateFnPositions);
});
