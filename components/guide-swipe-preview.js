document.addEventListener('DOMContentLoaded', function() {
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
        let velocity = 0;
        let lastTime = Date.now();
        let startTime = 0;

        // Add CSS transition class
        container.classList.add('smooth-transition');

        function initIndicators() {
            indicators.innerHTML = '';
            items.forEach((_, index) => {
                const dot = document.createElement('span');
                dot.classList.toggle('active', index === 0);
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
            currentIndex = Math.max(0, Math.min(index, items.length - 1));
            const itemWidth = container.offsetWidth;
            currentTranslate = currentIndex * -itemWidth;
            
            container.style.transform = `translateX(${currentTranslate}px)`;
            updateIndicators(currentIndex);
        }

        // Touch/Mouse handlers
        function handleStart(x) {
            startPos = x;
            startTime = Date.now();
            isDragging = true;
            container.classList.remove('smooth-transition');
            cancelAnimationFrame(animationID);
        }

        function handleMove(x) {
            if (!isDragging) return;
            const currentTime = Date.now();
            const timeDelta = currentTime - lastTime;
            
            currentTranslate = prevTranslate + (x - startPos);
            container.style.transform = `translateX(${currentTranslate}px)`;
            
            // Calculate velocity
            if (timeDelta > 0) {
                velocity = (x - startPos) / timeDelta;
            }
            lastTime = currentTime;
        }

        function handleEnd() {
            if (!isDragging) return;
            isDragging = false;
            container.classList.add('smooth-transition');

            const itemWidth = container.offsetWidth;
            const timeDelta = Date.now() - startTime;
            const momentum = velocity * 300; // Adjust multiplier for throw sensitivity
            
            let targetIndex = currentIndex + Math.round(
                (currentTranslate + momentum) / -itemWidth
            ) - currentIndex;

            // Normal swipe detection if momentum is small
            if (Math.abs(momentum) < 50) {
                targetIndex = Math.round(currentTranslate / -itemWidth);
            }

            targetIndex = Math.max(0, Math.min(targetIndex, items.length - 1));
            goToIndex(targetIndex);
        }

        // Event Listeners
        container.addEventListener('touchstart', e => handleStart(e.touches[0].clientX));
        container.addEventListener('touchmove', e => handleMove(e.touches[0].clientX));
        container.addEventListener('touchend', handleEnd);

        container.addEventListener('mousedown', e => handleStart(e.pageX));
        container.addEventListener('mousemove', e => handleMove(e.pageX));
        container.addEventListener('mouseup', handleEnd);
        container.addEventListener('mouseleave', handleEnd);

        // Resize handler
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                items = container.querySelectorAll('.guide-preview-item');
                initIndicators();
                goToIndex(currentIndex);
            }, 250);
        });

        initIndicators();
    }
});
