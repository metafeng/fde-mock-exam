// ===== 分章节专项练习 =====
// 选一个或多个知识模块 → 选题量 / 顺序 / 方式 → 刷题；也可以先看「知识点速览」。
// 依赖 app.js 里的全局：BANK、MODULES、S、qid、shuffle、newExam、enterExam、show、renderHome、$

const QSTAT_KEY = "fde-mock-qstat"; // 每道题的作答记录：{ qid: { n: 次数, r: 答对次数, last: 最近一次是否答对 } }
const TOPIC_KEY = "fde-mock-topic"; // 记住上次的选择

// 课程小节标题（来自认证页课程目录），用于知识点速览分组
const SECTIONS = {
  "1.1": "FDE 的本质定义", "1.2": "真假 FDE 的试金石", "1.3": "Echo 与 Delta：两种能力侧", "1.4": "三个陷阱", "1.5": "组织归属：FDE 团队该放哪个部门",
  "2.1": "WorkBuddy：知识工作者的 AI 协作平台", "2.2": "CodeBuddy：开发者的 AI 编程助手", "2.3": "ADP：企业 AI 应用开发平台", "2.4": "Miora：AI 创意智能体工作室", "2.5": "Ardot：AI 设计智能体协作平台", "2.6": "客户落地的四层门槛", "2.7": "三层赋能体系：平台层 · 工具层 · 生态层",
  "3.1": "Prompt 工程", "3.2": "上下文管理", "3.3": "Harness 构建", "3.4": "Loop 循环", "3.5": "MCP 认证",
  "4.1": "界面结构与第一个任务", "4.2": "技能（Skill）", "4.3": "造一个专属专家", "4.4": "连接器与 MCP", "4.5": "自动化任务与企业侧治理", "4.6": "实操演练：4 小时跑通完整闭环",
  "5.1": "三个端与产品家族", "5.2": "部署形态选择", "5.3": "成员管理", "5.4": "能力下发策略", "5.5": "企业级连接器", "5.6": "WMA 与积分口径", "5.7": "度量与审计",
  "6.1": "进场访谈：先挖三层", "6.2": "隐性流程", "6.3": "Demo 沟通语言", "6.4": "一线抵触", "6.5": "场景优先级", "6.6": "场景案例：教育行业陪跑",
  "7.1": "PEV 交付闭环", "7.2": "验收标准", "7.3": "L0–L4 成熟度框架", "7.4": "范围控制四纪律", "7.5": "Land and Expand",
  "8.1": "双向蒸馏", "8.2": "Skill 沉淀的正确姿势", "8.3": "三态溯源与四条红线", "8.4": "成本曲线", "8.5": "冷启动四条铁律与定价陷阱", "8.6": "信任四问", "8.7": "沉淀载体",
  "9.1": "总原则：放大器不是替代者", "9.2": "12 周四阶段工作流", "9.3": "四道 Gate 与教练闭环", "9.4": "工具边界清单", "9.5": "收尾行动清单",
  "10.1": "约束三层模型", "10.2": "数据边界", "10.3": "权限模型", "10.4": "日志审计", "10.5": "评测门槛", "10.6": "三类护栏", "10.7": "人工兜底", "10.8": "上线自检清单",
};

function loadQstat() { try { return JSON.parse(localStorage.getItem(QSTAT_KEY) || "{}"); } catch (e) { return {}; } }
function saveQstat(s) { try { localStorage.setItem(QSTAT_KEY, JSON.stringify(s)); } catch (e) {} }
function recordStat(i, ok) {
  const s = loadQstat(), id = qid(i), o = s[id] || { n: 0, r: 0 };
  o.n++; if (ok) o.r++; o.last = ok ? 1 : 0; s[id] = o; saveQstat(s);
}

function loadPrefs() {
  let p = {}; try { p = JSON.parse(localStorage.getItem(TOPIC_KEY) || "{}"); } catch (e) {}
  return { mods: p.mods || [], count: p.count || 10, order: p.order || "fresh", mode: p.mode || "practice" };
}
let TP = loadPrefs();
function savePrefs() { try { localStorage.setItem(TOPIC_KEY, JSON.stringify(TP)); } catch (e) {} }

