(() => {
  const bubble = document.getElementById('chat-bubble');
  if (!bubble) return;

  const scriptSrc = bubble.getAttribute('data-chatbot-src');
  if (!scriptSrc) return;

  let loaded = false;
  let loading = false;

  const loadChatbot = (openAfterLoad) => {
    if (loaded || loading) return;
    loading = true;
    const script = document.createElement('script');
    script.src = scriptSrc;
    script.defer = true;
    script.onload = () => {
      loaded = true;
      loading = false;
      if (openAfterLoad) {
        // Let the chatbot script bind its handlers, then open.
        setTimeout(() => bubble.click(), 0);
      }
    };
    script.onerror = () => {
      loading = false;
    };
    document.head.appendChild(script);
  };

  const userInteractionEvents = ['pointerdown', 'keydown', 'scroll'];
  const onFirstInteraction = () => {
    loadChatbot(false);
    userInteractionEvents.forEach((evt) => {
      window.removeEventListener(evt, onFirstInteraction, { passive: true });
    });
  };

  userInteractionEvents.forEach((evt) => {
    window.addEventListener(evt, onFirstInteraction, { passive: true });
  });

  bubble.addEventListener('click', (event) => {
    if (loaded) return;
    event.preventDefault();
    loadChatbot(true);
  });
})();
