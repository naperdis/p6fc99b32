"use strict";
/* Открытая часть: только вход. Само приложение лежит в закрытом хранилище и загружается после входа, участникам.
   Ключ ниже публичный по своей природе: без входа сервер не отдаёт ни данных, ни кода. */
const CFG = {url: "https://fqzrzkldjaffuarevuok.supabase.co", key: "sb_publishable_U_ps7lq1WParIcW-axtzfw_4KiZI6hh"};
const sb = supabase.createClient(CFG.url, CFG.key);
const DEV = location.hostname === "localhost";                              /* на своём компьютере код берётся из соседней папки */
const LOCAL = DEV && new URLSearchParams(location.search).has("local");     /* пробный режим без входа и без базы */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));

const G = {on: true, mode: "load", err: "", wait: false, name: "", pin: "", code: ""};
const GERR = {exists: "Команда уже создана. Войдите по имени и ПИНу или по коду-приглашению.", invite: "Код-приглашение не подошёл.", taken: "Такое имя в команде уже есть. Выберите другое.", pin: "ПИН слишком короткий: нужно от 6 знаков.", name: "Введите имя.", no_team: "Команды ещё нет: её создаёт первый вошедший.", user: "Не получилось создать вход. Попробуйте другое имя."};

/* заставка: видна с первой отрисовки страницы и не короче 0,6 с, чтобы не мелькала */
const T0 = performance.now();
function splash(on) {
  const el = $("splash"); if (!el) return;
  if (on) { clearTimeout(splash.t); el.hidden = false; el.classList.remove("off"); return; }
  if (el.hidden || el.classList.contains("off")) return;
  clearTimeout(splash.t);
  splash.t = setTimeout(() => { el.classList.add("off"); splash.t = setTimeout(() => { el.hidden = true; }, 360); }, Math.max(0, 600 - (performance.now() - T0)));
}
async function gate(body) {
  const {data} = await sb.auth.getSession(), h = {apikey: CFG.key, "Content-Type": "application/json"};
  if (data.session) h.Authorization = "Bearer " + data.session.access_token;
  const r = await fetch(CFG.url + "/functions/v1/gate", {method: "POST", headers: h, body: JSON.stringify(body)});
  return Object.assign({status: r.status}, await r.json().catch(() => ({})));
}
/* вход идёт только через сервер: он считает неверные попытки и блокирует перебор */
async function enter(name, pin) {
  const r = await gate({action: "login", name, pin});
  if (!r.ok || !r.session) return r;
  const {error} = await sb.auth.setSession(r.session);
  return error ? {error: "session"} : {ok: true};
}
const LOCKED = m => `Слишком много неверных попыток. Попробуйте через ${m || 10} мин.`;

