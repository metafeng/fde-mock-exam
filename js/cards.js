// ===== 术语卡片：先认词再刷题 =====
// 依赖：GLOSSARY（js/glossary.js）、BANK、MODULES、$、show、newExam、enterExam、homeStep
(function () {
  const G = window.GLOSSARY || [];
  const CARD_KEY = "fde-mock-cards"; // { 术语id: { k: 1 认识 / 0 不认识, n: 看过次数, t: 时间 } }
  const PREF_KEY = "fde-mock-cards-pref";

  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const ic = (n, c) => (window.iconSvg ? window.iconSvg(n, c) : "");
  // 术语图标：模块配色的圆角方块里放线性图标
  const tile = (g, size) => { const c = (window.MODULE_COLORS || [])[g.m] || ["#3b8bff", "#0a5ce6"]; return `<span class="term-tile ${size || ""}" style="background:linear-gradient(180deg,${c[0]},${c[1]})">${ic(g.icon)}</span>`; };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // 术语 id：模块 + 术语名
  G.forEach((g) => { let h = 0; const s = g.m + "|" + g.term; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; g.id = g.m + "-" + (h >>> 0).toString(36); });

  // 相关题：题干 / 考点 / 讲解里出现术语名或别名
  function related(g) {
    if (g._rel) return g._rel;
    const keys = [g.term].concat(g.aliases || []).map((k) => String(k).replace(/\s+/g, "")).filter((k) => k.length >= 2);
    g._rel = BANK.map((q, i) => i).filter((i) => {
      const q = BANK[i], txt = (q.q + q.k + (q.c || "")).replace(/\s+/g, "");
      return keys.some((k) => txt.includes(k));
    });
    return g._rel;
  }
  // 学习顺序：官方占比高、在题库里出现多、模块内排序靠前的先学
  const priority = (g) => MODULES[g.m][1] * 3 + Math.min(related(g).length, 12) - g.rank * 0.8;

  let P = Object.assign({ mod: "all", view: "card", filter: "new" }, load(PREF_KEY, {}));
  let queue = [], pos = 0, flipped = false;
  const st = () => load(CARD_KEY, {});
  const pool = () => G.filter((g) => P.mod === "all" || g.m === +P.mod);

  function buildQueue() {
    const s = st();
    let list = pool().slice();
    if (P.filter === "new") list = list.filter((g) => !(s[g.id] && s[g.id].k === 1));
    // 标过「不认识」的排最前，其次没看过的，组内按优先级
    list.sort((a, b) => {
      const ra = s[a.id] ? (s[a.id].k === 0 ? 0 : 2) : 1, rb = s[b.id] ? (s[b.id].k === 0 ? 0 : 2) : 1;
      return ra - rb || priority(b) - priority(a);
    });
    queue = list; pos = 0; flipped = false;
  }

  function mark(g, known) {
    const s = st(), o = s[g.id] || { n: 0 };
    o.n++; o.k = known ? 1 : 0; o.t = Date.now(); s[g.id] = o; store(CARD_KEY, s);
  }

  // ---- 头部：标题、进度、模块筛选 ----
  function renderHead() {
    const s = st(), all = pool(), known = all.filter((g) => s[g.id] && s[g.id].k === 1).length;
    const totalKnown = G.filter((g) => s[g.id] && s[g.id].k === 1).length;
    $("#cvSummary").innerHTML = `${P.mod === "all" ? "全部模块" : MODULES[+P.mod][0]}：已掌握 <b>${known}</b> / ${all.length}　·　总计 ${totalKnown} / ${G.length}`;
    $("#cvBar").style.width = (all.length ? (known / all.length) * 100 : 0) + "%";
    const chip = (v, label, sub) => `<button type="button" data-mod="${v}" class="${String(P.mod) === String(v) ? "on" : ""}">${label}<small>${sub}</small></button>`;
    $("#cvMods").innerHTML = chip("all", "全部", `${totalKnown}/${G.length}`) + MODULES.map((md, m) => {
      const ts = G.filter((g) => g.m === m); if (!ts.length) return "";
      const k = ts.filter((g) => s[g.id] && s[g.id].k === 1).length;
      return chip(m, md[0], `${k}/${ts.length}`);
    }).join("");
    $("#cvMods").querySelectorAll("button").forEach((b) => (b.onclick = () => { P.mod = b.dataset.mod; store(PREF_KEY, P); buildQueue(); render(); }));
    [["#cvView", "view"], ["#cvFilter", "filter"]].forEach(([sel, key]) => $(sel).querySelectorAll("button").forEach((b) => {
      b.classList.toggle("on", P[key] === b.dataset.v);
      b.onclick = () => { P[key] = b.dataset.v; store(PREF_KEY, P); buildQueue(); render(); };
    }));
  }

  // ---- 图解：把概念结构画出来 ----
  function visualHtml(v, g) {
    if (!v || !v.type) return "";
    const c = (window.MODULE_COLORS || [])[g.m] || ["#3b8bff", "#0a5ce6"];
    const it = (x, i) => `<div class="vz-item"><span class="vz-n" style="background:${c[1]}">${i + 1}</span><b>${esc(x.t)}</b>${x.d ? `<span>${esc(x.d)}</span>` : ""}</div>`;
    const items = v.items || [];
    let body = "";
    if (v.type === "flow") body = `<div class="vz-flow">${items.map((x, i) => (i ? `<span class="vz-arrow" aria-hidden="true">→</span>` : "") + it(x, i)).join("")}</div>`;
    else if (v.type === "cycle") body = `<div class="vz-flow vz-cycle">${items.map((x, i) => (i ? `<span class="vz-arrow" aria-hidden="true">→</span>` : "") + it(x, i)).join("")}<span class="vz-back" aria-hidden="true">↺ 回到「${esc(items[0] ? items[0].t : "")}」</span></div>`;
    else if (v.type === "stack") body = `<div class="vz-stack">${items.map((x, i) => `<div class="vz-layer" style="--w:${100 - i * (36 / Math.max(items.length, 1))}%;background:linear-gradient(90deg,${c[0]}22,${c[1]}14)"><b>${esc(x.t)}</b>${x.d ? `<span>${esc(x.d)}</span>` : ""}</div>`).join("")}</div>`;
    else if (v.type === "levels") {
      const m = v.mark && v.mark.between;
      body = `<div class="vz-levels">${items.map((x, i) => {
        const gap = m && i === m[1] ? `<div class="vz-gap"><span>${esc(v.mark.label || "")}</span></div>` : "";
        return gap + `<div class="vz-lv" style="--h:${30 + i * (60 / Math.max(items.length - 1, 1))}%"><div class="vz-bar" style="background:linear-gradient(180deg,${c[0]},${c[1]})"></div><b>${esc(x.t)}</b>${x.d ? `<span>${esc(x.d)}</span>` : ""}</div>`;
      }).join("")}</div>`;
    } else if (v.type === "compare") {
      const side = (s2, cls) => `<div class="vz-side ${cls}"><b>${esc(s2.t)}</b><ul>${(s2.items || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
      body = `<div class="vz-compare">${side(v.left || {}, "l")}<span class="vz-vs">VS</span>${side(v.right || {}, "r")}</div>`;
    } else if (v.type === "grid") body = `<div class="vz-grid n${Math.min(items.length, 4)}">${items.map(it).join("")}</div>`;
    return `<figure class="vz"><figcaption>${ic("grid")}图解</figcaption>${body}${v.note ? `<p class="vz-note">${esc(v.note)}</p>` : ""}</figure>`;
  }

  // 要点：「标题：内容」把标题加粗
  const pointHtml = (p) => { const m = String(p).match(/^([^：:]{1,16})[：:](.+)$/); return m ? `<b>${esc(m[1])}</b>${esc(m[2])}` : esc(p); };

  function backHtml(g) {
    const rel = related(g);
    return `
      <p class="cb-plain">${esc(g.plain)}</p>
      ${visualHtml(g.visual, g)}
      ${g.example ? `<div class="cb-example"><span class="cb-tag t-ex">${ic("chat")}举个例子</span><p>${esc(g.example)}</p></div>` : ""}
      <div class="cb-sec"><span class="cb-tag t-pt">${ic("list")}要点</span><ol class="cb-points">${(g.points || []).map((p) => `<li>${pointHtml(p)}</li>`).join("")}</ol></div>
      ${g.analogy || g.confuse ? `<div class="cb-duo">
        ${g.analogy ? `<div class="cb-note n-ana"><span class="cb-tag t-ana">${ic("bulb")}类比</span><p>${esc(g.analogy)}</p></div>` : ""}
        ${g.confuse ? `<div class="cb-note n-conf"><span class="cb-tag t-conf">${ic("alert")}易混</span><p>${esc(g.confuse)}</p></div>` : ""}
      </div>` : ""}
      ${g.mnemonic ? `<div class="cb-mn">${ic("music")}<span>口诀</span><b>${esc(g.mnemonic)}</b></div>` : ""}
      <p class="cb-foot"><span class="cb-src">${ic("book")}出处：${esc(g.src)}</span>${rel.length ? `<button type="button" class="link cb-rel" data-id="${g.id}">练相关题（${rel.length}）→</button>` : ""}</p>`;
  }

  function practiceRelated(id) {
    const g = G.find((x) => x.id === id); if (!g) return;
    const ids = related(g).slice().sort(() => Math.random() - 0.5).slice(0, 15);
    if (!ids.length) return;
    $("#resumeBtn").hidden = true;
    newExam(ids, "practice", "cards"); enterExam();
  }

  // ---- 卡片模式 ----
  function renderCard() {
    const body = $("#cvBody");
    if (!queue.length) {
      body.innerHTML = `<div class="cv-done"><b>${P.filter === "new" ? "这一组全部掌握了" : "这个模块还没有卡片"}</b><p>${P.filter === "new" ? "可以切到「全部」再复习一遍，或者去分章节专项练习检验一下。" : ""}</p>
        <div class="cv-done-act"><button type="button" class="btn" id="cvAll">复习全部卡片</button><button type="button" class="btn primary" id="cvHome">回首页做题</button></div></div>`;
      const a = $("#cvAll"); if (a) a.onclick = () => { P.filter = "all"; store(PREF_KEY, P); buildQueue(); render(); };
      $("#cvHome").onclick = () => { renderHome(); show("startView"); };
      return;
    }
    if (pos >= queue.length) pos = 0;
    const g = queue[pos], s = st()[g.id];
    const badge = s ? (s.k === 1 ? `<span class="cf-badge ok">已掌握</span>` : `<span class="cf-badge no">不认识 ×${s.n}</span>`) : `<span class="cf-badge">新</span>`;
    body.innerHTML = `
      <div class="cv-count">第 ${pos + 1} / ${queue.length} 张</div>
      <div class="flash ${flipped ? "flipped" : ""}" id="flash" tabindex="0" role="button" aria-label="翻面">
        <div class="flash-front">
          ${tile(g, "big")}
          <div><span class="cf-mod">${esc(MODULES[g.m][0])}</span>${badge}</div>
          <h2>${esc(g.term)}</h2>
          ${(g.aliases || []).length ? `<p class="cf-alias">${g.aliases.map(esc).join(" · ")}</p>` : ""}
          <p class="cf-hint">先想一想它是什么意思，再点卡片看答案</p>
        </div>
        <div class="flash-back"><div class="cb-head">${tile(g)}<div><h3>${esc(g.term)}</h3><span class="cf-mod">${esc(MODULES[g.m][0])}</span></div></div>${backHtml(g)}</div>
      </div>
      <div class="cv-act">
        ${flipped
          ? `<button type="button" class="btn act-no" id="cvNo">不认识，等会再看</button><button type="button" class="btn primary act-ok" id="cvOk">认识了</button>`
          : `<button type="button" class="btn primary act-flip" id="cvFlip">看答案</button>`}
      </div>
      <p class="cv-keys">快捷键：空格翻面　← 不认识　→ 认识了</p>`;
    $("#flash").onclick = (e) => { if (e.target.closest(".cb-rel")) return; flipped = !flipped; renderCard(); };
    const f = $("#cvFlip"); if (f) f.onclick = () => { flipped = true; renderCard(); };
    const no = $("#cvNo"); if (no) no.onclick = () => answer(false);
    const ok = $("#cvOk"); if (ok) ok.onclick = () => answer(true);
    body.querySelectorAll(".cb-rel").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); practiceRelated(b.dataset.id); }));
  }

  function answer(known) {
    const g = queue[pos];
    mark(g, known);
    if (known && P.filter === "new") queue.splice(pos, 1);
    else if (!known) { queue.splice(pos, 1); queue.splice(Math.min(pos + 4, queue.length), 0, g); } // 不认识：隔几张再出现
    else pos++;
    flipped = false;
    renderHead(); renderCard();
  }

  // ---- 列表速览 ----
  function renderList() {
    const s = st();
    const groups = MODULES.map((md, m) => ({ m, items: queue.filter((g) => g.m === m) })).filter((x) => x.items.length);
    $("#cvBody").innerHTML = groups.length ? groups.map(({ m, items }) => `
      <section class="cl-group"><h4>${esc(MODULES[m][0])}</h4>
        ${items.map((g) => { const k = s[g.id] && s[g.id].k === 1; return `
          <details class="cl-item ${k ? "known" : ""}">
            <summary><span class="cl-term">${tile(g, "sm")}<span>${esc(g.term)}</span></span><span class="cl-plain">${esc(g.plain)}</span>${g.mnemonic ? `<span class="cl-mn">${esc(g.mnemonic)}</span>` : ""}</summary>
            <div class="cl-body">${backHtml(g)}
              <div class="cl-act"><button type="button" class="btn ${k ? "" : "primary"}" data-k="${g.id}">${k ? "标为没掌握" : "标为已掌握"}</button></div>
            </div>
          </details>`; }).join("")}
      </section>`).join("") : `<div class="cv-done"><b>没有需要复习的卡片</b><p>切到「全部」可以查看所有术语。</p></div>`;
    $("#cvBody").querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => {
      const g = G.find((x) => x.id === b.dataset.k), cur = st()[g.id];
      mark(g, !(cur && cur.k === 1)); renderHead();
      const d = b.closest("details"); d.classList.toggle("known"); b.textContent = d.classList.contains("known") ? "标为没掌握" : "标为已掌握"; b.classList.toggle("primary");
    }));
    $("#cvBody").querySelectorAll(".cb-rel").forEach((b) => (b.onclick = (e) => { e.preventDefault(); practiceRelated(b.dataset.id); }));
  }

  function render() { renderHead(); P.view === "list" ? renderList() : renderCard(); }

  function openCards() { buildQueue(); render(); show("cardView"); window.scrollTo(0, 0); }

  // 首页入口上的进度
  function updateEntry() {
    const el = $("#cardsEntrySub"); if (!el) return;
    const s = st(), k = G.filter((g) => s[g.id] && s[g.id].k === 1).length;
    el.textContent = G.length ? `${G.length} 个核心术语 · 已掌握 ${k} 个 · 大白话 + 类比 + 易混点 + 口诀` : "术语卡片整理中";
  }
  const _renderHome = window.renderHome;
  window.renderHome = function () { _renderHome && _renderHome(); updateEntry(); };

  $("#cardsEntry").onclick = openCards;
  document.addEventListener("keydown", (e) => {
    if ($("#cardView").hidden || P.view !== "card" || !queue.length || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === " ") { e.preventDefault(); flipped = !flipped; renderCard(); }
    else if (flipped && e.key === "ArrowLeft") answer(false);
    else if (flipped && e.key === "ArrowRight") answer(true);
  });
  updateEntry();
})();
