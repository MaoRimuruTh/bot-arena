// Notices while BoT Arena sits in the background: your turn in a friend game, a friend joining your room, a new room
// in the lobby, a game ending. There is no push server, so they only come while the app is open in a tab or as the
// installed app, and only after you switch them on in settings. The tab title also gets a dot, notices on or off.
const KEY = "bot.notify";
export const notifySupported = () => "Notification" in window;
export const notifyOn = () => { try { return notifySupported() && localStorage.getItem(KEY) === "1" && Notification.permission === "granted"; } catch { return false; } };
export const notifyBlocked = () => notifySupported() && Notification.permission === "denied";
export async function setNotify(on) {
  let ok = false;
  if (on && notifySupported()) { let p = Notification.permission; if (p === "default") { try { p = await Notification.requestPermission(); } catch { p = "denied"; } } ok = p === "granted"; }
  try { localStorage.setItem(KEY, ok ? "1" : "0"); } catch { /* storage off */ }
  return ok;
}
// a dot in the tab title until the page is looked at again
let base = null;
function mark() { if (base == null) base = document.title; document.title = "● " + base; }
document.addEventListener("visibilitychange", () => { if (!document.hidden && base != null) { document.title = base; base = null; } });
export async function notify(title, body, tag = "bot") {
  if (!document.hidden) return; mark();
  if (!notifyOn()) return;
  const opts = { body, tag, renotify: true, icon: "assets/icon-192.png", badge: "assets/icon-192.png", data: { url: location.href } };
  try { const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null; if (reg) await reg.showNotification(title, opts); else new Notification(title, opts); }
  catch { /* the browser refused; the title dot is still there */ }
}
