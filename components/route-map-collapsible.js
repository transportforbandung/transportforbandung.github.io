document.addEventListener('DOMContentLoaded', function() {
    const collapsibleBars = document.querySelectorAll('.route-map-collapsible-bar');

    collapsibleBars.forEach(bar => {
        bar.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const arrow = this.querySelector('.route-map-collapsible-bar-arrow');

            this.classList.toggle('active');
            content.classList.toggle('open');
            arrow.classList.toggle('rotate');
        });
    });
});
