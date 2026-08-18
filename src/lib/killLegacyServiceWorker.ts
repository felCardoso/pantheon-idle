/**
 * The app used to ship a vite-plugin-pwa service worker. That worker precached the old Vite
 * index.html and answers navigations from it, so a browser that registered it before the Next.js
 * migration keeps booting the dead Vite bundle — which throws "Missing VITE_SUPABASE_URL" and
 * leaves a black screen — no matter how many times we redeploy. The worker file itself is gone
 * from the server, but a registration survives until something explicitly removes it.
 *
 * Unregister every worker on this origin and drop its caches, then reload once so the current
 * page stops being served by the corpse. The `sessionStorage` mark keeps that reload from looping
 * if a browser reports a registration that refuses to go away.
 */
const RELOAD_MARK = 'legacy-sw-purged';

export async function killLegacyServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  if (registrations.length === 0) return;

  await Promise.all(registrations.map((r) => r.unregister()));
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }

  if (sessionStorage.getItem(RELOAD_MARK)) return;
  sessionStorage.setItem(RELOAD_MARK, '1');
  window.location.reload();
}
