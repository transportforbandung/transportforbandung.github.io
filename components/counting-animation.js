// Function to start the counting animation
function startCountingAnimation(counterElement, targetNumber) {
    let currentNumber = 0;
    const duration = 2000; // Animation duration in milliseconds
    const increment = targetNumber / (duration / 16); // Increment per frame (60fps)

    const updateCounter = () => {
        if (currentNumber < targetNumber) {
            currentNumber += increment;
            counterElement.textContent = Math.floor(currentNumber);
            requestAnimationFrame(updateCounter);
        } else {
            counterElement.textContent = targetNumber; // Ensure it stops at the exact target number
        }
    };

    updateCounter();
}

// Function to check if the counting section is in the viewport
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
    );
}

// Add a scroll event listener to trigger the counting animation
document.addEventListener("scroll", () => {
    const counterElement = document.querySelector(".counter");
    const targetNumber = parseInt(counterElement.getAttribute("data-target"), 10);

    if (isInViewport(counterElement) && counterElement.textContent === "0") {
        startCountingAnimation(counterElement, targetNumber);
    }
});
