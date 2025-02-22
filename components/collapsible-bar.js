document.addEventListener('DOMContentLoaded', function() {
    const collapsibleBars = document.querySelectorAll('.collapsible-bar');

    collapsibleBars.forEach(bar => {
        bar.addEventListener('click', function() {
            const content = bar.nextElementSibling; // Get the corresponding content
            const arrow = bar.querySelector('.collapsible-bar-arrow'); // Get the arrow inside the bar

            bar.classList.toggle('active');
            content.classList.toggle('open');
            arrow.classList.toggle('rotate');
        });
    });
});
