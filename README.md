# FDE 认证模拟考试（个人练习版）

> **声明：本项目是个人备考腾讯云「人工智能前沿部署工程师（FDE）」认证时自己做的练习工具，非腾讯云官方题库，与腾讯云无关，不代表官方考试真题、题型或评分标准。**
> 题目根据公开课程资料整理、由 AI 辅助出题，可能存在错误，请以腾讯云培训认证官网和官方课程为准。
> 页面中使用的「腾讯云」名称与 logo 归腾讯公司所有，仅用于标示所练习的认证科目。

腾讯云「人工智能前沿部署工程师（FDE）」认证理论考试的本地模拟系统。

- 40 道单选（每题 1.5 分）+ 20 道多选（每题 2 分），满分 100，70 分及格，限时 120 分钟
- 每次开考从 615 题的题库里按考试配比随机生成一套 60 题试卷，优先抽没出过的题
- 题目按官方十个知识模块的占比分配，场景化出题，每题附考点、解析和出处
- 答题卡按单选 / 多选分组显示，首页显示最近 5 次成绩
- 「直接看答案」随机生成一套卷并直接显示答案；答题中「一键交卷」
- 错题集：答错自动收集并累计次数，可专门练习，在错题集里答对即移出
- 专项练习（`js/topic.js`）：按知识模块多选刷题，可选题量（10/20/全部）、顺序（没做过优先/错题优先/随机）、练习或考试方式；记录每题掌握情况；提供按小节汇总的「知识点速览」
- 两种模式：**练习模式**（每题当场判对错，指出错选 / 漏选、本题考点、解析和出处，不限时）；**考试模式**（120 分钟倒计时，交卷后统一出分）
- 答题卡跳题、标记、中途关闭可继续
- 交卷后显示模块正确率、逐题解析，可只练错题

## 学习资料（飞书，公开可读）

- [腾讯人工智能前沿部署工程师 FDE · 总览](https://bihuo1688.feishu.cn/wiki/SFCOwrRepiasn1kHTtycAy5Fnac)：课程知识库入口
- [必考知识点速记](https://bihuo1688.feishu.cn/wiki/GGF5wuRG1iXK2LkAUKNcQXwbnuf)：按 10 个考试模块整理的考点速记

课程各章：

- [第1章 概览与方法论](https://bihuo1688.feishu.cn/wiki/C6eJw0I8yija4AkV84lcC0VxnNh)
- [第2章 腾讯云AI重点产品介绍](https://bihuo1688.feishu.cn/wiki/VMgzwoDizika3LkUPQOc5gdsnJd)
- [第3章 人工智能工程](https://bihuo1688.feishu.cn/wiki/UyxPwYO0Ni1qYrkOTUzcRsVfnIh)
- [第4章 WorkBuddy 上手实操](https://bihuo1688.feishu.cn/wiki/JSjSwGWuTihxhfkAAqGcgc84nDd)
- [第5章 管理端：企业后台与 WMA 配置实战](https://bihuo1688.feishu.cn/wiki/SXJnwIgzNiWivgkbZDwcIJWYnFc)
- [第6章 进场：挖真需求、破一线抵触](https://bihuo1688.feishu.cn/wiki/TxxpwQzNRiNfnwk7dHTcYIUAn2d)
- [第7章 交付：做成、且验得动](https://bihuo1688.feishu.cn/wiki/EUsiwVnezilcK3kCs8KcPcHFnCb)
- [第8章 沉淀：把经验变成组织资产](https://bihuo1688.feishu.cn/wiki/LbO2wJhSWiAvZCkU2wkcEg8QnOc)
- [第9章 综合实战：12 周 FDE 养成计划](https://bihuo1688.feishu.cn/wiki/Q1CnwC9luiLUHukMq4vcL4N0nad)
- [第10章 安全治理与护栏](https://bihuo1688.feishu.cn/wiki/OflnwVbgkifA1RkIcrSc2pn4nHg)
- [第11章 案例实战：企业 CFO 财务结算审核](https://bihuo1688.feishu.cn/wiki/JdiFwGj8zinbLMkrvHdcdgacnmd)
- [第12章 关键问题 FAQ](https://bihuo1688.feishu.cn/wiki/NUSfw5W8IiOH9ckPnzLcVLDynFJ)

## 启动

需要 Node.js（任意较新版本，无需安装依赖）：

```bash
npm start
```

然后在浏览器打开 http://localhost:5173 。

也可以不启动服务，直接双击 `index.html` 用浏览器打开。

## 部署

线上地址：https://fde.metafeng.com （nginx 静态站点，证书由 certbot 自动续期）

首次部署前，复制 `scripts/deploy.env.example` 为 `scripts/deploy.env`，填写服务器地址和站点目录（该文件不会提交）。之后修改题目或页面，在项目根目录执行：

```bash
bash scripts/deploy.sh
```

脚本会先重新生成题库，再把 `index.html`、`css`、`js`、`assets` 同步到服务器。

### 登录

线上站点需要账号密码登录（`auth/server.mjs`，零依赖 Node 服务，部署在服务器 `/opt/fde-auth`，systemd 服务名 `fde-auth`，监听 127.0.0.1:19015，nginx 用 `auth_request` 校验）。

在服务器上管理账号：

```bash
cd /opt/fde-auth
sudo -u www-data node server.mjs --set-user 用户名 新密码   # 新增账号或改密码
sudo -u www-data node server.mjs --del-user 用户名          # 删除账号（该账号会立即下线）
```

## 目录

```
index.html          页面结构
css/style.css       样式（自动跟随系统深浅色）
js/app.js           考试逻辑
js/questions.js     题库（由 scripts/build.py 生成，不要手改）
data/m0~m9.json     各模块题目源文件，set 字段表示第几套
data/official.json  官方模拟考试 15 题
scripts/build.py    合并 data/ 生成 js/questions.js，并校验格式
server.js           零依赖本地静态服务器
```

## 添加或修改题目

编辑 `data/` 下对应模块的 JSON，然后运行：

```bash
python3 scripts/build.py
```

每道题的格式：

```json
{ "set": 1, "t": "s", "k": "本题考点", "q": "题干", "o": ["选项A", "选项B", "选项C", "选项D"], "a": [2], "e": "解析", "src": "第 1 章 1.1" }
```

- `set`：题目批次（1–10，或 official），仅用于组织题库，前端不显示
- `t`：`"s"` 单选，`"m"` 多选
- `a`：正确选项下标（从 0 开始），多选写多个
- `k`：本题考点，答题反馈里显示

答题进度、最近成绩和错题集保存在浏览器 localStorage 中，只存在本机。
