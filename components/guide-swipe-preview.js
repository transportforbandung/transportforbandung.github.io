document.addEventListener('DOMContentLoaded', function() {
    // Process each slider container
    document.querySelectorAll('.guide-preview-container').forEach(container => {
        // Create indicators container
        const indicators = document.createElement('div');
        indicators.className = 'slide-indicators';
        container.parentNode.insertBefore(indicators, container.nextElementSibling);

        // Initialize slider functionality
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

        // Initialize indicators
        function initIndicators() {
            indicators.innerHTML = '';
            items.forEach((_, index) => {
                const dot = document.createElement('span');
                if(index === 0) dot.classList.add('active');
                dot.addEventListener('click', () => goToIndex(index));
                indicators.appendChild(dot);
            });
        }

        // Update indicators
        function updateIndicators(index) {
            indicators.querySelectorAll('span').forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
        }

        // Slide to specific index
        function goToIndex(index) {
            currentIndex = index;
            const itemWidth = container.offsetWidth;
            container.scrollTo({
                left: itemWidth * index,
                behavior: 'smooth'
            });
            updateIndicators(index);
        }

        // Touch events
        container.addEventListener('touchstart', touchStart);
        container.addEventListener('touchmove', touchMove);
        container.addEventListener('touchend', touchEnd);

        // Mouse events
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

        // Handle scroll events
        container.addEventListener('scroll', () => {
            const itemWidth = container.offsetWidth;
            currentIndex = Math.round(container.scrollLeft / itemWidth);
            updateIndicators(currentIndex);
        });

        // Initialize
        initIndicators();
        
        // Handle window resize
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
