/* Фоновый скрипт: показывает уведомление, когда оно приходит, и открывает приложение по нажатию. Страницы не кеширует. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = {}; }
  const opt = {body: d.body || "", icon: "icon-192.png", badge: "icon-192.png"};
  if (d.tag) { opt.tag = d.tag; opt.renotify = true; }
  e.waitUntil(self.registration.showNotification(d.title || "Есть новое", opt));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(ws => {
    for (const w of ws) if ("focus" in w) return w.focus();
    return self.clients.openWindow("./");
  }));
});
