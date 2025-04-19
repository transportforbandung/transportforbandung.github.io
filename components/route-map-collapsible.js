function initializeCollapsibles() {
    document.getElementById('route-container').addEventListener('click', (e) => {
        const header = e.target.closest('.route-map-collapsible-bar');
        if (!header) return;

        const collapsible = header.parentElement;
        const content = collapsible.querySelector('.route-map-collapsible-content');
        const arrow = header.querySelector('.route-map-collapsible-bar-arrow');

        // Toggle visibility
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
        
        // Rotate arrow
        arrow.style.transform = content.style.display === 'none' 
            ? 'rotate(0deg)' 
            : 'rotate(180deg)';
    });
}
