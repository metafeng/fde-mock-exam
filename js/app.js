const KEY = "fde-mock-v2";
const MODE_KEY = "fde-mock-mode";
const $ = (s) => document.querySelector(s);
const letters = "ABCDEFGH";
let S = null, tick = null;

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function load() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
function getMode() { const el = document.querySelector('input[name="mode"]:checked'); return el ? el.value : "exam"; }
const practice = () => S && S.mode === "practice";

function setName(id) { return id === "cards" ? "术语相关题" : id === "wrong" ? "错题集" : id === "topic" ? (typeof topicName === "function" ? topicName(S && S.topicCfg && S.topicCfg.mods) : "专项练习") : "模拟卷"; }
function setIds(id) {
  if (id === "wrong") { const w = loadWrong(); return BANK.map((q, i) => i).filter((i) => w[qid(i)]); }
  return BANK.map((q, i) => (String(q.set) === String(id) ? i : -1)).filter((i) => i >= 0);
}

// ===== 错题集 =====
// 用「试卷 + 题干」生成稳定 ID，题库重新生成后错题记录依然有效
const WRONG_KEY = "fde-mock-wrong";
function qid(i) { const q = BANK[i]; let h = 0; const s = q.set + "|" + q.q; for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0; return q.set + "-" + (h >>> 0).toString(36); }
function loadWrong() { try { return JSON.parse(localStorage.getItem(WRONG_KEY) || "{}"); } catch (e) { return {}; } }
function saveWrong(w) { try { localStorage.setItem(WRONG_KEY, JSON.stringify(w)); } catch (e) {} }
function wrongCount() { const w = loadWrong(); return BANK.filter((q, i) => w[qid(i)]).length; }
// 记录一道已判分的题：答错收进错题集（累计次数）；在错题集里答对则移出
function recordResult(n) {
  if (S.browse || !S.ans[n].length) return;
  if (typeof recordStat === "function") recordStat(S.ids[n], isRight(n));
  const w = loadWrong(), id = qid(S.ids[n]);
  if (!isRight(n)) { w[id] = { n: (w[id] ? w[id].n : 0) + 1, t: Date.now() }; }
  else if (S.setId === "wrong" && w[id]) { delete w[id]; S.mastered = (S.mastered || 0) + 1; }
  saveWrong(w);
}
function removeWrong(i) { const w = loadWrong(); delete w[qid(i)]; saveWrong(w); }
// 随机组卷：按考试配比（每个模块 × 题型的题数）从全部题库抽题，优先抽没出现过的
const SEEN_KEY = "fde-mock-seen";
const QUOTA = [[5, 2], [3, 2], [4, 2], [4, 2], [4, 2], [4, 2], [4, 2], [4, 2], [4, 2], [4, 2]];
function randomIds() {
  let seen = {}; try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch (e) {}
  const out = [];
  MODULES.forEach((_, m) => ["s", "m"].forEach((t, ti) => {
    const need = QUOTA[m][ti];
    const pool = shuffle(BANK.map((q, i) => i).filter((i) => BANK[i].m === m && BANK[i].t === t));
    let fresh = pool.filter((i) => !seen[qid(i)]);
    if (fresh.length < need) { pool.forEach((i) => delete seen[qid(i)]); fresh = pool; } // 这一类都出过了，重新轮一遍
    fresh.slice(0, need).forEach((i) => { out.push(i); seen[qid(i)] = 1; });
  }));
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) {}
  return out;
}
const HIST_KEY = "fde-mock-hist";
function pushHist(pct) { let h = []; try { h = JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (e) {} h.unshift(pct); try { localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 5))); } catch (e) {} }
const HINTS = { exam: "限时作答，交卷后统一出分和解析", practice: "每答一题立即判对错，并给出考点和解析" };
function renderDist() {
  $("#distTable").innerHTML = "<thead><tr><th>知识模块</th><th>比例</th><th>题数</th></tr></thead><tbody>" +
    MODULES.map((md, m) => `<tr><td>${md[0]}</td><td>${md[1]}%</td><td>${QUOTA[m][0] + QUOTA[m][1]}</td></tr>`).join("") +
    "</tbody><tfoot><tr><td>合计</td><td>100%</td><td>60</td></tr></tfoot>";
}
function homeStep(n) { [1, 2, 3].forEach((k) => ($("#homeStep" + k).hidden = n !== k)); document.querySelector(".banner-body").classList.toggle("wide", n === 3); }
function renderHome() {
  if (typeof renderTopic === "function") renderTopic();
  $("#modeHint").textContent = HINTS[getMode()];
  $("#startBtn").textContent = getMode() === "practice" ? "开始练习" : "开始考试";
  const wc = wrongCount();
  $("#wrongBtn").hidden = !wc;
  $("#wrongBtn").textContent = `错题集（${wc}）`;
  let h = []; try { h = JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (e) {}
  $("#recent").hidden = !h.length;
  $("#recent").innerHTML = "最近成绩：" + h.map((p) => `<b class="${p >= 70 ? "p" : "f"}">${p}</b>`).join("、");
}
function newExam(ids, mode, setId) {
  setId = setId || "random";
  ids = ids || (setId === "random" ? randomIds() : setIds(setId));
  const ord = (i) => BANK[i].m * 1000 + i;
  const singles = ids.filter((i) => BANK[i].t === "s").sort((x, y) => ord(x) - ord(y));
  const multis = ids.filter((i) => BANK[i].t === "m").sort((x, y) => ord(x) - ord(y));
  const order = singles.concat(multis);
  const isFull = ids.length >= 60;
  S = {
    setId,
    mode: mode || "exam",
    ids: order,
    perm: order.map((i) => shuffle(BANK[i].o.map((_, k) => k))),
    ans: order.map(() => []),
    locked: order.map(() => false),
    flag: order.map(() => false),
    cur: 0,
    start: Date.now(),
    end: Date.now() + (isFull ? 120 : Math.max(10, Math.round(order.length * 2))) * 60000,
    retry: false,
    wrongSnap: loadWrong(),
    qstatSnap: typeof loadQstat === "function" ? loadQstat() : null,
    done: false,
    full: isFull,
  };
  save();
}


function show(view) {
  ["startView", "cardView", "examView", "resultView"].forEach((v) => ($("#" + v).hidden = v !== view));
  if (view === "startView") homeStep(1);
  const exam = view === "examView";
  $("#timer").hidden = !exam; $("#submitBtn").hidden = !exam; $("#quickBtn").hidden = !exam; $("#exitBtn").hidden = view === "startView"; $("#exitBtn").textContent = exam ? "退出答题" : "返回首页"; document.body.classList.toggle("in-exam", exam); $("#progress").hidden = !exam;
  document.querySelectorAll(".lg-practice").forEach((el) => (el.hidden = !(exam && practice())));
  window.scrollTo(0, 0);
}

function fmt(ms) { const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000); return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; }

