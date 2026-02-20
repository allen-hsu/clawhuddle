# ClawHuddle

**為團隊打造的託管式 OpenClaw** — 讓團隊中的每個人都擁有自己的 AI 助理。

每位團隊成員都會獲得一個獨立的 [OpenClaw](https://openclaw.ai) 實例 — 不需要管理伺服器、不需要操作 Docker、零維護成本。你只需要新增成員，其餘的我們搞定。

[中文](#功能特色) | [English](./README.md)

---

## 功能特色

- **獨立實例** — 每位團隊成員擁有自己的工作空間、對話記錄與設定，彼此完全隔離。
- **技能管理** — 建立自訂技能庫，從後台統一指派給個人或整個團隊。
- **管理後台** — 邀請成員、管理 API 金鑰、監控部署狀態，一個介面搞定一切。
- **秒級部署** — 將成員加入組織，AI 助理在幾秒內自動啟動。
- **隱私安全** — 每個實例完全隔離，對話、檔案、設定不會在使用者之間洩漏。
- **多供應商支援** — 自帶 Anthropic、OpenAI 或其他支援的供應商 API 金鑰。

## 架構

```
┌─────────────────────────────────────────────────────┐
│                     Traefik                         │
│                   (反向代理)                         │
└──────────┬──────────────────┬───────────────────────┘
           │                  │
     ┌─────▼─────┐     ┌─────▼─────┐
     │  Next.js   │     │  Fastify   │
     │  前端       │     │  API       │
     │  :3000     │     │  :4000     │
     └───────────┘     └─────┬─────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
        │  OpenClaw  │  │  OpenClaw  │  │  OpenClaw  │
        │  使用者 A   │  │  使用者 B   │  │  使用者 C   │
        │  (Docker)  │  │  (Docker)  │  │  (Docker)  │
        └───────────┘  └───────────┘  └───────────┘
```

**Monorepo 專案結構：**

```
apps/
  api/          Fastify + SQLite 後端
  web/          Next.js 16 前端
packages/
  shared/       TypeScript 型別定義
docker/
  gateway/      OpenClaw 容器映像
```

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | Next.js 16, React 19, Tailwind CSS 4, NextAuth v5 |
| 後端 | Fastify 5, better-sqlite3, dockerode |
| 閘道 | OpenClaw (Docker 容器，每位使用者獨立) |
| 代理 | Traefik 2.11 |
| 建置 | Turborepo, TypeScript 5.7 |

## 快速開始

### 前置需求

- Node.js 22+
- npm 11+
- Docker（用於閘道容器）

### 安裝步驟

1. **複製專案**

```bash
git clone https://github.com/anthropics/clawhuddle.git
cd clawhuddle
```

2. **安裝依賴**

```bash
npm install
```

3. **設定環境變數**

```bash
cp .env.example .env
```

編輯 `.env`：

```env
# 認證
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=請換成隨機字串

# LLM API 金鑰（作為組織預設值）
ANTHROPIC_API_KEY=sk-ant-...

# 超級管理員帳號
SUPER_ADMIN_EMAIL=you@example.com

# 選填：限制登入的 email 網域
ALLOWED_DOMAIN=

# 選填：透過 Resend 發送邀請信
RESEND_API_KEY=re_xxxx
EMAIL_FROM=ClawHuddle <noreply@yourdomain.com>
```

4. **執行資料庫遷移**

```bash
npm run db:migrate
```

5. **建置閘道映像**

```bash
docker build -t clawhuddle-gateway:local docker/gateway
```

6. **啟動開發伺服器**

```bash
npm run dev
```

前端位於 `http://localhost:3000`，API 位於 `http://localhost:4000`。

### 首次登入

開啟 `http://localhost:3000/login` 登入。第一位使用者將自動成為管理員。接著你可以建立組織、邀請團隊成員、為成員佈建 AI 助理實例。

## Docker Compose（正式環境）

```bash
docker compose up -d
```

這會啟動 Traefik、前端、API 伺服器，並建置閘道基礎映像。每位團隊成員的 OpenClaw 實例會透過管理後台按需佈建。

## 環境變數

| 變數 | 說明 | 必填 |
|------|------|------|
| `NEXTAUTH_URL` | 前端 URL | 是 |
| `NEXTAUTH_SECRET` | Session 加密密鑰 | 是 |
| `ANTHROPIC_API_KEY` | 預設 Anthropic API 金鑰 | 是 |
| `SUPER_ADMIN_EMAIL` | 管理員帳號 email | 否 |
| `GOOGLE_CLIENT_ID` | Google OAuth 用戶端 ID | 否 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 用戶端密鑰 | 否 |
| `ALLOWED_DOMAIN` | 限制登入 email 網域 | 否 |
| `RESEND_API_KEY` | Resend API 金鑰（發信用） | 否 |
| `EMAIL_FROM` | 寄件者地址 | 否 |
| `DATABASE_PATH` | SQLite 檔案路徑（預設：`./data/db.sqlite`） | 否 |
| `DOCKER_NETWORK` | Docker 網路名稱（預設：`clawhuddle-net`） | 否 |
| `DOMAIN` | 正式環境網域 | 否 |

## 專案指令

```bash
npm run dev          # 啟動所有開發伺服器
npm run build        # 建置所有套件
npm run db:migrate   # 執行資料庫遷移
```

## 貢獻

歡迎貢獻！請先開 issue 討論你想做的改動。

1. Fork 本專案
2. 建立你的分支 (`git checkout -b feat/my-feature`)
3. 提交你的變更
4. 推送到分支
5. 開啟 Pull Request

## 贊助

如果 ClawHuddle 對你有幫助，歡迎請我喝杯咖啡！

<a href="https://buymeacoffee.com/unless" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40"></a>

## 授權

MIT
