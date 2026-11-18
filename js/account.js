// ===== 账号菜单：显示当前账号、同步状态、修改密码、退出登录 =====
// 只在线上站点（有登录服务）时出现；本地直接打开时没有账号，菜单保持隐藏。
(function () {
  const $ = (s) => document.querySelector(s);
  const user = window.FDE_USER;
  if (!user) return;

  const initial = user.trim().charAt(0).toUpperCase() || "?";
  $("#acctAv").textContent = initial; $("#amAv").textContent = initial;
  $("#acctName").textContent = user; $("#amEmail").textContent = user;
  $("#acct").hidden = false;

  // 同步状态的小圆点跟着 #syncState 的颜色走
  const dot = $("#acctDot"), st = $("#syncState");
  const syncDot = () => { dot.className = "acct-dot " + (st.className.match(/\b(ok|busy|off)\b/) || [""])[0]; };
  new MutationObserver(syncDot).observe(st, { attributes: true, attributeFilter: ["class"] });
  syncDot();

  // ---- 菜单开合 ----
  const btn = $("#acctBtn"), menu = $("#acctMenu");
  const open = (v) => { menu.hidden = !v; btn.setAttribute("aria-expanded", String(v)); };
  btn.onclick = (e) => { e.stopPropagation(); open(menu.hidden); };
  document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest("#acct")) open(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { open(false); closePw(); } });

  // ---- 提示条 ----
  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200);
  }

  // ---- 退出登录：先把进度传完、清掉本地缓存，再退出 ----
  $("#amLogout").onclick = async () => {
    const b = $("#amLogout"); b.disabled = true; b.textContent = "正在保存进度…";
    try { if (window.fdeSync) await window.fdeSync.flushAndClear(); } catch (e) {}
    location.href = "/logout";
  };

  // ---- 修改密码 ----
  const pwModal = $("#pwModal"), err = $("#pwErr");
  // 密码框的小眼睛：切换明文 / 隐藏
  document.querySelectorAll("#pwForm .eye").forEach((b) => (b.onclick = () => {
    const i = b.parentNode.querySelector("input"), show = i.type === "password";
    i.type = show ? "text" : "password";
    b.setAttribute("aria-label", show ? "隐藏密码" : "显示密码"); b.setAttribute("aria-pressed", String(show));
    b.querySelector(".e-on").hidden = show; b.querySelector(".e-off").hidden = !show; i.focus();
  }));
  function resetEyes() { document.querySelectorAll("#pwForm .pw").forEach((w) => { w.querySelector("input").type = "password"; w.querySelector(".e-on").hidden = false; w.querySelector(".e-off").hidden = true; }); }
  function closePw() { pwModal.hidden = true; $("#pwForm").reset(); resetEyes(); err.hidden = true; }
  $("#amPw").onclick = () => { open(false); pwModal.hidden = false; setTimeout(() => $("#pwOld").focus(), 30); };
  $("#pwCancel").onclick = closePw;
  $("#pwForm").onsubmit = async (e) => {
    e.preventDefault();
    const oldPw = $("#pwOld").value, nw = $("#pwNew").value, nw2 = $("#pwNew2").value;
    const fail = (m) => { err.textContent = m; err.hidden = false; };
    if (nw.length < 8) return fail("新密码至少 8 位");
    if (nw !== nw2) return fail("两次输入的新密码不一致");
    if (nw === oldPw) return fail("新密码不能和当前密码相同");
    const ok = $("#pwOk"); ok.disabled = true; ok.textContent = "正在修改…";
    try {
      const r = await fetch("api/password", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ old: oldPw, new: nw }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) fail(d.error || "修改失败，请稍后再试");
      else { closePw(); toast("密码已修改。其他设备需要用新密码重新登录。"); }
    } catch (e2) { fail("网络异常，请稍后再试"); }
    ok.disabled = false; ok.textContent = "确认修改";
  };
})();