function startTimer() {
  clearInterval(tick);
  const t = $("#timer");
  const f = () => {
    if (practice()) { t.textContent = "用时 " + fmt(Date.now() - S.start); t.classList.remove("low"); return; }
    const left = Math.max(0, S.end - Date.now());
    t.textContent = fmt(left);
    t.classList.toggle("low", left < 10 * 60000);
    if (left <= 0) { clearInterval(tick); finish(); }
  };
  f(); tick = setInterval(f, 1000);
}

function isRight(n) { const q = BANK[S.ids[n]], a = S.ans[n]; return a.length === q.a.length && q.a.every((x) => a.includes(x)); }

function renderGrid() {
  const cell = (n) => {
    const c = ["cell"];
    if (practice() && S.locked[n]) c.push(isRight(n) ? "right" : "wrong");
    else if (S.ans[n].length) c.push("done");
    if (S.flag[n]) c.push("flag");
    if (n === S.cur) c.push("cur");
    return `<button class="${c.join(" ")}" data-n="${n}" aria-label="第${n + 1}题">${n + 1}</button>`;
  };
  const group = (type, label, score) => {
    const ns = S.ids.map((qi, n) => n).filter((n) => BANK[S.ids[n]].t === type);
    if (!ns.length) return "";
    const done = ns.filter((n) => S.ans[n].length).length;
    return `<div class="grid-group ${type === "m" ? "multi" : ""}">
      <p class="grid-title"><b>${label} ${ns[0] + 1}–${ns[ns.length - 1] + 1} · ${score} 分/题</b><span class="num">${done}/${ns.length}</span></p>
      <div class="grid">${ns.map(cell).join("")}</div></div>`;
  };
  $("#grid").innerHTML = group("s", "单选题", 1.5) + group("m", "多选题", 2);
  $("#sheetCount").textContent = `已答 ${S.ans.filter((a) => a.length).length}/${S.ids.length}`;
  const answered = S.ans.filter((a) => a.length).length;
  if (practice()) {
    const checked = S.locked.filter(Boolean).length;
    const right = S.ids.filter((_, n) => S.locked[n] && isRight(n)).length;
    $("#progress").innerHTML = `已判 <span class="num">${checked}/${S.ids.length}</span> · 答对 <span class="num">${right}</span>`;
  } else {
    $("#progress").innerHTML = `已答 <span class="num">${answered}/${S.ids.length}</span>`;
  }
}