const modPool = (m) => BANK.map((q, i) => i).filter((i) => BANK[i].m === m);
function modStats(m) {
  const st = loadQstat(), pool = modPool(m);
  let done = 0, ok = 0;
  pool.forEach((i) => { const o = st[qid(i)]; if (o) { done++; if (o.last) ok++; } });
  return { total: pool.length, done, ok, acc: done ? Math.round((ok / done) * 100) : null };
}

// 按顺序策略抽题
function pickTopic(cfg) {
  const st = loadQstat();
  const pool = [].concat(...cfg.mods.map(modPool));
  const fresh = shuffle(pool.filter((i) => !st[qid(i)]));
  const wrong = shuffle(pool.filter((i) => st[qid(i)] && !st[qid(i)].last));
  const right = shuffle(pool.filter((i) => st[qid(i)] && st[qid(i)].last));
  const ordered = cfg.order === "wrong" ? wrong.concat(fresh, right)
    : cfg.order === "random" ? shuffle(pool)
    : fresh.concat(wrong, right);
  return cfg.count === "all" ? ordered : ordered.slice(0, cfg.count);
}

function topicName(mods) {
  if (!mods || !mods.length) return "专项练习";
  return "专项练习：" + (mods.length <= 2 ? mods.map((m) => MODULES[m][0]).join("、") : `${MODULES[mods[0]][0]} 等 ${mods.length} 个模块`);
}

function startTopic(cfg) {
  const ids = pickTopic(cfg);
  if (!ids.length) return;
  $("#resumeBtn").hidden = true;
  newExam(ids, cfg.mode, "topic");
  S.topicCfg = { ...cfg };
  save();
  enterExam();
}

// ---- 首页卡片 ----
const OPTS = {
  count: [[10, "10 题"], [20, "20 题"], ["all", "全部"]],
  order: [["fresh", "没做过优先"], ["wrong", "错题优先"], ["random", "随机"]],
  mode: [["practice", "练习"], ["exam", "考试"]],
};
const OPT_LABEL = { count: "题量", order: "顺序", mode: "方式" };

function renderTopic() {
  const grid = $("#topicGrid");
  if (!grid) return;
  grid.innerHTML = MODULES.map((md, m) => {
    const st = modStats(m), on = TP.mods.includes(m);
    const pct = Math.round((st.done / st.total) * 100);
    const acc = st.acc == null ? `<span class="acc none">未练习</span>` : `<span class="acc ${st.acc >= 80 ? "good" : st.acc >= 60 ? "mid" : "low"}">正确率 ${st.acc}%</span>`;
    return `<button type="button" class="mod-row ${on ? "on" : ""}" data-m="${m}" aria-pressed="${on}">
      <span class="mr-no">${String(m + 1).padStart(2, "0")}</span>
      <span class="mr-main"><b>${md[0]}</b><em>已做 ${st.done}/${st.total} · ${acc}</em><span class="mr-bar"><i style="width:${pct}%"></i></span></span>
      <span class="mr-tick" aria-hidden="true"></span>
    </button>`;
  }).join("");
  grid.querySelectorAll(".mod-row").forEach((b) => (b.onclick = () => {
    const m = +b.dataset.m;
    TP.mods = TP.mods.includes(m) ? TP.mods.filter((x) => x !== m) : TP.mods.concat(m).sort((a, b) => a - b);
    savePrefs(); renderTopic();
  }));

  $("#topicOpts").innerHTML = Object.keys(OPTS).map((k) => `<div class="opt-row"><span>${OPT_LABEL[k]}</span><div class="ios-seg">${
    OPTS[k].map(([v, t]) => `<button type="button" data-k="${k}" data-v="${v}" class="${String(TP[k]) === String(v) ? "on" : ""}">${t}</button>`).join("")
  }</div></div>`).join("");
  $("#topicOpts").querySelectorAll("button").forEach((b) => (b.onclick = () => {
    const v = b.dataset.v; TP[b.dataset.k] = b.dataset.k === "count" && v !== "all" ? +v : v;
    savePrefs(); renderTopic();
  }));

  const n = TP.mods.length, pool = TP.mods.reduce((a, m) => a + modPool(m).length, 0);
  const qn = TP.count === "all" ? pool : Math.min(TP.count, pool);
  $("#topicSel").innerHTML = n ? `已选 <b>${n}</b> 个模块，题库共 <b>${pool}</b> 题` : "请先选择至少一个模块";
  $("#topicStart").textContent = n ? `开始专项${TP.mode === "exam" ? "考试" : "练习"} · ${qn} 题` : "开始专项练习";
  $("#topicStart").disabled = !n;
  $("#topicReview").hidden = !n;
  $("#topicAll").textContent = n === MODULES.length ? "清空" : "全选";
}

