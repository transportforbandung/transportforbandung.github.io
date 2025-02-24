// Get all pop-up links
const popupLinks = document.querySelectorAll(".popup-link");

// Add event listeners to all pop-up links
popupLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
        e.preventDefault(); // Prevent the default link behavior

        // Get the target pop-up ID from the data-popup attribute
        const popupId = link.getAttribute("data-popup");

        // Show the corresponding pop-up
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.style.display = "block";
        }
    });
});

// Add event listeners to all close buttons
const closeButtons = document.querySelectorAll(".popup-close-button");
closeButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
        // Hide the parent pop-up
        const popup = btn.closest(".popup");
        if (popup) {
            popup.style.display = "none";
        }
    });
});

// Close the pop-up when clicking outside the pop-up content
window.addEventListener("click", function (e) {
    if (e.target.classList.contains("popup")) {
        e.target.style.display = "none";
    }
});
