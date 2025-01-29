// Function to include HTML files
function includeHTML(elementId, file) {
  fetch(file)
    .then(response => response.text())
    .then(data => document.getElementById(elementId).innerHTML = data);
}
// Load header and footer
includeHTML("header", "header.html");
includeHTML("footer", "footer.html");
