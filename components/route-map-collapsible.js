document.addEventListener('DOMContentLoaded', function() {
    const collapsibleBars = document.querySelectorAll('.collapsible-bar');

    collapsibleBars.forEach(bar => {
        bar.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const arrow = this.querySelector('.collapsible-bar-arrow');

            this.classList.toggle('active');
            content.classList.toggle('open');
            arrow.classList.toggle('rotate');
        });
    });
});
