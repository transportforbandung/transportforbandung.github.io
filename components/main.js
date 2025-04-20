document.addEventListener('DOMContentLoaded', () => {
  // Scroll Indicator
  const scrollIndicator = document.querySelector('.scroll-indicator .arrow-line');
  if (scrollIndicator) {
    window.addEventListener('scroll', () => {
      const progress = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight) * 100;
      scrollIndicator.style.height = `${100 - progress}%`;
    });
  }

  // Hamburger Menu
  const hamburger = document.querySelector('.hamburger');
  if (hamburger) {
    const newHamburger = hamburger.cloneNode(true);
    hamburger.parentNode.replaceChild(newHamburger, hamburger);
    const navLinks = document.querySelector('.nav-links');
    
    newHamburger.addEventListener('click', () => {
      newHamburger.classList.toggle('active');
      navLinks.classList.toggle('active');
      document.body.classList.toggle('menu-open');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.navbar') && navLinks.classList.contains('active')) {
        newHamburger.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.classList.remove('menu-open');
      }
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('active'));
    });
  }

  // Footnotes
  document.querySelectorAll('fn').forEach(fnElement => {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'fn-content';
    contentDiv.innerHTML = fnElement.textContent;
    document.body.appendChild(contentDiv);
    fnElement.contentDiv = contentDiv;

    fnElement.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasActive = fnElement.classList.toggle('active');
      document.querySelectorAll('fn').forEach(f => {
        f.classList.remove('active');
        f.contentDiv.style.display = 'none';
      });
      if (wasActive) {
        const rect = fnElement.getBoundingClientRect();
        contentDiv.style.display = 'block';
        contentDiv.style.top = `${rect.top - contentDiv.offsetHeight - 5}px`;
        contentDiv.style.left = `${rect.left}px`;
      }
    });
  });

  // Popups
  document.querySelectorAll(".popup-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById(link.dataset.popup).style.display = "block";
    });
  });

  document.querySelectorAll(".popup-close-button").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".popup").style.display = "none");
  });

  // Counter Animation
  function startCounting(counter, target) {
    let current = 0;
    const increment = target / (2000 / 16);
    const update = () => {
      if ((current += increment) < target) {
        counter.textContent = Math.floor(current);
        requestAnimationFrame(update);
      } else counter.textContent = target;
    };
    requestAnimationFrame(update);
  }

  document.addEventListener("scroll", () => {
    document.querySelectorAll(".counter-number").forEach(counter => {
      if (!counter.dataset.triggered && counter.getBoundingClientRect().top <= window.innerHeight) {
        startCounting(counter, +counter.dataset.target);
        counter.dataset.triggered = true;
      }
    });
  });

  // Collapsible Bars
  document.querySelectorAll('.collapsible-bar').forEach(bar => {
    bar.addEventListener('click', () => {
      bar.classList.toggle('active');
      bar.nextElementSibling.classList.toggle('open');
      bar.querySelector('.collapsible-bar-arrow').classList.toggle('rotate');
    });
  });

  // Sliders
  document.querySelectorAll('.guide-preview-container').forEach(container => {
    const indicators = document.createElement('div');
    indicators.className = 'slide-indicators';
    container.parentNode.insertBefore(indicators, container.nextElementSibling);
    
    let currentIndex = 0;
    const items = container.querySelectorAll('.guide-preview-item');
    const updateIndicators = () => {
      indicators.querySelectorAll('span').forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
    };

    indicators.innerHTML = Array.from({length: items.length}, (_, i) => 
      `<span onclick="container.scrollTo({left: ${container.offsetWidth * i}, behavior: 'smooth'})"></span>`
    ).join('');

    container.addEventListener('scroll', () => {
      currentIndex = Math.round(container.scrollLeft / container.offsetWidth);
      updateIndicators();
    });
  });

  // Shared Events
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('popup')) e.target.style.display = "none";
    if (!e.target.closest('fn') && !e.target.closest('.fn-content')) {
      document.querySelectorAll('fn').forEach(f => f.contentDiv.style.display = 'none');
    }
  });

  window.addEventListener('resize', () => {
    document.querySelectorAll('fn.active').forEach(fn => {
      const rect = fn.getBoundingClientRect();
      fn.contentDiv.style.top = `${rect.top - fn.contentDiv.offsetHeight - 5}px`;
      fn.contentDiv.style.left = `${rect.left}px`;
    });
  });
});
