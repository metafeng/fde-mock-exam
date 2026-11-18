// ===== 练习数据跨设备同步 =====
// 线上站点登录后，把练习数据（做题记录、错题集、成绩、进行中的考试等）存到服务器，按账号同步。
// 本地直接打开（没有 /api/state 接口）时自动退回到只用浏览器本地存储。
//
// 流程：先拉取服务器数据并与本地合并 → 再加载页面脚本；之后本地每次写入 1.5 秒内自动上传；
// 切回页面时检查其他设备是否有更新。
(function () {
  const KEYS = ["fde-mock-qstat", "fde-mock-wrong", "fde-mock-hist", "fde-mock-seen", "fde-mock-topic", "fde-mock-mode", "fde-mock-v2", "fde-mock-cards"];
  const META_KEY = "fde-sync-meta"; // 每个 key 的本地修改时间
  const REV_KEY = "fde-sync-rev";   // 本地已同步到的服务器版本号
  const OWNER_KEY = "fde-sync-user"; // 本地缓存属于哪个账号
  const APP_SCRIPTS = ["js/questions.js", "js/glossary.js", "js/app.js", "js/topic.js", "js/cards.js", "js/account.js"];

  const ls = window.localStorage;
  const rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
  const get = (k) => { try { return ls.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { v == null ? rawRemove.call(ls, k) : rawSet.call(ls, k, v); } catch (e) {} };
  const loadMeta = () => { try { return JSON.parse(get(META_KEY) || "{}"); } catch (e) { return {}; } };
  const saveMeta = (m) => put(META_KEY, JSON.stringify(m));
  const parse = (s, d) => { try { return s == null ? d : JSON.parse(s); } catch (e) { return d; } };

  let enabled = false, rev = Number(get(REV_KEY) || 0), timer = null, pushing = false, dirty = false;

  // ---- 状态提示 ----
  function status(text, cls) {
    const el = document.getElementById("syncState");
    if (!el) return;
    el.hidden = false; el.textContent = text; el.className = "sync-state " + (cls || "");
  }

  // ---- 合并：做题记录取做得多的；错题集与已出题合并；其余按最后修改时间 ----
  function mergeKey(k, a, b, ta, tb) {
    if (a == null) return b; if (b == null) return a;
    if (k === "fde-mock-qstat") {
      const x = parse(a, {}), y = parse(b, {}), out = { ...x };
      for (const id in y) if (!out[id] || (y[id].n || 0) > (out[id].n || 0)) out[id] = y[id];
      return JSON.stringify(out);
    }
    if (k === "fde-mock-wrong") {
      const x = parse(a, {}), y = parse(b, {}), out = { ...x };
      for (const id in y) if (!out[id] || (y[id].n || 0) > (out[id].n || 0)) out[id] = y[id];
      return JSON.stringify(out);
    }
    if (k === "fde-mock-cards") {
      const x = parse(a, {}), y = parse(b, {}), out = { ...x };
      for (const id in y) if (!out[id] || (y[id].t || 0) > (out[id].t || 0)) out[id] = y[id];
      return JSON.stringify(out);
    }
    if (k === "fde-mock-seen") return JSON.stringify({ ...parse(a, {}), ...parse(b, {}) });
    return (ta || 0) >= (tb || 0) ? a : b;
  }
  // 把服务器数据合并进本地；返回本地是否有服务器没有的内容（需要回传）
  function mergeIntoLocal(remote) {
    const meta = loadMeta(), rdata = remote.data || {}, rmeta = remote.meta || {};
    let needPush = false;
    KEYS.forEach((k) => {
      const l = get(k), r = rdata[k] == null ? null : rdata[k];
      const merged = mergeKey(k, l, r, meta[k], rmeta[k]);
      if (merged !== l) put(k, merged);
      if (merged !== r) needPush = true;
      meta[k] = Math.max(meta[k] || 0, rmeta[k] || 0);
    });
    saveMeta(meta);
    return needPush;
  }
  function snapshot() {
    const data = {}; KEYS.forEach((k) => { const v = get(k); if (v != null) data[k] = v; });
    return { data, meta: loadMeta() };
  }

  // 清掉本地缓存的练习数据（退出登录、或换了账号时）
  function clearLocal() {
    KEYS.concat([META_KEY, REV_KEY, OWNER_KEY]).forEach((k) => { try { rawRemove.call(ls, k); } catch (e) {} });
    rev = 0;
  }

  // ---- 上传 ----
  async function push() {
    if (!enabled) return;
    if (pushing) { dirty = true; return; }
    const snap = snapshot();
    // 安全保护：本地完全没有数据时，不拿空数据覆盖服务器上已有的进度
    if (!Object.keys(snap.data).length && rev > 0) return;
    pushing = true; dirty = false; status("同步中…", "busy");
    try {
      for (let i = 0; i < 3; i++) {
        const body = JSON.stringify({ baseRev: rev, ...snapshot() });
        const r = await fetch("api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body, credentials: "same-origin", keepalive: body.length < 60000 });
        if (r.status === 409) { const cur = await r.json(); mergeIntoLocal(cur); rev = cur.rev; put(REV_KEY, String(rev)); continue; }
        if (!r.ok) throw new Error(r.status);
        rev = (await r.json()).rev; put(REV_KEY, String(rev));
        break;
      }
      status("已同步", "ok");
    } catch (e) { status("未同步（离线）", "off"); dirty = true; }
    pushing = false;
    if (dirty) schedule(3000);
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(() => { timer = null; push(); }, ms == null ? 1500 : ms); }

  // 拦截本地写入：同步相关的 key 变化后记下时间并安排上传
  function touch(k) {
    if (!KEYS.includes(k)) return;
    const m = loadMeta(); m[k] = Date.now(); saveMeta(m);
    if (enabled) schedule();
  }
  Storage.prototype.setItem = function (k, v) { rawSet.call(this, k, v); if (this === ls) touch(k); };
  Storage.prototype.removeItem = function (k) { rawRemove.call(this, k); if (this === ls) touch(k); };
  Storage.prototype.clear = (function (orig) { return function () { orig.call(this); }; })(Storage.prototype.clear);

  // ---- 加载页面脚本 ----
  function loadApp() {
    let i = 0;
    const next = () => { if (i >= APP_SCRIPTS.length) return; const s = document.createElement("script"); s.src = APP_SCRIPTS[i++]; s.onload = next; document.body.appendChild(s); };
    next();
  }

  // ---- 启动：先同步再加载 ----
  async function boot() {
    let started = false;
    const start = () => { if (!started) { started = true; loadApp(); } };
    const guard = setTimeout(() => { status("未同步（离线）", "off"); start(); }, 4000); // 网络慢时不让页面卡住
    try {
      const r = await fetch("api/state", { credentials: "same-origin", cache: "no-store" });
      const ct = r.headers.get("content-type") || "";
      if (!r.ok || !ct.includes("json")) throw new Error("no-sync");
      const remote = await r.json();
      enabled = true;
      const owner = get(OWNER_KEY);
      if (owner && remote.user && owner !== remote.user) clearLocal(); // 上一个登录的是别的账号：不能把他的数据并进来
      if (remote.user) put(OWNER_KEY, remote.user);
      window.FDE_USER = remote.user || null;
      const needPush = mergeIntoLocal(remote);
      rev = remote.rev; put(REV_KEY, String(rev));
      status(remote.user ? `已同步 · ${remote.user}` : "已同步", "ok");
      if (needPush) schedule(300);
    } catch (e) { /* 本地模式：不显示同步状态 */ }
    clearTimeout(guard);
    start();
  }

  // ---- 切回页面时：先把本地改动传上去，再看别的设备有没有更新 ----
  async function checkRemote() {
    if (!enabled || pushing) return;
    try {
      const r = await fetch("api/state?since=" + rev, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      if (!d.changed) return;
      mergeIntoLocal(d); rev = d.rev; put(REV_KEY, String(rev));
      const onHome = !document.getElementById("startView").hidden;
      const modalOpen = [...document.querySelectorAll(".modal")].some((m) => !m.hidden);
      if (onHome && !modalOpen) location.reload(); // 在首页时直接刷新，显示其他设备的最新进度
      else status("其他设备有更新，回到首页后生效", "busy");
    } catch (e) {}
  }
  document.addEventListener("visibilitychange", () => {
    if (!enabled) return;
    if (document.visibilityState === "hidden") { if (timer) { clearTimeout(timer); timer = null; push(); } }
    else checkRemote();
  });
  window.addEventListener("online", () => { if (enabled) push(); });

  // 给账号菜单用：退出登录前先把没传完的进度传上去，再清空本地缓存
  window.fdeSync = {
    async flushAndClear() {
      if (enabled) { clearTimeout(timer); timer = null; try { await push(); } catch (e) {} }
      clearLocal();
    },
  };

  boot();
})();
