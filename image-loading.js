const loaded = new Set();
export const imageLoaded = url => loaded.has(url);

function finish(img, failed = false) {
  img.classList.toggle('failed', failed);
  const container = img.closest('.portrait, .weapon-image');
  container?.classList.remove('image-loading');
  container?.removeAttribute('aria-busy');
  if (!failed) loaded.add(img.currentSrc || img.src);
}
document.addEventListener('load', event => {
  if (event.target instanceof HTMLImageElement) finish(event.target);
}, true);
document.addEventListener('error', event => {
  if (event.target instanceof HTMLImageElement) finish(event.target, true);
}, true);
function inspect(node) {
  if (!(node instanceof Element)) return;
  for (const img of node.matches('img') ? [node] : node.querySelectorAll('img')) {
    if (img.complete && img.naturalWidth) finish(img);
  }
}
new MutationObserver(records => {
  for (const record of records) for (const node of record.addedNodes) inspect(node);
}).observe(document.documentElement, {childList: true, subtree: true});

// Relative scope works both at localhost and at a GitHub Pages repository path.
export async function prepareImageCache() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  try {
    await navigator.serviceWorker.register(new URL('./image-cache-sw.js?v=303ab3f6a4af69e9', import.meta.url), {scope: './'});
    if (!navigator.serviceWorker.controller) {
      await Promise.race([
        new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once: true})),
        new Promise(resolve => setTimeout(resolve, 1200)),
      ]);
    }
  } catch { /* Images still use normal browser loading when storage is unavailable. */ }
}
