# 私人学习数据云同步（可选）

这项功能把 **MoE 等课程疑问、笔记、学习进度和个人知识网络** 自动备份到你自己的 GitHub **私有仓库**。它与公开课程仓库分离，不需要保持 ChatGPT 云电脑在线。

**重要：只提交 `learning/snapshot.json` 到私有仓库；不要把私有记录复制到公开知识图谱仓库。**

## 已包含什么

- 网站：「云同步」入口、GitHub 登录、数秒后自动保存、手动刷新、冲突警告、退出本机登录。
- 后端：Cloudflare Worker 示例（仓库根目录 `cloud-sync-worker.js`），用 GitHub 身份确认来访者，再使用仅放在 Worker Secret 中的私有仓库细粒度 PAT 读写。
- 可随时继续使用本地版，之前的 `localStorage` 记录不会被自动清空。
- 个人数据可继续通过顶部「导出进度」下载备份。

## 一次性设置（需要仓库所有者本人完成）

### 1. 创建一个单独的 GitHub **Private** 仓库

打开 [New repository](https://github.com/new?name=ai-inference-learning-private)，名称示例：`ai-inference-learning-private`，务必选择 **Private**，不放任何自研芯片保密数据。以后只存放个人学习疑问和进度。

公开网页仓库 `ai-inference-learning-map` 无需改为私有，它只存课程与代码。

### 2. 部署 Cloudflare Worker（不是重新搭建网站）

将项目连接到 Cloudflare Workers，使用根目录 `wrangler.jsonc` 和 `cloud-sync-worker.js` 部署。Wrangler 会产生一个类似 `https://ai-inference-private-sync.你的账户.workers.dev` 的地址。

需要拥有自己的 Cloudflare 账户并授权部署；**当前项目不会自行替你创建 Cloudflare 账户或使用你的个人密钥**。

首次部署时 `/health` 可以显示 `ready:false`，因为尚未设置以下 Secret。

### 3. 创建 GitHub OAuth App（用于验证“访问网页的是你本人”）

在 GitHub **Settings → Developer settings → OAuth Apps → New OAuth App** 创建 OAuth 应用：

- Homepage URL：`https://sbf20010121-svg.github.io/ai-inference-learning-map/`
- Authorization callback URL：`https://你的-worker.workers.dev/auth/callback`

为这个 OAuth App 设置 Client ID 和 Client Secret；登录时只请求 `read:user`。它**没有**直接写你的仓库的权限。

### 4. 为私有仓库创建最小权限 Token（仅保存在 Worker）

GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens**：

- Repository access → **Only select repositories** → 只选 `ai-inference-learning-private`。
- Repository permissions → **Contents: Read and write**。
- 设定合理到期日，并记住到期后需要更新 Worker Secret。

不要把 PAT、OAuth Client Secret 或 Session 密钥发到 ChatGPT、写进 `site/cloud-config.json`、提交 Git 或粘贴到学习网页。

### 5. 在 Worker 中配置环境变量与 Secrets

非密钥变量（放在 `wrangler.jsonc` 中或 Worker Settings）：

| 变量 | 值 |
| --- | --- |
| `SITE_URL` | `https://sbf20010121-svg.github.io/ai-inference-learning-map/` |
| `ALLOWED_LOGIN` | `sbf20010121-svg` |
| `DATA_REPO` | `sbf20010121-svg/ai-inference-learning-private` |

**Secret**（Cloudflare Worker → Settings → Variables and Secrets，类型选 Secret）：

| 变量 | 来源 |
| --- | --- |
| `GITHUB_DATA_PAT` | 上一步的 GitHub 细粒度 PAT |
| `GH_OAUTH_CLIENT_ID` | OAuth App 的 Client ID |
| `GH_OAUTH_CLIENT_SECRET` | OAuth App 的 Client Secret |
| `SESSION_HMAC_KEY` | 自行生成的高熵随机串（至少 32 字节；例如本地运行 `openssl rand -base64 48`） |

Cloudflare Worker Settings 中的 **Secret** 只在服务端使用。配置完访问 `https://你的-worker.workers.dev/health`，看到 `ready:true` 才表明变量齐全（不代表已成功完成私有仓库的授权和写入测试）。

### 6. 在学习网页里完成连接

1. 打开学习网页顶部 **云同步**。
2. 将 `https://你的-worker.workers.dev` 粘贴到服务地址（**只粘贴地址，不粘贴 Token**）。
3. 点击 **用 GitHub 连接**；通过 GitHub 授权后返回网页。
4. 首次同步如果本地、云端都有记录，会提示选择。**先导出本地备份再决定**；不会擅自覆盖。
5. 在 MoE 课程填写一条测试疑问，看状态变成 **已同步**。重新进入页面时应能读取它。

如需在所有设备免于重复填写 Worker URL，可把**仅含 URL、不含任何密钥**的 `apiBase` 设置到 `site/cloud-config.json`，提交公开仓库。网页启动时会读取它。

## 后续使用 ChatGPT

今后对 ChatGPT 说「读取我在知识图谱 MoE 课程的最新疑问，并解释和更新网页」，ChatGPT 可通过已经连接的 GitHub 工具，从你**授权访问的私有数据仓库**读取 `learning/snapshot.json`，再按需更改公开课程仓库。

**务必在 ChatGPT 的 GitHub 连接设置中授权这一个新的私有仓库**。GitHub 网页登录与 ChatGPT 的 GitHub 连接是两项不同的授权；若 ChatGPT 无法访问该私有仓库，就无法读取其数据。

## 数据与安全边界

- 私有文件：`learning/snapshot.json`，内容为网站进度 JSON，格式兼容页面顶部「导出进度」。
- **不做自动模型调用**、没有后台主动分析；你问 ChatGPT 时才读取最新内容。
- Worker **拒绝写入 Public 仓库**，仅允许 `ALLOWED_LOGIN` 通过 GitHub OAuth。
- OAuth Token 仅在 Worker 请求流程中短暂使用，不返回到网页；浏览器只保留**最多 6 小时**的签名学习会话（SessionStorage）。不同浏览器必须重新登录。
- 若两个设备同时写入且远端版本不同，Worker 会返回 HTTP `409` 并阻止覆盖；网页要求人工选择处理。
- GitHub 私有仓库是云端备份，不代表绝对机密；**公司内部芯片资料和内部 Benchmark 不要写入这个系统**。
- 浏览器本地仍保存数据，离线时不会丢失；自动保存失败时明确显示错误，后续可重试。
- 本版没有后台双向实时推送；这是**改动后延迟约几秒自动上传、打开网页或手动刷新时下载**的同步，不是协同编辑器。

## 技术维护者的验证建议

`npm test` 检查服务端模拟 GitHub OAuth、SHA 冲突、私有仓库限制和旧课程兼容性。浏览器可验证面板与本地记录；上线后还需一遍**真实 OAuth 授权 + 私有仓库写入 + 跨设备读取**端到端验收。未完成此验收前不要宣称云同步已可用。
