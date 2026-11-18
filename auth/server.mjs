// FDE 模拟考试的登录网关（零依赖）。
// nginx 用 auth_request 调 /verify 判断是否已登录；未登录跳到 /login。
//
// 运行：node server.mjs                       （监听 127.0.0.1:19015）
// 设置账号：node server.mjs --set-user 邮箱 密码（用户也可以在登录页自行注册）
// 删除账号：node server.mjs --del-user 用户名
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = process.env.FDE_USERS || path.join(DIR, "users.json");
const SECRET_FILE = process.env.FDE_SECRET || path.join(DIR, "secret");
const PORT = Number(process.env.PORT) || 19015;
const COOKIE = "fde_session";
const MAX_AGE = 30 * 24 * 3600; // 30 天

const readUsers = () => { try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); } catch { return {}; } };
const hashPw = (pw, salt = crypto.randomBytes(16).toString("hex")) =>
  `scrypt$${salt}$${crypto.scryptSync(pw, salt, 64).toString("hex")}`;
const checkPw = (pw, stored) => {
  const [, salt, hex] = String(stored).split("$");
  if (!salt || !hex) return false;
  const a = Buffer.from(hex, "hex"), b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const writeUsers = (users) => { const tmp = USERS_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(users, null, 2), { mode: 0o600 }); fs.renameSync(tmp, USERS_FILE); };
// 账号统一用小写、去空格（邮箱不区分大小写）
const normUser = (u) => String(u || "").trim().toLowerCase();
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

// ---- 命令行：管理账号 ----
const args = process.argv.slice(2);
if (args[0] === "--set-user" || args[0] === "--del-user") {
  const users = readUsers();
  if (args[0] === "--set-user") {
    if (!args[1] || !args[2]) { console.error("用法：node server.mjs --set-user 用户名 密码"); process.exit(1); }
    users[normUser(args[1])] = hashPw(args[2]);
  } else delete users[normUser(args[1])];
  writeUsers(users);
  console.log(args[0] === "--set-user" ? `已设置账号：${args[1]}` : `已删除账号：${args[1]}`);
  process.exit(0);
}

// ---- 首次启动：还没有任何账号时，自动生成一个随机管理员账号 ----
// 账号密码只写进服务器本地的 initial-admin.txt（仅文件所有者可读）并打印到服务日志，不会出现在代码仓库里。
if (!Object.keys(readUsers()).length) {
  const name = `admin-${crypto.randomBytes(3).toString("hex")}@localhost`;
  const pw = crypto.randomBytes(9).toString("base64url");
  writeUsers({ [name]: hashPw(pw) });
  const note = `首次启动自动生成的账号（登录后可在登录页注册自己的账号，或用 --set-user 修改密码）\n账号：${name}\n密码：${pw}\n`;
  fs.writeFileSync(path.join(DIR, "initial-admin.txt"), note, { mode: 0o600 });
  console.log("\n" + note);
}

if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
const SECRET = fs.readFileSync(SECRET_FILE, "utf8").trim();

// ---- 会话：用户名.过期时间.签名 ----
const sign = (s) => crypto.createHmac("sha256", SECRET).update(s).digest("base64url");
// 签名里带上该账号密码哈希的盐：改密码后盐变了，其他设备上的旧会话自动失效
const pwSalt = (user) => String(readUsers()[user] || "").split("$")[1] || "";
const makeToken = (user) => {
  const body = `${Buffer.from(user).toString("base64url")}.${Math.floor(Date.now() / 1000) + MAX_AGE}`;
  return `${body}.${sign(`${body}.${pwSalt(user)}`)}`;
};
function readToken(cookieHeader = "") {
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [u, exp, sig] = m[1].split(".");
  if (!u || !exp || !sig) return null;
  const user = Buffer.from(u, "base64url").toString();
  const salt = pwSalt(user);
  if (!salt) return null; // 账号不存在或已删除
  const expect = sign(`${u}.${exp}.${salt}`);
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return user;
}

// ---- 失败次数限制：同一 IP 10 分钟内最多错 8 次 ----
const fails = new Map();
const tooMany = (ip) => { const f = fails.get(ip); return f && f.n >= 8 && Date.now() - f.t < 10 * 60e3; };
const addFail = (ip) => { const f = fails.get(ip); fails.set(ip, f && Date.now() - f.t < 10 * 60e3 ? { n: f.n + 1, t: f.t } : { n: 1, t: Date.now() }); };

// ---- 注册频率限制：同一 IP 1 小时内最多注册 5 个账号 ----
const regs = new Map();
const regTooMany = (ip) => { const r = (regs.get(ip) || []).filter((t) => Date.now() - t < 3600e3); regs.set(ip, r); return r.length >= 5; };
const addReg = (ip) => regs.set(ip, (regs.get(ip) || []).concat(Date.now()));

const safeNext = (n) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const LOGO = fs.existsSync(path.join(DIR, "logo.svg")) ? fs.readFileSync(path.join(DIR, "logo.svg"), "utf8") : "";

