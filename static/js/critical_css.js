document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('link[rel="stylesheet"][data-media]').forEach((link) => {
    link.media = link.dataset.media || 'all';
  });
});
