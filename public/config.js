// Minimal client config used by public pages
// Defines `getApiUrl(path)` which client code calls to build API URLs.
(function () {
  // If you want to override the API base (for staging/production),
  // set `window.API_BASE = 'https://api.example.com'` before this script runs.
  const API_BASE = window.API_BASE || '';

  function join(base, path) {
    if (!base) return path || '';
    if (!path) return base;
    if (base.endsWith('/') && path.startsWith('/')) return base.slice(0, -1) + path;
    if (!base.endsWith('/') && !path.startsWith('/')) return base + '/' + path;
    return base + path;
  }

  window.getApiUrl = function (path) {
    return join(API_BASE, path || '');
  };

  // Expose config for debugging
  window.__APP_CONFIG__ = {
    API_BASE: API_BASE,
  };
})();