// ---- 知识点速览 ----
function secKey(src) { const m = String(src).match(/(\d+)\.(\d+)/); return m ? `${m[1]}.${m[2]}` : null; }
function renderOverview(mods) {
  show("resultView");
  const esc = (t) => String(t).replace(/\s*(?=[②③④⑤⑥⑦⑧⑨])/g, "\n");
  const blocks = mods.map((m) => {
    const groups = new Map();
    modPool(m).forEach((i) => {
      const q = BANK[i], key = secKey(q.src) || "其他";
      if (!groups.has(key)) groups.set(key, { ks: new Map() });
      const g = groups.get(key);
      if (!g.ks.has(q.k)) g.ks.set(q.k, q.c || "");
    });
    const keys = [...groups.keys()].sort((a, b) => {
      const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
      return (pa[0] || 99) - (pb[0] || 99) || (pa[1] || 0) - (pb[1] || 0);
    });
    let total = 0;
    const secs = keys.map((key) => {
      const g = groups.get(key); total += g.ks.size;
      const title = SECTIONS[key] ? `${key} ${SECTIONS[key]}` : key === "其他" ? "综合与 FAQ" : key;
      const seen = new Set();
      const items = [...g.ks.entries()].map(([k, c]) => {
        const showC = c && !seen.has(c); if (c) seen.add(c);
        return `<li><p class="kp">${k}</p>${showC ? `<details class="more"><summary>展开讲解</summary><p class="concept">${esc(c)}</p></details>` : ""}</li>`;
      }).join("");
      return `<section class="ov-sec"><h4>${title}</h4><ul>${items}</ul></section>`;
    }).join("");
    return `<article class="card ov-mod"><h2>${MODULES[m][0]} <small>${total} 个考点 · ${MODULES[m][1]}%</small></h2>${secs}</article>`;
  }).join("");
  $("#resultView").innerHTML = `
    <div class="score-head" style="grid-template-columns:1fr">
      <div><span class="mode-tag">知识点速览</span>
        <h2 style="margin:8px 0 4px">${mods.map((m) => MODULES[m][0]).join("、")}</h2>
        <div class="score-detail">按课程小节汇总本模块题库涉及的全部考点，点「展开讲解」看完整说明。</div></div>
    </div>
    <div class="result-actions"><button class="btn primary" id="ovStart">开始练习这些模块</button></div>
    <div class="ov-list">${blocks}</div>`;
  $("#ovStart").onclick = () => startTopic({ ...TP, mods });
  window.scrollTo(0, 0);
}

// ---- 事件 ----
$("#topicEntry").onclick = () => { renderTopic(); homeStep(3); };
$("#topicStart").onclick = () => { if (TP.mods.length) startTopic({ ...TP }); };
$("#topicReview").onclick = () => { if (TP.mods.length) renderOverview(TP.mods.slice()); };
$("#topicAll").onclick = () => { TP.mods = TP.mods.length === MODULES.length ? [] : MODULES.map((_, m) => m); savePrefs(); renderTopic(); };
renderTopic();