// 反馈：判定 + 错在哪 + 本题考点 + 解析 + 出处
function feedbackHtml(n, cls) {
  const q = BANK[S.ids[n]], perm = S.perm[n], a = S.ans[n], r = isRight(n);
  const L = (o) => letters[perm.indexOf(o)];
  const rightL = q.a.map(L).sort().join("");
  const mineL = a.map(L).sort().join("") || "未作答";
  // 逐项解析：按页面显示顺序（打乱后的字母）逐个讲解，标出正确项和你的选择
  const perOpt = q.x ? `<div class="xlist">${perm.map((o, k) => {
      const ok = q.a.includes(o), picked = a.includes(o);
      const txt = String(q.x[o]).replace(/^(正确|错误)[：:]\s*/, "");
      // 四种状态：答对（选了正确项）/ 错选（选了错误项）/ 漏选（正确项没选）/ 其他错误项
      const st = S.browse ? (ok ? "s-right" : "s-other") : ok ? (picked ? "s-hit" : "s-miss") : (picked ? "s-bad" : "s-other");
      // 选项原文上方已经显示，这里只用「字母 + ✓/✕」徽标对应，解析文字是主角
      const plain = String(q.o[o]).replace(/<[^>]+>/g, "").replace(/"/g, "&quot;");
      return `<div class="xi ${st}"><span class="xbadge ${ok ? "ok" : "no"}" title="${letters[k]}. ${plain}">${letters[k]}<i>${ok ? "✓" : "✕"}</i></span><p class="xe">${txt}</p></div>`;
    }).join("")}</div>` : `<p><b>解析：</b>${q.e}</p>`;
  const head = S.browse
    ? `正确答案 ${rightL}`
    : `${r ? "回答正确" : (a.length ? "回答错误" : "未作答")} · 正确答案 ${rightL} · 你的答案 ${mineL}`;
  // 有相关术语卡片时，知识点讲解由卡片承担，不再单独列出；出处可点击跳到飞书原文
  const cardsHtml = window.cardPeekHtml ? window.cardPeekHtml(S.ids[n]) : "";
  const srcLinks = window.srcLinksHtml ? window.srcLinksHtml(q.src) : "";
  const detail = `<p class="sec">逐项解析</p>
    ${perOpt}
    <p class="sec">本题考点</p>
    <p>${q.k}</p>
    ${cardsHtml}
    ${q.c && !cardsHtml ? `<p class="sec">知识点讲解</p><p class="concept">${String(q.c).replace(/\s*(?=[②③④⑤⑥⑦⑧⑨])/g, "\n")}</p>` : ""}
    ${srcLinks ? `<div class="cb-meta fb-src"><span class="fb-src-h">出处</span>${srcLinks}</div>` : `<p class="src">出处：${q.src}</p>`}`;
  // 练习中答对：解析默认收起，不打断做题节奏；答错或交卷后的回顾：完整展开
  const fold = !S.browse && !S.done && r;
  return `<div class="${cls} ${S.browse || r ? "r" : "w"}">
    <div class="verdict">${S.browse ? "" : `<span class="vd-ic">${r ? "✓" : "✕"}</span>`}${head}</div>
    ${!S.browse && !r && q.t === "m" && a.length ? `<p class="src">多选题错选、漏选都不得分。</p>` : ""}
    ${fold ? `<details class="more"><summary>查看解析与知识点</summary>${detail}</details>` : detail}
  </div>`;
}