function drawGate() {
  const v = k => esc(G[k] || ""), view = $("view");
  const f = (id, label, val, extra) => `<label class="fl"><span>${label}</span><input id="${id}" value="${val}" ${extra}></label>`;
  const nameF = f("gname", "Имя", v("name"), 'maxlength="40" autocomplete="username" autocapitalize="words"');
  const pinF = hint => f("gpin", hint, v("pin"), `type="password" maxlength="72" autocomplete="${G.mode === "login" ? "current-password" : "new-password"}"`);
  const err = G.err ? `<div class="sub" style="color:var(--hub-alert)" role="alert">${esc(G.err)}</div>` : "";
  const btn = t => `<button class="pill wide" data-g="submit"${G.wait ? " disabled" : ""}>${G.wait ? "Секунду…" : t}</button>`;
  let h;
  /* загрузка: заставка поверх экрана, пока идёт вход и подгружается приложение */
  if (G.mode === "load") { splash(true); view.innerHTML = ""; view.className = "notab"; $("tab").innerHTML = ""; $("layer").innerHTML = ""; $("idea").innerHTML = ""; return; }
  splash(false);
  if (G.mode === "offline") h = `<div class="t32">Нет связи</div><div class="sub" style="font-size:15px">Не получилось связаться с сервером. Проверьте интернет и попробуйте ещё раз.</div><button class="pill wide" data-g="retry">Повторить</button>`;
  else if (G.mode === "create") h = `<div class="t32">Новая команда</div><div class="sub" style="font-size:15px">Вы здесь первый. Задайте имя и ПИН: по ним вы будете входить с любого устройства. Остальных пригласите кодом из настроек.</div>${nameF}${pinF("ПИН, от 6 знаков")}${err}${btn("Создать")}`;
  else if (G.mode === "join") h = `<div class="t32">По приглашению</div><div class="sub" style="font-size:15px">Введите код, который вам дали, и придумайте себе имя и ПИН.</div>${f("gcode", "Код-приглашение", v("code"), 'maxlength="12" autocomplete="off" autocapitalize="characters"')}${nameF}${pinF("Придумайте ПИН, от 6 знаков")}${err}${btn("Войти в команду")}<button class="link" data-g="login">У меня уже есть имя и ПИН</button>`;
  else h = `<div class="t32">Вход</div>${nameF}${pinF("ПИН")}${err}${btn("Войти")}<button class="link" data-g="join">У меня код-приглашение</button>`;
  view.innerHTML = `<div class="mid">${h}</div>`; view.className = "notab fade";
  $("tab").innerHTML = ""; $("layer").innerHTML = ""; $("idea").innerHTML = "";
}
/* показать вход: приложение зовёт это при выходе и когда участника убрали */
async function showGate(mode, err) {
  G.on = true; G.err = err || ""; G.wait = false; G.pin = "";
  if (mode) { G.mode = mode; return drawGate(); }
  G.mode = "load"; drawGate();
  const st = await gate({action: "state"}).catch(() => ({}));
  G.mode = st.status === 200 ? (st.hasTeam ? "login" : "create") : "offline"; drawGate();
}
async function loadApp() {
  G.on = false;
  if (window.__app) return start();   /* код уже загружен: просто входим заново */
  let code;
  try {
    if (DEV) code = await Promise.all(["core.js", "ui.js", "brandkit.js", "studio.js", "profile.js", "actions.js"].map(f => fetch("../src/" + f, {cache: "no-store"}).then(r => { if (!r.ok) throw new Error(f); return r.text(); })));
    else { const {data, error} = await sb.storage.from("app").download("bundle.js"); if (error) throw error; code = [await data.text()]; }
  } catch (e) { console.error(e); return showGate("offline"); }
  window.__app = true;
  const s = document.createElement("script"); s.textContent = code.join("\n;\n"); document.head.appendChild(s);
}
async function submitGate() {
  const nm = G.name.trim(), pin = G.pin, code = G.code.trim();
  if (G.wait) return;
  if (!nm) { G.err = GERR.name; return drawGate(); }
  if (pin.length < 6 && G.mode !== "login") { G.err = GERR.pin; return drawGate(); }
  if (G.mode === "join" && !code) { G.err = "Введите код-приглашение."; return drawGate(); }
  G.wait = true; G.err = ""; drawGate();
  try {
    if (G.mode !== "login") {
      const r = await gate(G.mode === "create" ? {action: "create", name: nm, pin} : {action: "join", name: nm, pin, invite: code});
      if (!r.ok) { G.wait = false; G.err = r.error === "locked" ? LOCKED(r.minutes) : GERR[r.error] || "Не получилось. Попробуйте ещё раз."; if (r.error === "exists") G.mode = "login"; return drawGate(); }
    }
    const e = await enter(nm, pin);
    if (!e.ok) { G.wait = false; G.err = e.error === "locked" ? LOCKED(e.minutes) : e.error === "bad" ? "Имя или ПИН не подошли." + (e.left ? ` Осталось попыток: ${e.left}.` : "") : "Не получилось войти. Попробуйте ещё раз."; return drawGate(); }
    G.pin = ""; G.wait = false; G.mode = "load"; drawGate(); await loadApp();
  } catch (e) { console.error(e); G.wait = false; G.err = "Нет связи с сервером. Проверьте интернет."; drawGate(); }
}
document.addEventListener("click", e => {
  const el = e.target.closest("[data-g]"); if (!el || !G.on || el.disabled) return;
  const a = el.dataset.g;
  if (a === "submit") submitGate(); else if (a === "retry") showGate(); else { G.mode = a; G.err = ""; drawGate(); }
});
document.addEventListener("input", e => { if (G.on && /^g(name|pin|code)$/.test(e.target.id)) G[e.target.id.slice(1)] = e.target.value; });
document.addEventListener("keydown", e => { if (G.on && e.key === "Enter" && /^g(name|pin|code)$/.test(e.target.id)) submitGate(); });
addEventListener("online", () => { if (G.on && G.mode === "offline") showGate(); });

(async () => {
  drawGate();
  if (LOCAL) return loadApp();
  const {data} = await sb.auth.getSession();
  if (data.session) loadApp(); else showGate();
})();
