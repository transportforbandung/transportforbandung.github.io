// Get the pop-up and link elements
const popup = document.getElementById("popup");
const popupLink = document.querySelector(".popup-link");
const closeBtn = document.querySelector(".close-btn");

// Open the pop-up when the link is clicked
popupLink.addEventListener("click", function (e) {
    e.preventDefault(); // Prevent the default link behavior
    popup.style.display = "block";
});

// Close the pop-up when the close button is clicked
closeBtn.addEventListener("click", function () {
    popup.style.display = "none";
});

// Close the pop-up when clicking outside the pop-up content
window.addEventListener("click", function (e) {
    if (e.target === popup) {
        popup.style.display = "none";
    }
});