function optsHtml(n, interactive) {
  const q = BANK[S.ids[n]], multi = q.t === "m", showAns = !interactive;
  return S.perm[n].map((orig, k) => {
    const sel = S.ans[n].includes(orig), correct = q.a.includes(orig);
    if (showAns) {
      const c = correct ? "is-right" : sel ? "is-wrong" : "";
      return `<li><div class="opt locked ${multi ? "multi" : ""} ${c}"><span class="key">${letters[k]}</span><span>${q.o[orig]}</span></div></li>`;
    }
    return `<li><label class="opt ${multi ? "multi" : ""} ${sel ? "sel" : ""}"><input type="${multi ? "checkbox" : "radio"}" name="q${n}" id="q${n}o${k}" data-o="${orig}" ${sel ? "checked" : ""}><span class="key">${letters[k]}</span><span>${q.o[orig]}</span></label></li>`;
  }).join("");
}

function renderQ() {
  const n = S.cur, q = BANK[S.ids[n]], multi = q.t === "m";
  const locked = practice() && S.locked[n];
  const last = n === S.ids.length - 1;
  const needConfirm = practice() && multi && !locked;
  $("#qcard").innerHTML = `
    <div class="qmeta"><span class="qno">${n + 1}</span><span class="qtype">${multi ? "多选" : "单选"}</span><span class="qscore">${multi ? "2 分" : "1.5 分"}</span><span class="qmod">${MODULES[q.m][0]}</span><span class="qcount">${n + 1}/${S.ids.length}</span></div>
    <p class="qtext">${q.q}</p>
    <ul class="opts">${optsHtml(n, !locked)}</ul>
    <div class="qnav">
      <button class="btn" id="prevBtn" ${n === 0 ? "disabled" : ""}>上一题</button>
      ${needConfirm ? `<button class="btn primary" id="checkBtn" ${S.ans[n].length ? "" : "disabled"}>确认本题</button>` : ""}
      <button class="btn ${needConfirm ? "" : "primary"}" id="nextBtn">${last ? (practice() ? "完成并查看成绩" : "检查并交卷") : "下一题"}</button>
      <button class="btn flagbtn ${S.flag[n] ? "on" : ""}" id="flagBtn">${S.flag[n] ? "已标记" : "标记本题"}</button>
    </div>
    ${locked ? feedbackHtml(n, "feedback") : ""}`;
  $("#qcard").querySelectorAll("input").forEach((inp) => inp.addEventListener("change", () => {
    const o = +inp.dataset.o;
    if (multi) { const set = new Set(S.ans[n]); inp.checked ? set.add(o) : set.delete(o); S.ans[n] = [...set].sort(); }
    else { S.ans[n] = [o]; if (practice()) { S.locked[n] = true; recordResult(n); } }
    save(); renderQ(); renderGrid();
    if (practice() && S.locked[n]) afterJudge(n);
  }));
  const cb = $("#checkBtn");
  if (cb) cb.onclick = () => { S.locked[n] = true; recordResult(n); save(); renderQ(); renderGrid(); afterJudge(n); };
  $("#prevBtn").onclick = () => go(n - 1);
  $("#nextBtn").onclick = () => (last ? askSubmit() : go(n + 1));
  $("#flagBtn").onclick = () => { S.flag[n] = !S.flag[n]; save(); renderQ(); renderGrid(); };
}

