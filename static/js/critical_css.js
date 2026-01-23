document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('link[rel="stylesheet"][data-media]').forEach((link) => {
    link.media = link.dataset.media || 'all';
  });

  const bubble = document.getElementById('chat-bubble');
  if (bubble) bubble.style.display = '';
  const panel = document.getElementById('chatbot-panel');
  if (panel) panel.style.display = '';
});
