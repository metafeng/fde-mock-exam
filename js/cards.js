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

  // ---- 图解：图标 + 短标题 + 一句话 ----
  let moreOpen = false; // 「展开详细说明」在卡片之间保持同一状态
  function visualHtml(v, g) {
    if (!v || !v.type) return "";
    const c = (window.MODULE_COLORS || [])[g.m] || ["#3b8bff", "#0a5ce6"];
    const TONE = { bad: ["#ff7b7b", "#e03131"], good: ["#43d17f", "#1f9d55"], warn: ["#ffbf4d", "#e8890c"] };
    const toneOf = (n) => /^(listx|ban|xcircle|stop|trash|bug|eyeoff|minus)$/.test(n) ? "bad" : /^(listcheck|check|shieldcheck|thumbup|trophy|badge|plus)$/.test(n) ? "good" : /^(alert|hourglass)$/.test(n) ? "warn" : "";
    const gradOf = (n) => { const t = TONE[toneOf(n)] || c; return `background:linear-gradient(145deg,${t[0]},${t[1]})`; };
    const icb = (name, cls, num) => `<span class="${cls || "vn-ic"}" style="${gradOf(name || g.icon)}">${window.iconSvg(name || g.icon || "bulb")}${num ? `<i class="vn-num">${num}</i>` : ""}</span>`;
    const node = (x, i, num) => `<div class="vn">${icb(x.i, "", num ? i + 1 : 0)}<b>${esc(x.t)}</b>${x.d ? `<span>${hl(x.d)}</span>` : ""}</div>`;
    const arrow = `<svg class="vz-arr" viewBox="0 0 24 12" aria-hidden="true"><path d="M1 6h20M16 1.5L21.5 6 16 10.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const items = v.items || [];
    let body = "";
    if (v.type === "flow") {
      body = `<div class="vz2-flow n${items.length}">${items.map((x, i) => (i ? arrow : "") + node(x, i, true)).join("")}</div>`;
    } else if (v.type === "cycle") {
      const n = items.length, S = 340, R = 112, cx = S / 2;
      const pos = items.map((_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + R * Math.cos(a), cx + R * Math.sin(a)]; });
      // 环上每两个节点之间画一个箭头（沿切线方向）
      const tips = items.map((_, i) => { const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / n; const x = cx + R * Math.cos(a), y = cx + R * Math.sin(a); const deg = (a * 180) / Math.PI + 90; return `<path d="M-5 -4L1 0L-5 4" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})" fill="none" stroke="${c[1]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`; }).join("");
      body = `<div class="vz2-cycle" style="--s:${S}px">
        <svg class="vz-ring" viewBox="0 0 ${S} ${S}" aria-hidden="true"><circle cx="${cx}" cy="${cx}" r="${R}" fill="none" stroke="${c[0]}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="4 5"/>${tips}</svg>
        ${items.map((x, i) => `<div class="vn vn-abs" style="left:${(pos[i][0] / S * 100).toFixed(2)}%;top:${(pos[i][1] / S * 100).toFixed(2)}%">${icb(x.i, "", i + 1)}<b>${esc(x.t)}</b>${x.d ? `<span>${esc(x.d)}</span>` : ""}</div>`).join("")}
      </div>`;
    } else if (v.type === "stack") {
      body = `<div class="vz2-stack">${items.map((x, i) => `<div class="vz2-layer" style="--w:${100 - i * (24 / Math.max(items.length - 1, 1))}%">${icb(x.i, "vn-ic sm")}<b>${esc(x.t)}</b><span>${esc(x.d || "")}</span></div>`).join("")}</div>`;
    } else if (v.type === "levels") {
      const m = v.mark && v.mark.between;
      body = `<div class="vz2-levels">${items.map((x, i) => {
        const gap = m && i === m[1] ? `<div class="vz2-cliff"><span>${esc(v.mark.label || "")}</span></div>` : "";
        return gap + `<div class="vz2-lv">${icb(x.i, "vn-ic sm")}<b>${esc(x.t)}</b>${x.d ? `<span>${esc(x.d)}</span>` : ""}<div class="vz2-bar" style="height:${18 + i * (70 / Math.max(items.length - 1, 1))}px;background:linear-gradient(180deg,${c[0]},${c[1]})"></div></div>`;
      }).join("")}</div>`;
    } else if (v.type === "compare") {
      const L = v.left || {}, Rt = v.right || {}, rows = Math.max((L.items || []).length, (Rt.items || []).length);
      const tl = toneOf(L.i || ""), tr = toneOf(Rt.i || "");
      const fix = tl === "bad" && tr === "good"; // 左错右对：中间用箭头表示「改成」
      const mark = (t) => t === "bad" ? `<em class="mk bad">✕</em>` : t === "good" ? `<em class="mk good">✓</em>` : "";
      let r = "";
      for (let i = 0; i < rows; i++) r += `<div class="cmp-c l ${tl}">${mark(tl)}<span>${esc((L.items || [])[i] || "")}</span></div><div class="cmp-mid ${fix ? "fix" : ""}">${fix ? arrow : ""}</div><div class="cmp-c r ${tr}">${mark(tr)}<span>${esc((Rt.items || [])[i] || "")}</span></div>`;
      body = `<div class="vz2-cmp">
        <div class="cmp-h l ${tl}">${window.iconSvg(L.i || "check", "ic")}<b>${esc(L.t || "")}</b></div><div class="cmp-vs">${fix ? "" : "VS"}</div><div class="cmp-h r ${tr}">${window.iconSvg(Rt.i || "xcircle", "ic")}<b>${esc(Rt.t || "")}</b></div>
        ${r}
      </div>`;
    } else {
      body = `<div class="vz2-grid n${Math.min(items.length, 5)}">${items.map((x, i) => node(x, i)).join("")}</div>`;
    }
    return `<figure class="vz2">${body}${v.note ? `<p class="vz2-note"><span>${window.iconSvg("alert", "ic")}${esc(v.note)}</span></p>` : ""}</figure>`;
  }

  // 关键参数高亮：带单位/比较符/区间/百分比的数字，以及常考的固定写法
  const UNIT = "(?:%|％|MB|GB|KB|TB|周|天|小时|分钟|秒|个月|月|年|个|条|次|人|步|层|类|项|倍|万|元|字|轮|分|名|道|张|套|题|ms)";
  const NUM = "\\d+(?:\\.\\d+)?";
  const HL_RE = new RegExp(
    "(?:UTF-8|GBK|Top\\s?K|OAuth\\s?2\\.[01]|PKCE|P0|P1|P2)" + "|" +
    "(?<![A-Za-z\\d.\\-/_])(?:(?:[≤≥＜＞]|&lt;=?|&gt;=?|不超过|至少|超过|低于|高于)\\s*" + NUM + "(?:\\s*[~～–—-]\\s*" + NUM + ")?\\s*" + UNIT + "?" +
    "|" + NUM + "\\s*[~～–—-]\\s*" + NUM + "\\s*" + UNIT + "?" +
    "|" + NUM + "\\s*" + UNIT + ")(?![A-Za-z\\d])", "g");
  const hl = (t) => esc(t).replace(HL_RE, (m) => `<mark class="kv">${m}</mark>`);

  // 要点：「标题：内容」把标题加粗
  const pointHtml = (p) => { const m = String(p).match(/^([^：:]{1,16})[：:](.+)$/); return m ? `<b>${esc(m[1])}</b>${hl(m[2])}` : hl(p); };

  // 所处位置：整个框架的阶段条，高亮当前所在一段；每一段都能点开，看这一段是什么、有哪些卡片
  function segInfo(g, i) {
    const path = g.where.path, key = path.join("|");
    const fw = (window.FRAMEWORKS || {})[key], seg = fw && fw[i] ? fw[i] : { d: "", terms: [] };
    const names = (seg.terms || []).slice();
    // 同一框架里标在这一段的卡片也算进去
    G.forEach((x) => { if (x.where && x.where.path.join("|") === key && x.where.at === i && !names.includes(x.term)) names.push(x.term); });
    const cards = names.map((n) => G.find((x) => x.term === n && x.m === g.m) || G.find((x) => x.term === n)).filter(Boolean);
    return { d: seg.d || "", cards };
  }
  function whereHtml(g) {
    const w = g.where; if (!w || !(w.path || []).length) return "";
    const c = (window.MODULE_COLORS || [])[g.m] || ["#3b8bff", "#0a5ce6"];
    return `<div class="cb-where" data-id="${g.id}"><span class="cw-h">${ic("compass")}所处位置</span><ol class="cw-path">${w.path.map((p, i) => {
      const n = segInfo(g, i).cards.length;
      return `<li class="${i === w.at ? "on" : i < w.at ? "past" : ""}"${i === w.at ? ` style="background:linear-gradient(145deg,${c[0]},${c[1]})"` : ""}><button type="button" class="cw-seg" data-seg="${i}" aria-expanded="false"><span>${esc(p)}</span>${i === w.at && w.label ? `<em>${esc(w.label)}</em>` : ""}${n ? `<i class="cw-n">${n} 张卡片</i>` : ""}</button></li>`;
    }).join("")}</ol></div><div class="cw-pop" hidden></div>`;
  }
  // 点开某一段：显示说明和卡片
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".cw-seg"); if (!btn) return;
    e.stopPropagation();
    const box = btn.closest(".cb-where"), pop = box.nextElementSibling, g = G.find((x) => x.id === box.dataset.id); if (!g) return;
    const i = +btn.dataset.seg, open = btn.getAttribute("aria-expanded") === "true";
    box.querySelectorAll(".cw-seg").forEach((b) => { b.setAttribute("aria-expanded", "false"); b.parentNode.classList.remove("sel"); });
    if (open) { pop.hidden = true; return; }
    btn.setAttribute("aria-expanded", "true"); btn.parentNode.classList.add("sel");
    const { d, cards } = segInfo(g, i);
    pop.innerHTML = `<b class="cp-t">${esc(g.where.path[i])}</b>${d ? `<p>${hl(d)}</p>` : ""}${cards.length ? `<div class="cp-cards">${cards.map((x) => x.id === g.id
      ? `<span class="cp-card cur">${tile(x, "sm")}${esc(x.term)}<small>当前</small></span>`
      : `<button type="button" class="cp-card" data-open="${x.id}">${tile(x, "sm")}${esc(x.term)}</button>`).join("")}</div>` : `<p class="cp-none">这一段暂时没有单独的术语卡片。</p>`}`;
    pop.hidden = false;
    pop.querySelectorAll("[data-open]").forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); openTerm(b.dataset.open); }));
  }, true);

  // 出处：解析「第 1 章 1.3；第 12 章 Q2、Q3」，每个小节 / 问题链接到飞书原文对应标题
  function srcHtml(src) {
    const S = window.SOURCES || {};
    return String(src || "").split(/[；;]/).map((part) => {
      const m = part.match(/第\s*(\d+)\s*章(.*)/); if (!m) return esc(part.trim());
      const ch = S[m[1]], toks = m[2].match(/\d+\.\d+|Q\d+/g) || [];
      if (!ch) return esc(part.trim());
      const link = (href, label, title) => `<a class="src-a" href="${href}" target="_blank" rel="noopener" title="${esc(title)}">${esc(label)}</a>`;
      if (!toks.length) return link(ch.url, `第 ${m[1]} 章`, `打开第 ${m[1]} 章原文`);
      return `<span class="src-ch">第 ${m[1]} 章</span>` + toks.map((t) => link(ch.url + (ch.a[t] ? "#" + ch.a[t] : ""), t, `打开第 ${m[1]} 章 ${t} 原文`)).join("");
    }).join('<span class="src-sep">；</span>');
  }

  function backHtml(g) {
    const rel = related(g);
    const more = [
      (g.points || []).length ? `<div class="cm-sec"><span class="cb-tag t-pt">${ic("list")}要点</span><ol class="cb-points">${g.points.map((p) => `<li>${pointHtml(p)}</li>`).join("")}</ol></div>` : "",
      g.example ? `<div class="cm-sec"><span class="cb-tag t-ex">${ic("chat")}举个例子</span><p>${hl(g.example)}</p></div>` : "",
      g.analogy ? `<div class="cm-sec"><span class="cb-tag t-ana">${ic("bulb")}类比</span><p>${esc(g.analogy)}</p></div>` : "",
      g.confuse ? `<div class="cm-sec"><span class="cb-tag t-conf">${ic("alert")}易混</span><p>${esc(g.confuse)}</p></div>` : "",
    ].join("");
    return `
      <p class="cb-plain">${esc(g.plain)}</p>
      ${(g.words || []).length ? `<dl class="cb-words">${g.words.map((w) => `<div><dt>${esc(w.w)}</dt><dd>${hl(w.e)}</dd></div>`).join("")}</dl>` : ""}
      ${whereHtml(g)}
      ${visualHtml(g.visual, g)}
      ${(g.keys || []).length ? `<div class="cb-keys"><span class="ck-h">${ic("target")}关键参数</span><div class="ck-list">${g.keys.map((k) => `<div class="ck"><b>${esc(k.v)}</b><span>${esc(k.k)}</span></div>`).join("")}</div></div>` : ""}
      ${g.trap ? `<p class="cb-trap">${ic("alert")}<span class="ct-h">易错</span><span>${hl(g.trap)}</span></p>` : ""}
      ${g.mnemonic ? `<p class="cb-mn"><span>口诀</span>${esc(g.mnemonic)}</p>` : ""}
      <details class="cb-more"${moreOpen ? " open" : ""}><summary>详细说明<em>要点 · 例子 · 类比 · 易混</em></summary><div class="cm-body">${more}</div></details>
      <p class="cb-foot"><span class="cb-src">${ic("book")}出处：${srcHtml(g.src)}</span>${rel.length ? `<button type="button" class="link cb-rel" data-id="${g.id}">练相关题（${rel.length}）→</button>` : ""}</p>`;
  }
  document.addEventListener("toggle", (e) => { if (e.target.classList && e.target.classList.contains("cb-more")) moreOpen = e.target.open; }, true);

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
    // 正面：点哪里都翻面；背面：只有点标题行才翻回去，点「展开详细说明」、图解、文字都不翻面
    $("#flash").onclick = (e) => {
      if (e.target.closest(".cb-rel, .cb-more, .cb-where, .cw-pop, a, button")) return;
      if (flipped && !e.target.closest(".cb-head")) return;
      if (String(window.getSelection && window.getSelection()) !== "") return; // 正在选中文字时不翻面
      flipped = !flipped; renderCard();
    };
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

  // ---- 搜索：在全部 139 个术语里找，点开直接看背面 ----
  const norm = (t) => String(t || "").toLowerCase().replace(/[\s·・\-_/／（）()「」【】:：,，.。]/g, "");
  function searchTerms(q) {
    const nq = norm(q); if (!nq) return [];
    const res = [];
    for (const g of G) {
      const fields = [
        [g.term, 100], ...(g.aliases || []).map((a) => [a, 80]), ...(g.words || []).map((w) => [w.w, 60]),
        ...(g.keys || []).map((k) => [k.v + " " + k.k, 35]), [g.plain, 30], ...(g.words || []).map((w) => [w.e, 20]),
        [(g.points || []).join(" "), 10], [g.example, 6],
      ];
      let best = 0, hit = "";
      for (const [txt, w] of fields) {
        const n = norm(txt); if (!n) continue;
        const i = n.indexOf(nq); if (i < 0) continue;
        const sc = w + (i === 0 ? 15 : 0) + (n === nq ? 30 : 0);
        if (sc > best) { best = sc; hit = String(txt); }
      }
      if (best) res.push({ g, sc: best, hit });
    }
    return res.sort((a, b) => b.sc - a.sc || priority(b.g) - priority(a.g)).slice(0, 8);
  }
  // 摘要里把命中的关键词标出来
  function snippet(txt, q) {
    const t = String(txt), lo = t.toLowerCase(), i = lo.indexOf(String(q).trim().toLowerCase());
    if (i < 0) return esc(t.length > 40 ? t.slice(0, 40) + "…" : t);
    const a = Math.max(0, i - 14), b = Math.min(t.length, i + q.trim().length + 24);
    return (a ? "…" : "") + esc(t.slice(a, i)) + `<mark>${esc(t.slice(i, i + q.trim().length))}</mark>` + esc(t.slice(i + q.trim().length, b)) + (b < t.length ? "…" : "");
  }
  function openTerm(id) {
    const g = G.find((x) => x.id === id); if (!g) return;
    P.view = "card"; store(PREF_KEY, P);
    const i = queue.indexOf(g);
    if (i >= 0) pos = i; else { if (pos > queue.length) pos = queue.length; queue.splice(pos, 0, g); }
    flipped = true; render();
    const f = $("#flash"); if (f) f.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  (function initSearch() {
    const q = $("#cvQ"), list = $("#cvRes"); if (!q) return;
    let cur = -1, items = [];
    const close = () => { list.hidden = true; q.setAttribute("aria-expanded", "false"); cur = -1; };
    const paint = () => list.querySelectorAll("li[data-id]").forEach((li, i) => li.classList.toggle("on", i === cur));
    const draw = () => {
      const v = q.value.trim();
      if (!v) { close(); return; }
      items = searchTerms(v); cur = items.length ? 0 : -1;
      list.innerHTML = items.length ? items.map(({ g, hit }) => `<li data-id="${g.id}" role="option">${tile(g, "sm")}<div><b>${snippet(g.term, v)}</b><span class="cr-mod">${esc(MODULES[g.m][0])}</span><p>${hit === g.term || hit.length <= 14 ? esc(g.plain) : snippet(hit, v)}</p></div></li>`).join("")
        : `<li class="cr-empty">没有找到「${esc(v)}」相关的术语，换个关键词试试</li>`;
      list.hidden = false; q.setAttribute("aria-expanded", "true"); paint();
      list.querySelectorAll("li[data-id]").forEach((li) => (li.onmousedown = (e) => { e.preventDefault(); pick(li.dataset.id); }));
    };
    const pick = (id) => { close(); q.blur(); openTerm(id); };
    q.addEventListener("input", draw);
    q.addEventListener("focus", () => { if (q.value.trim()) draw(); });
    q.addEventListener("blur", () => setTimeout(close, 120));
    q.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" && items.length) { e.preventDefault(); cur = (cur + 1) % items.length; paint(); }
      else if (e.key === "ArrowUp" && items.length) { e.preventDefault(); cur = (cur - 1 + items.length) % items.length; paint(); }
      else if (e.key === "Enter" && cur >= 0 && items[cur]) { e.preventDefault(); pick(items[cur].g.id); }
      else if (e.key === "Escape") { e.preventDefault(); if (q.value) { q.value = ""; close(); } else q.blur(); }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !$("#cardView").hidden && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); q.select(); }
    });
  })();

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
    if ($("#cardView").hidden || P.view !== "card" || !queue.length || /INPUT|TEXTAREA|SUMMARY|BUTTON/.test(document.activeElement.tagName)) return;
    if (e.key === " ") { e.preventDefault(); flipped = !flipped; renderCard(); }
    else if (flipped && e.key === "ArrowLeft") answer(false);
    else if (flipped && e.key === "ArrowRight") answer(true);
  });
  updateEntry();
})();