// 判题后：答对 → 回到题目顶部，方便直接点「下一题」；答错 → 滚到解析
function scrollToEl(el) {
  const top = el.getBoundingClientRect().top + window.scrollY - $(".bar").offsetHeight - 8;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}
function afterJudge(n) {
  if (isRight(n)) scrollToEl($("#qcard"));
  else scrollToEl($("#qcard .feedback"));
}

function go(n) {
  if (n < 0 || n >= S.ids.length) return;
  S.cur = n; save(); renderQ(); renderGrid();
  if (innerWidth <= 820) scrollToEl($("#qcard"));
}

function enterExam() {
  $("#submitBtn").textContent = practice() ? "结束练习" : "交卷";
  show("examView"); renderGrid(); renderQ(); startTimer();
}

function askSubmit() {
  const un = S.ans.filter((a) => !a.length).length, fl = S.flag.filter(Boolean).length;
  const noun = practice() ? "结束练习" : "交卷";
  $("#modalTitle").textContent = `确认${noun}？`;
  $("#modalOk").textContent = `确认${noun}`;
  $("#modalText").textContent = (un ? `还有 ${un} 题未作答` : "全部题目已作答") + (fl ? `，${fl} 题已标记` : "") + `。${noun}后不能再修改答案。`;
  $("#modal").hidden = false; $("#modalOk").focus();
}

function finish() {
  clearInterval(tick); $("#modal").hidden = true;
  if (!S.done && !S.browse) S.ids.forEach((_, n) => { if (!S.locked[n]) recordResult(n); });
  S.done = true; save(); renderResult("all");
}

// 答案速览：不作答，直接看整套题的正确答案、考点和解析
function renderBrowse() {
  show("resultView");
  const wb = S.setId === "wrong", w = loadWrong();
  const n1 = S.ids.filter((i) => BANK[i].t === "s").length, n2 = S.ids.length - n1;
  const reviews = S.ids.map((qi, n) => {
    const q = BANK[qi], multi = q.t === "m";
    return `<article class="qcard"><div class="qmeta"><span class="qno">${n + 1}</span><span class="qtype">${multi ? "多选" : "单选"}</span><span class="qmod">${MODULES[q.m][0]}</span><span class="qcount">${n + 1}/${S.ids.length}</span></div>
      <p class="qtext">${q.q}</p><ul class="opts">${optsHtml(n, false)}</ul>${feedbackHtml(n, "feedback")}${wb ? `<div class="wrong-row"><span>累计答错 <b class="num">${(w[qid(qi)] || {}).n || 1}</b> 次</span><button class="btn ghost" data-rm="${qi}">我已掌握，移出错题集</button></div>` : ""}</article>`;
  }).join("");
  const setId = S.setId;
  $("#resultView").innerHTML = `
    <div class="score-head" style="grid-template-columns:1fr">
      <div><span class="mode-tag">答案速览</span>
        <h2 style="margin:8px 0 4px">${setName(setId)}</h2>
        <div class="score-detail">共 <b class="num">${S.ids.length}</b> 题：单选 <b class="num">${n1}</b>，多选 <b class="num">${n2}</b>。绿色为正确选项。${wb ? "可逐题移出已掌握的错题。" : "速览不计入最高分。"}</div></div>
    </div>
    <div class="result-actions">
      <button class="btn primary" id="doThis">${wb ? "练习错题" : "开始做这套题"}</button>
      ${wb ? `<button class="btn ghost danger" id="clearWrong">清空错题集</button>` : ""}
    </div>
    <div class="modal" id="clearConfirm" hidden><div class="modal-box"><h3>清空错题集？</h3><p>将删除全部 ${S.ids.length} 道错题记录，无法恢复。</p><div class="row"><button class="btn" id="clearNo">取消</button><button class="btn primary" id="clearYes">确认清空</button></div></div></div>
    <div class="review-list">${reviews}</div>`;
  $("#doThis").onclick = () => { const ids = setId === "wrong" ? setIds("wrong") : S.ids.slice(); if (!ids.length) return; newExam(ids, getMode(), setId); enterExam(); };
  document.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => {
    removeWrong(+b.dataset.rm);
    const card = b.closest(".qcard"); card.remove();
    if (!setIds("wrong").length) { renderHome(); show("startView"); }
  }));
  const cw = $("#clearWrong");
  if (cw) {
    cw.onclick = () => { $("#clearConfirm").hidden = false; };
    $("#clearNo").onclick = () => { $("#clearConfirm").hidden = true; };
    $("#clearYes").onclick = () => { saveWrong({}); renderHome(); show("startView"); };
  }
}

