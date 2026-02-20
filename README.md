# ClawHuddle

**Managed OpenClaw for teams** — Give every person on your team their own AI assistant.

Each team member gets an isolated [OpenClaw](https://openclaw.ai) instance — no servers, no Docker, no maintenance. You add people, we handle the rest.

[English](#features) | [中文](./README_zh.md)

---

## Features

- **Isolated instances** — Every team member gets their own workspace, conversation history, and config. Nothing is shared.
- **Managed skills** — Build a library of custom skills. Assign them to individuals or the whole team from one dashboard.
- **Admin controls** — Invite members, manage API keys, monitor deployments. One place for everything.
- **Zero-touch deploy** — Add someone to your org. Their AI assistant is running within seconds.
- **Private & secure** — Each instance is fully isolated. Conversations, files, and settings never leak between users.
- **Multi-provider** — Bring your own API keys for Anthropic, OpenAI, or any supported provider.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Traefik                         │
│                  (reverse proxy)                    │
└──────────┬──────────────────┬───────────────────────┘
           │                  │
     ┌─────▼─────┐     ┌─────▼─────┐
     │  Next.js   │     │  Fastify   │
     │  Frontend  │     │  API       │
     │  :3000     │     │  :4000     │
     └───────────┘     └─────┬─────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
        │  OpenClaw  │  │  OpenClaw  │  │  OpenClaw  │
        │  User A    │  │  User B    │  │  User C    │
        │  (Docker)  │  │  (Docker)  │  │  (Docker)  │
        └───────────┘  └───────────┘  └───────────┘
```

**Monorepo structure:**

```
apps/
  api/          Fastify + SQLite backend
  web/          Next.js 16 frontend
packages/
  shared/       TypeScript types
docker/
  gateway/      OpenClaw container image
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, NextAuth v5 |
| Backend | Fastify 5, better-sqlite3, dockerode |
| Gateway | OpenClaw (Docker containers, per-user) |
| Proxy | Traefik 2.11 |
| Build | Turborepo, TypeScript 5.7 |

## Getting Started

### Prerequisites

- Node.js 22+
- npm 11+
- Docker (for gateway containers)

### Setup

1. **Clone the repo**

```bash
git clone https://github.com/anthropics/clawhuddle.git
cd clawhuddle
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment**

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=change-me-to-random-secret

# LLM API key (used as org default)
ANTHROPIC_API_KEY=sk-ant-...

# Super admin account
SUPER_ADMIN_EMAIL=you@example.com

# Optional: restrict sign-in to a specific email domain
ALLOWED_DOMAIN=

# Optional: invitation emails via Resend
RESEND_API_KEY=re_xxxx
EMAIL_FROM=ClawHuddle <noreply@yourdomain.com>
```

4. **Run database migrations**

```bash
npm run db:migrate
```

5. **Build the gateway image**

```bash
docker build -t clawhuddle-gateway:local docker/gateway
```

6. **Start development servers**

```bash
npm run dev
```

The app will be available at `http://localhost:3000` (frontend) and `http://localhost:4000` (API).

### First Login

Open `http://localhost:3000/login` and sign in. The first user automatically becomes the admin. From there you can create an organization, invite team members, and provision AI assistant instances.

## Docker Compose (Production)

```bash
docker compose up -d
```

This starts Traefik, the web frontend, the API server, and builds the gateway base image. Each team member's OpenClaw instance is provisioned on-demand via the admin dashboard.

## Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXTAUTH_URL` | Frontend URL | Yes |
| `NEXTAUTH_SECRET` | Session encryption secret | Yes |
| `ANTHROPIC_API_KEY` | Default Anthropic API key | Yes |
| `SUPER_ADMIN_EMAIL` | Admin account email | No |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | No |
| `ALLOWED_DOMAIN` | Restrict sign-in to email domain | No |
| `RESEND_API_KEY` | Resend API key for emails | No |
| `EMAIL_FROM` | Sender address for emails | No |
| `DATABASE_PATH` | SQLite file path (default: `./data/db.sqlite`) | No |
| `DOCKER_NETWORK` | Docker network name (default: `clawhuddle-net`) | No |
| `DOMAIN` | Production domain | No |

## Project Scripts

```bash
npm run dev          # Start all services in dev mode
npm run build        # Build all packages
npm run db:migrate   # Run database migrations
```

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## Support

If you find ClawHuddle useful, consider buying me a coffee!

<a href="https://buymeacoffee.com/unless" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40"></a>

## License

MIT
