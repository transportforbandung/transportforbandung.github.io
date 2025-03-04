document.addEventListener('DOMContentLoaded', function() {
    const container = document.querySelector('.guide-preview-container');
    const indicators = document.querySelector('.slide-indicators');
    let items = document.querySelectorAll('.guide-preview-item');
    
    // Initialize indicators
    function initIndicators() {
        indicators.innerHTML = '';
        items.forEach((_, index) => {
            const dot = document.createElement('span');
            if(index === 0) dot.classList.add('active');
            indicators.appendChild(dot);
        });
    }

    // Update indicators
    function updateIndicators() {
        const scrollPos = container.scrollLeft;
        const itemWidth = container.offsetWidth;
        const activeIndex = Math.round(scrollPos / itemWidth);
        
        document.querySelectorAll('.slide-indicators span').forEach((dot, index) => {
            dot.classList.toggle('active', index === activeIndex);
        });
    }

    // Handle swipe
    let touchStartX = 0;
    let touchEndX = 0;

    container.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    });

    container.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });

    function handleSwipe() {
        const diff = touchStartX - touchEndX;
        const itemWidth = container.offsetWidth;
        const currentScroll = container.scrollLeft;
        
        if (diff > 50) { // Swipe left
            container.scrollTo({
                left: currentScroll + itemWidth,
                behavior: 'smooth'
            });
        } else if (diff < -50) { // Swipe right
            container.scrollTo({
                left: currentScroll - itemWidth,
                behavior: 'smooth'
            });
        }
    }

    // Initialize
    initIndicators();
    
    // Update indicators on scroll
    container.addEventListener('scroll', updateIndicators);
    
    // Re-initialize on resize
    window.addEventListener('resize', () => {
        items = document.querySelectorAll('.guide-preview-item');
        initIndicators();
        updateIndicators();
    });
});