function renderResult(filter) {
  if (S.browse) return renderBrowse();
  show("resultView");
  let score = 0, sR = 0, mR = 0, sN = 0, mN = 0;
  const mod = MODULES.map(() => ({ r: 0, n: 0 }));
  S.ids.forEach((qi, n) => {
    const q = BANK[qi], r = isRight(n);
    mod[q.m].n++; if (r) mod[q.m].r++;
    if (q.t === "s") { sN++; if (r) { sR++; score += 1.5; } } else { mN++; if (r) { mR++; score += 2; } }
  });
  const total = sN * 1.5 + mN * 2, pct = Math.round((score / total) * 1000) / 10, pass = pct >= 70;
  if (!S.retry && !S.bestSaved && S.setId !== "wrong" && S.setId !== "topic" && S.setId !== "cards") { pushHist(Math.round(pct)); S.bestSaved = true; save(); }
  const wrongIdx = S.ids.map((_, n) => n).filter((n) => !isRight(n));
  // 离及格线还差几道题：先算分值高的错题（多选 2 分），最少再答对几道能到 70%
  const need = total * 0.7;
  let needQ = 0, acc = score;
  if (!pass) for (const w of wrongIdx.map((n) => (BANK[S.ids[n]].t === "m" ? 2 : 1.5)).sort((a, b) => b - a)) { if (acc >= need - 1e-9) break; acc += w; needQ++; }
  const pctTxt = (pct % 1 ? pct.toFixed(1) : String(pct)) + "%";
  const gap = Math.round(Math.abs(pct - 70) * 10) / 10;
  const gapTxt = pass
    ? (gap ? `高出及格线 <b class="num">${gap}%</b>` : `刚好达到及格线`)
    : `差 <b class="num">${gap}%</b> 及格，再答对 <b class="num">${needQ}</b> 道题就能通过`;
  const scoreTxt = `${score % 1 ? score.toFixed(1) : score} / ${total} 分`;
  const modRows = mod.map((x, m) => {
    if (!x.n) return "";
    const p = Math.round((x.r / x.n) * 100), cls = p >= 80 ? "" : p >= 60 ? "mid" : "low";
    return `<div class="modrow"><span>${MODULES[m][0]}</span><span class="meter"><i class="${cls}" style="width:${p}%"></i></span><span class="num">${x.r}/${x.n}</span></div>`;
  }).join("");
  const list = S.ids.map((qi, n) => ({ qi, n })).filter(({ n }) => filter === "all" || (filter === "wrong" && !isRight(n)) || (filter === "flag" && S.flag[n]));
  const reviews = list.map(({ qi, n }) => {
    const q = BANK[qi], multi = q.t === "m";
    return `<article class="qcard"><div class="qmeta"><span class="qno">${n + 1}</span><span class="qtype">${multi ? "多选" : "单选"}</span><span class="qmod">${MODULES[q.m][0]}</span><span class="qcount">${n + 1}/${S.ids.length}</span></div>
      <p class="qtext">${q.q}</p><ul class="opts">${optsHtml(n, false)}</ul>${feedbackHtml(n, "feedback")}</article>`;
  }).join("") || `<p style="color:var(--muted)">${filter === "wrong" ? "没有错题。" : "没有标记的题。"}</p>`;
  const modeLabel = practice() ? "练习模式" : "考试模式";
  const used = fmt(Date.now() - (S.start || Date.now()));
  $("#resultView").innerHTML = `
    <div class="score-head">
      <div class="score-big ${pass ? "pass" : "fail"}">${pctTxt}<small>${scoreTxt}</small></div>
      <div class="score-main"><span class="verdict-pill ${pass ? "pass" : "fail"}">${pass ? "通过" : "未通过"}</span> <span class="mode-tag">${modeLabel}</span>
        <div class="pass-bar ${pass ? "pass" : "fail"}" title="及格线 70%"><i style="width:${Math.min(pct, 100)}%"></i><span class="pb-line"><em>及格 70%</em></span></div>
        <div class="pass-gap ${pass ? "pass" : "fail"}">${gapTxt}</div>
        <div class="score-detail">${setName(S.setId)}${S.retry ? " · 错题重练" : ""}。单选 <b class="num">${sR}/${sN}</b>，多选 <b class="num">${mR}/${mN}</b>，错题 <b class="num">${wrongIdx.length}</b> 道${S.ids.some((_, n) => S.ans[n].length && !isRight(n)) ? "（答错的已收入错题集）" : ""}。${S.mastered ? `本次从错题集移出 <b class="num">${S.mastered}</b> 道。` : ""}${S.start ? `用时 <b class="num">${used}</b>。` : ""}</div></div>
    </div>
    <div class="mods"><h3>模块正确率</h3>${modRows}</div>
    <div class="result-actions">
      <button class="btn primary" id="retryAll">${S.setId === "topic" ? "继续练下一组" : `再来一次（${modeLabel}）`}</button>
      ${wrongIdx.length ? `<button class="btn" id="retryWrong">只练错题（${wrongIdx.length} 道）</button>` : ""}
      <button class="btn" id="openWrong" ${wrongCount() ? "" : "hidden"}>查看错题集（${wrongCount()} 道）</button>
    </div>
    <div class="review-filter">
      <button class="chip ${filter === "all" ? "on" : ""}" data-f="all">全部解析</button>
      <button class="chip ${filter === "wrong" ? "on" : ""}" data-f="wrong">只看错题</button>
      <button class="chip ${filter === "flag" ? "on" : ""}" data-f="flag">只看标记</button>
    </div>
    <div class="review-list">${reviews}</div>`;
  const mode = S.mode, setId = S.setId;
  const tcfg = S.topicCfg;
  $("#retryAll").onclick = () => { if (setId === "topic" && tcfg) return startTopic(tcfg); if (setId === "cards") { newExam(S.ids.slice(), mode, setId); return enterExam(); } newExam(null, mode, setId); enterExam(); };
  const rw = $("#retryWrong");
  if (rw) rw.onclick = () => { newExam(wrongIdx.map((n) => S.ids[n]), mode, setId); S.retry = true; S.topicCfg = tcfg; save(); enterExam(); };
  $("#openWrong").onclick = () => { newExam(null, "exam", "wrong"); S.browse = true; S.done = true; save(); renderBrowse(); };
  document.querySelectorAll(".review-filter .chip").forEach((c) => (c.onclick = () => renderResult(c.dataset.f)));
}

