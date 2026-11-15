// Per-page cleanup: timers, observers and listeners register here and are
// released whenever the router leaves the page, so nothing keeps running
// (no duplicate countdown intervals, no stray carousel autoplay).
const fns = new Set();
export function onLeave(fn) { fns.add(fn); return () => fns.delete(fn); }
export function leavePage() {
  for (const fn of fns) { try { fn(); } catch (e) { console.warn(e); } }
  fns.clear();
}
