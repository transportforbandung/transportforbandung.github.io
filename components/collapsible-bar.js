document.addEventListener('DOMContentLoaded', function() {
    const collapsibleBar = document.querySelector('.collapsible-bar');
    const collapsibleContent = document.querySelector('.collapsible-content');
    const arrow = document.querySelector('.arrow');

    collapsibleBar.addEventListener('click', function() {
        collapsibleBar.classList.toggle('active');
        collapsibleContent.classList.toggle('open');
        arrow.classList.toggle('rotate');
    });
});
