  // Get the current page's URL and title
  const currentUrl = encodeURIComponent(window.location.href);
  const currentTitle = encodeURIComponent(document.title);

  // Update the href attributes of the share buttons
  document.getElementById('share-facebook').href = `https://facebook.com/sharer/sharer.php?u=${currentUrl}`;
  document.getElementById('share-twitter').href = `https://twitter.com/intent/tweet?url=${currentUrl}&text=${currentTitle}`;
  document.getElementById('share-linkedin').href = `https://www.linkedin.com/shareArticle?url=${currentUrl}&title=${currentTitle}`;
  document.getElementById('share-whatsapp').href = `https://wa.me/?text=${currentTitle}%20${currentUrl}`;