// 事件
$("#grid").addEventListener("click", (e) => { const b = e.target.closest(".cell"); if (b) go(+b.dataset.n); });
$("#submitBtn").onclick = askSubmit;
$("#entryFull").onclick = () => homeStep(2);
$("#stepBack").onclick = () => homeStep(1);
$("#stepBack3").onclick = () => homeStep(1);
$("#homeLink").onclick = (e) => {
  e.preventDefault();
  if (!$("#examView").hidden && S && !S.done) { $("#exitModal").hidden = false; return; }
  $("#modal").hidden = true; renderHome(); show("startView");
};
$("#exitBtn").onclick = () => {
  if (!$("#examView").hidden && S && !S.done) { $("#exitModal").hidden = false; return; }
  renderHome(); show("startView");
};
// 暂停：冻结剩余时间（考试）或已用时间（练习），回首页后可继续
$("#pauseExam").onclick = () => {
  clearInterval(tick);
  if (practice()) S.elapsed = Date.now() - S.start; else S.left = Math.max(0, S.end - Date.now());
  S.paused = true; save();
  $("#exitModal").hidden = true;
  showResume(); renderHome(); show("startView");
};
// 放弃：删除本次进度，并把错题集还原到开考前
$("#discardExam").onclick = () => {
  clearInterval(tick);
  if (S && S.wrongSnap) saveWrong(S.wrongSnap);
  if (S && S.qstatSnap && typeof saveQstat === "function") saveQstat(S.qstatSnap);
  S = null; try { localStorage.removeItem(KEY); } catch (e) {}
  $("#exitModal").hidden = true; $("#resumeBtn").hidden = true;
  renderHome(); show("startView");
};
$("#cancelExit").onclick = () => { $("#exitModal").hidden = true; };
$("#quickBtn").onclick = finish;
$("#browseBtn").onclick = () => { newExam(null, "exam", "random"); S.browse = true; S.done = true; clearInterval(tick); save(); renderBrowse(); };
$("#wrongBtn").onclick = () => { newExam(null, "exam", "wrong"); S.browse = true; S.done = true; save(); renderBrowse(); };
document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", () => { try { localStorage.setItem(MODE_KEY, getMode()); } catch (e) {} renderHome(); }));
$("#modalCancel").onclick = () => { $("#modal").hidden = true; };
$("#modalOk").onclick = finish;
$("#sheetToggle").onclick = () => { const s = $("#sheet"); s.classList.toggle("collapsed"); $("#sheetToggle").textContent = s.classList.contains("collapsed") ? "展开" : "收起"; };
$("#startBtn").onclick = () => {
  const m = getMode();
  try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
  $("#resumeBtn").hidden = true;
  newExam(null, m, "random"); enterExam();
};
$("#resumeBtn").onclick = () => {
  if (!S || S.done) return;
  if (S.paused) {
    if (S.mode === "practice") S.start = Date.now() - (S.elapsed || 0); else S.end = Date.now() + (S.left || 0);
    S.paused = false; save();
  }
  enterExam();
};
document.addEventListener("keydown", (e) => {
  if ($("#examView").hidden || !$("#modal").hidden) return;
  if (e.key === "ArrowRight") go(S.cur + 1);
  if (e.key === "ArrowLeft") go(S.cur - 1);
});

try { const m = localStorage.getItem(MODE_KEY); if (m) { const el = document.querySelector(`input[name="mode"][value="${m}"]`); if (el) el.checked = true; } } catch (e) {}
function showResume() {
  const done = S.ans.filter((a) => a.length).length;
  const left = S.paused && S.mode !== "practice" ? `，剩余 ${fmt(S.left || 0)}` : "";
  $("#resumeBtn").hidden = false;
  $("#resumeBtn").textContent = `继续上次${S.paused ? "暂停" : "未完成"}的${S.mode === "practice" ? "练习" : "考试"}（已答 ${done}/${S.ids.length}${left}）`;
}
const prev = load();
if (prev && prev.ids && prev.ids.every((i) => BANK[i])) {
  S = prev;
  S.mode = S.mode || "exam";
  S.locked = S.locked || S.ids.map(() => false);
  if (!S.done && (S.paused || S.mode === "practice" || S.end > Date.now())) showResume();
  else if (!S.done) { finish(); }
}
renderDist();
renderHome();
if (innerWidth > 820) $("#sheet").classList.remove("collapsed");
