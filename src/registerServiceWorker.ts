export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      console.error('Service worker registration failed', error);
    });
  });
};
