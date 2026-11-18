// FDE 模拟考试的登录网关（零依赖）。
// nginx 用 auth_request 调 /verify 判断是否已登录；未登录跳到 /login。
//
// 运行：node server.mjs                       （监听 127.0.0.1:19015）
// 设置账号：node server.mjs --set-user 用户名 密码
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

// ---- 命令行：管理账号 ----
const args = process.argv.slice(2);
if (args[0] === "--set-user" || args[0] === "--del-user") {
  const users = readUsers();
  if (args[0] === "--set-user") {
    if (!args[1] || !args[2]) { console.error("用法：node server.mjs --set-user 用户名 密码"); process.exit(1); }
    users[args[1]] = hashPw(args[2]);
  } else delete users[args[1]];
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), { mode: 0o600 });
  console.log(args[0] === "--set-user" ? `已设置账号：${args[1]}` : `已删除账号：${args[1]}`);
  process.exit(0);
}

if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
const SECRET = fs.readFileSync(SECRET_FILE, "utf8").trim();

// ---- 会话：用户名.过期时间.签名 ----
const sign = (s) => crypto.createHmac("sha256", SECRET).update(s).digest("base64url");
const makeToken = (user) => { const body = `${Buffer.from(user).toString("base64url")}.${Math.floor(Date.now() / 1000) + MAX_AGE}`; return `${body}.${sign(body)}`; };
function readToken(cookieHeader = "") {
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [u, exp, sig] = m[1].split(".");
  if (!u || !exp || !sig) return null;
  const expect = sign(`${u}.${exp}`);
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  const user = Buffer.from(u, "base64url").toString();
  return readUsers()[user] ? user : null; // 账号被删除后会话立即失效
}

// ---- 失败次数限制：同一 IP 10 分钟内最多错 8 次 ----
const fails = new Map();
const tooMany = (ip) => { const f = fails.get(ip); return f && f.n >= 8 && Date.now() - f.t < 10 * 60e3; };
const addFail = (ip) => { const f = fails.get(ip); fails.set(ip, f && Date.now() - f.t < 10 * 60e3 ? { n: f.n + 1, t: f.t } : { n: 1, t: Date.now() }); };

const safeNext = (n) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const LOGO = fs.existsSync(path.join(DIR, "logo.svg")) ? fs.readFileSync(path.join(DIR, "logo.svg"), "utf8") : "";

function page(next, error = "") {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>登录 · FDE 认证模拟考试</title>
<style>
:root{--accent:#0052d9;--ink:#000000e6;--ink2:#00000099;--line:#dcdcdc;--bg:#f3f4f7}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(160deg,#e8f0ff,#f5f8ff 45%,#fff);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif;color:var(--ink);padding:16px}
.box{width:100%;max-width:380px;background:#fff;border-radius:18px;padding:36px 32px 28px;box-shadow:0 0 0 1px rgba(0,0,0,.05),0 12px 40px rgba(0,40,120,.10)}
.logo{display:flex;align-items:center;gap:10px;margin-bottom:22px;color:var(--ink)}.logo svg{height:22px;width:auto}.logo span{padding-left:10px;border-left:1px solid #e7e7e7;font-weight:600;font-size:14px}
h1{font-size:22px;font-weight:600;letter-spacing:-.01em;margin:0 0 4px}p.sub{margin:0 0 24px;color:var(--ink2);font-size:13px}
label{display:block;font-size:13px;color:var(--ink2);margin:0 0 6px}
input{width:100%;height:44px;border:1px solid var(--line);border-radius:10px;padding:0 14px;font-size:15px;margin-bottom:16px;outline:none;transition:border-color .15s,box-shadow .15s}
input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(0,82,217,.15)}
button{width:100%;height:46px;border:0;border-radius:12px;background:var(--accent);color:#fff;font-size:16px;font-weight:500;cursor:pointer;margin-top:6px;box-shadow:0 6px 16px rgba(0,82,217,.25)}
button:active{transform:scale(.98)}.err{background:#fff0ed;color:#d54941;font-size:13px;padding:9px 12px;border-radius:8px;margin-bottom:16px}
.foot{margin-top:18px;text-align:center;color:#00000066;font-size:12px}
</style></head><body><form class="box" method="post" action="/login">
<div class="logo">${LOGO}<span>培训认证</span></div>
<h1>FDE 认证模拟考试</h1><p class="sub">请登录后开始练习</p>
${error ? `<div class="err">${esc(error)}</div>` : ""}
<input type="hidden" name="next" value="${esc(next)}">
<label for="u">账号</label><input id="u" name="username" autocomplete="username" required autofocus>
<label for="p">密码</label><input id="p" name="password" type="password" autocomplete="current-password" required>
<button type="submit">登录</button>
<p class="foot">登录后 30 天内免登录</p>
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

  if (url.pathname === "/verify") { res.writeHead(readToken(req.headers.cookie) ? 204 : 401); return res.end(); }

  if (url.pathname === "/logout") { res.writeHead(302, { "Set-Cookie": cookie("", 0), Location: "/login" }); return res.end(); }

  if (url.pathname === "/login" && req.method === "GET") {
    if (readToken(req.headers.cookie)) { res.writeHead(302, { Location: safeNext(url.searchParams.get("next")) }); return res.end(); }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(page(safeNext(url.searchParams.get("next"))));
  }

  if (url.pathname === "/login" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 4096) req.destroy(); });
    req.on("end", () => {
      const f = new URLSearchParams(body), next = safeNext(f.get("next"));
      const html = (msg) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); res.end(page(next, msg)); };
      if (tooMany(ip)) return html("尝试次数过多，请 10 分钟后再试");
      const user = f.get("username") || "", stored = readUsers()[user];
      if (!stored || !checkPw(f.get("password") || "", stored)) { addFail(ip); return html("账号或密码不正确"); }
      fails.delete(ip);
      res.writeHead(302, { "Set-Cookie": cookie(makeToken(user), MAX_AGE), Location: next });
      res.end();
    });
    return;
  }

  res.writeHead(404); res.end();
}).listen(PORT, "127.0.0.1", () => console.log(`fde-auth listening on 127.0.0.1:${PORT}`));