function page(next, error = "", mode = "login", email = "") {
  const reg = mode === "register";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${reg ? "注册" : "登录"} · FDE 认证模拟考试</title>
<style>
:root{--accent:#0052d9;--ink:#000000e6;--ink2:#00000099;--line:#dcdcdc;--bg:#f3f4f7}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(160deg,#e8f0ff,#f5f8ff 45%,#fff);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif;color:var(--ink);padding:16px}
.box{width:100%;max-width:380px;background:#fff;border-radius:18px;padding:32px 32px 26px;box-shadow:0 0 0 1px rgba(0,0,0,.05),0 12px 40px rgba(0,40,120,.10)}
.logo{display:flex;align-items:center;gap:10px;margin-bottom:20px;color:var(--ink)}.logo svg{height:22px;width:auto}.logo span{padding-left:10px;border-left:1px solid #e7e7e7;font-weight:600;font-size:14px}
h1{font-size:22px;font-weight:600;letter-spacing:-.01em;margin:0 0 4px}p.sub{margin:0 0 18px;color:var(--ink2);font-size:13px}
.tabs{display:grid;grid-template-columns:1fr 1fr;background:#eeeef0;border-radius:10px;padding:3px;margin-bottom:20px}
.tabs a{text-align:center;padding:7px 0;border-radius:8px;font-size:14px;color:#3a3a3c;text-decoration:none}
.tabs a.on{background:#fff;color:#1d1d1f;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.12)}
label{display:block;font-size:13px;color:var(--ink2);margin:0 0 6px}
input{width:100%;height:44px;border:1px solid var(--line);border-radius:10px;padding:0 14px;font-size:15px;margin-bottom:16px;outline:none;transition:border-color .15s,box-shadow .15s}
input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(0,82,217,.15)}
.hint{font-size:12px;color:#00000066;margin:-10px 0 16px}
button{width:100%;height:46px;border:0;border-radius:12px;background:var(--accent);color:#fff;font-size:16px;font-weight:500;cursor:pointer;margin-top:6px;box-shadow:0 6px 16px rgba(0,82,217,.25)}
button:active{transform:scale(.98)}.err{background:#fff0ed;color:#d54941;font-size:13px;padding:9px 12px;border-radius:8px;margin-bottom:16px}
.foot{margin-top:16px;text-align:center;color:#00000066;font-size:12px;line-height:1.6}
</style></head><body><form class="box" method="post" action="${reg ? "/register" : "/login"}">
<div class="logo">${LOGO}<span>培训认证</span></div>
<h1>FDE 认证模拟考试</h1><p class="sub">${reg ? "注册一个账号，练习进度按账号保存，多设备同步" : "登录后开始练习，进度在各设备间同步"}</p>
<div class="tabs"><a href="/login?next=${encodeURIComponent(next)}" class="${reg ? "" : "on"}">登录</a><a href="/register?next=${encodeURIComponent(next)}" class="${reg ? "on" : ""}">注册</a></div>
${error ? `<div class="err">${esc(error)}</div>` : ""}
<input type="hidden" name="next" value="${esc(next)}">
<label for="u">邮箱</label><input id="u" name="username" type="email" inputmode="email" autocomplete="${reg ? "email" : "username"}" value="${esc(email)}" placeholder="name@example.com" required autofocus>
<label for="p">密码</label><input id="p" name="password" type="password" autocomplete="${reg ? "new-password" : "current-password"}" ${reg ? 'minlength="8"' : ""} required>
${reg ? `<p class="hint">至少 8 位</p><label for="p2">确认密码</label><input id="p2" name="password2" type="password" autocomplete="new-password" minlength="8" required>` : ""}
<button type="submit">${reg ? "注册并登录" : "登录"}</button>
<p class="foot">${reg ? "非腾讯云官方题库，个人备考练习用" : "登录后 30 天内免登录"}</p>
</form></body></html>`;
}

const cookie = (val, age) => `${COOKIE}=${val}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;

// ---- 练习数据：每个账号一份，跨设备同步 ----
// 文件：DATA_DIR/<用户名的 base64url>.json  { rev, updatedAt, data: {key: 字符串}, meta: {key: 修改时间} }
const DATA_DIR = process.env.FDE_DATA || path.join(DIR, "data");
fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const stateFile = (user) => path.join(DATA_DIR, Buffer.from(user).toString("base64url") + ".json");
const readState = (user) => { try { return JSON.parse(fs.readFileSync(stateFile(user), "utf8")); } catch { return { rev: 0, updatedAt: 0, data: {}, meta: {} }; } };
function writeState(user, st) {
  const f = stateFile(user), tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(st), { mode: 0o600 });
  fs.renameSync(tmp, f); // 原子替换，避免写一半
}
const sendJSON = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };

function handleState(req, res, url) {
  const user = readToken(req.headers.cookie);
  if (!user) return sendJSON(res, 401, { error: "unauthorized" });
  if (req.method === "GET") {
    const st = readState(user);
    const since = Number(url.searchParams.get("since"));
    if (url.searchParams.has("since") && since === st.rev) return sendJSON(res, 200, { user, rev: st.rev, changed: false });
    return sendJSON(res, 200, { user, ...st, changed: true });
  }
  if (req.method === "PUT") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 2 * 1024 * 1024) req.destroy(); });
    req.on("end", () => {
      let p; try { p = JSON.parse(body); } catch { return sendJSON(res, 400, { error: "bad json" }); }
      const cur = readState(user);
      if (Number(p.baseRev) !== cur.rev) return sendJSON(res, 409, { user, ...cur }); // 别的设备先写了：返回最新数据让客户端合并后重试
      const next = { rev: cur.rev + 1, updatedAt: Date.now(), data: p.data || {}, meta: p.meta || {} };
      writeState(user, next);
      sendJSON(res, 200, { rev: next.rev, updatedAt: next.updatedAt });
    });
    return;
  }
  sendJSON(res, 405, { error: "method not allowed" });
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const ip = req.headers["x-real-ip"] || req.socket.remoteAddress;

  if (url.pathname === "/api/state") return handleState(req, res, url);

  if (url.pathname === "/api/me") {
    const user = readToken(req.headers.cookie);
    return user ? sendJSON(res, 200, { user }) : sendJSON(res, 401, { error: "unauthorized" });
  }

  if (url.pathname === "/api/password" && req.method === "POST") {
    const user = readToken(req.headers.cookie);
    if (!user) return sendJSON(res, 401, { error: "请重新登录" });
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 4096) req.destroy(); });
    req.on("end", () => {
      let p; try { p = JSON.parse(body); } catch { return sendJSON(res, 400, { error: "请求格式不对" }); }
      if (tooMany(ip)) return sendJSON(res, 429, { error: "尝试次数过多，请 10 分钟后再试" });
      const users = readUsers();
      if (!checkPw(String(p.old || ""), users[user])) { addFail(ip); return sendJSON(res, 400, { error: "当前密码不正确" }); }
      const nw = String(p.new || "");
      if (nw.length < 8) return sendJSON(res, 400, { error: "新密码至少 8 位" });
      if (nw.length > 200) return sendJSON(res, 400, { error: "新密码太长" });
      if (nw === p.old) return sendJSON(res, 400, { error: "新密码不能和当前密码相同" });
      users[user] = hashPw(nw);
      writeUsers(users);
      fails.delete(ip);
      // 当前设备换发新会话，其他设备的旧会话因盐改变而失效
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Set-Cookie": cookie(makeToken(user), MAX_AGE) });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  if (url.pathname === "/verify") { res.writeHead(readToken(req.headers.cookie) ? 204 : 401); return res.end(); }

  if (url.pathname === "/logout") { res.writeHead(302, { "Set-Cookie": cookie("", 0), Location: "/login" }); return res.end(); }

  if ((url.pathname === "/login" || url.pathname === "/register") && req.method === "GET") {
    if (readToken(req.headers.cookie)) { res.writeHead(302, { Location: safeNext(url.searchParams.get("next")) }); return res.end(); }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(page(safeNext(url.searchParams.get("next")), "", url.pathname === "/register" ? "register" : "login"));
  }

  if (url.pathname === "/register" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 4096) req.destroy(); });
    req.on("end", () => {
      const f = new URLSearchParams(body), next = safeNext(f.get("next"));
      const email = normUser(f.get("username")), pw = f.get("password") || "", pw2 = f.get("password2") || "";
      const html = (msg) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); res.end(page(next, msg, "register", email)); };
      if (regTooMany(ip)) return html("注册太频繁，请 1 小时后再试");
      if (!EMAIL_RE.test(email) || email.length > 254) return html("请输入有效的邮箱地址");
      if (pw.length < 8) return html("密码至少 8 位");
      if (pw.length > 200) return html("密码太长");
      if (pw !== pw2) return html("两次输入的密码不一致");
      const users = readUsers();
      if (users[email]) return html("这个邮箱已经注册过，请直接登录");
      users[email] = hashPw(pw);
      writeUsers(users);
      addReg(ip);
      res.writeHead(302, { "Set-Cookie": cookie(makeToken(email), MAX_AGE), Location: next });
      res.end();
    });
    return;
  }

  if (url.pathname === "/login" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 4096) req.destroy(); });
    req.on("end", () => {
      const f = new URLSearchParams(body), next = safeNext(f.get("next"));
      const html = (msg) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); res.end(page(next, msg, "login", normUser(f.get("username")))); };
      if (tooMany(ip)) return html("尝试次数过多，请 10 分钟后再试");
      const user = normUser(f.get("username")), stored = readUsers()[user];
      if (!stored || !checkPw(f.get("password") || "", stored)) { addFail(ip); return html("账号或密码不正确"); }
      fails.delete(ip);
      res.writeHead(302, { "Set-Cookie": cookie(makeToken(user), MAX_AGE), Location: next });
      res.end();
    });
    return;
  }

  res.writeHead(404); res.end();
}).listen(PORT, "127.0.0.1", () => console.log(`fde-auth listening on 127.0.0.1:${PORT}`));
