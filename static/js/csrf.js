(() => {
  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  }

  function withCsrf(headers = {}) {
    const token = getCsrfToken();
    if (token) {
      headers['X-CSRF-Token'] = token;
    }
    return headers;
  }

  window.getCsrfToken = getCsrfToken;
  window.withCsrf = withCsrf;
})();
