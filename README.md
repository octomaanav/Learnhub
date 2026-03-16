<p align="center">
  <img src="https://img.shields.io/badge/Google-Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google Gemini" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-Drizzle-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
</p>

<h1 align="center">LearnHub</h1>
<p align="center"><strong>Voice‑first, multimodal learning — built on Gemini.</strong></p>

<p align="center">
A platform where a student can learn with only their voice, in multiple formats per concept,
with built‑in accessibility for visual, motor and cognitive differences.
</p>

---

## ✨ What LearnHub Does

**LearnHub** turns Gemini into a **full teaching environment**, not just a chatbox:

- **Pulse Mode (voice‑only):**  
  A fullscreen experience with a waveform and a blank canvas. The student says  
  “Hey LearnHub — let’s start learning”, and Gemini Live:
  - teaches the lesson in real time  
  - calls tools to navigate the app  
  - pushes visuals (Mermaid diagrams, story slides, Braille overlays) to the canvas

- **Two learning paths**
  - **School Curriculum:** CBSE/ICSE/IB‑style, mapped to board syllabus
  - **Knowledge Hub:** open library of any topic (“learn anything” mode)

- **Four formats per concept**
  - **Article:** tiny, 3‑sentence max explanations
  - **Quiz / Practice:** structured checks for understanding
  - **Story Mode:** narrative + images for students who learn through stories
  - **Braille:** Nemeth math + text for blind students

- **Teacher / Admin tools**
  - One‑sentence **roadmap builder**: “Build a roadmap for a student who loves visuals but struggles with reading” → Gemini generates profile + plan
  - Roadmap exports as a PDF and can be loaded into the student’s account

- **Proactive nudges (Telegram)**
  - Scheduler + Telegram bot send “You were mid‑way through Quadratic Equations” messages
  - Deep link brings the student back directly into the right lesson

See `DEMO_SCRIPT.md` for the full live demo narrative.

---

## 🧠 Gemini & AI Architecture

LearnHub uses Gemini in two places:

- **On the client (browser) — Gemini Live**
  - `web/src/lib/genai-live-client.ts` manages a long‑lived Live session
  - `web/src/services/commandExecutor.ts` executes tool calls:
    - navigation (dashboard, Pulse, admin, lessons)
    - open lessons & microsections
    - query knowledge base from the DB
    - push visuals to the Pulse canvas (Mermaid diagrams, story slides)
    - trigger Braille, story mode, lesson plans and UI actions

- **On the server (API) — Gemini 2.0 Flash / others**
  - `api/src/utils/gemini.ts` wraps generative calls for:
    - lesson & micro‑section generation
    - roadmap generation
    - structured JSON output with robust LaTeX / math handling
  - Story & image generation pipelines create Story Mode slides and assets
  - Gemini is also the “brain” for admin roadmap text and knowledge‑hub content

Other AI pieces:
- **LibLouis / Braille:** converts math + text to Nemeth Braille on the backend
- **Mermaid:** renders diagrams pushed by Gemini to the canvas on the frontend

A high‑level Mermaid architecture diagram lives in `ARCHITECTURE_DIAGRAM.md`.

---

## 🏗️ Architecture Overview

**Monorepo layout**

- `web/` – Vite + React 19 SPA
  - Pulse page, dashboard, Knowledge Hub, Story Mode, admin screens
  - Voice agent, tool‑calling, visual canvas, accessibility overlays
- `api/` – Express + TypeScript
  - Lesson / content / story / Braille / admin / progress / webhooks
  - DB migrations + seeding with Drizzle
  - Worker loop and scheduler for background jobs
  - Telegram service for proactive nudges

**Key backend pieces**

- **Postgres + Drizzle ORM**
  - classes, subjects, chapters, microsections
  - user profiles, progress, bookmarks
  - knowledge‑hub search index

- **Worker + Scheduler**
  - runs DB‑backed jobs (no Redis)
  - triggers **Telegram nudges** (e.g., streak reminders, “resume where you left off”)

- **Media storage**
  - Local `/media` in dev (configurable to S3/Cloud Storage in prod)
  - Hosts story slides, generated images, and other assets

Deployment (typical setup):

- **Web**: built with Vite and deployed to a static host (e.g., Vercel)
- **API**: built as a Node service and deployed to **Cloud Run** (or similar)
- **Postgres**: managed instance (e.g., Cloud SQL)
- **Infra**: Terraform modules to provision Cloud Run, DB, storage, and secrets  
  plus a deploy script / CI pipeline (GitHub Actions) that:
  - runs tests & build
  - builds and pushes the API container
  - applies Terraform (IaC) and/or runs `gcloud run deploy`
  - deploys the web app

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite, React Router, Tailwind‑style design
- **Voice Runtime:** `@google/genai` Live API, custom `GenAILiveClient`, CommandExecutor, WAV/PCM audio
- **Backend:** Node.js, Express 5, TypeScript, `@google/generative-ai`
- **Database:** PostgreSQL + Drizzle ORM + migrations / seeding
- **Accessibility:** LibLouis + liblouis-build, Braille overlays, Nemeth math, focus modes
- **Messaging:** Telegram bot (`node-telegram-bot-api`)
- **Scheduling:** `node-cron` worker loop
- **Infra (recommended):** Terraform for Cloud Run / Cloud SQL / Storage / IAM

---

## 🚀 Reproducible Testing (Judge Setup Guide)

Everything a reviewer needs to clone, configure, and run LearnHub locally.

### Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| **Node.js** | 20+ | Runtime for both `api/` and `web/` |
| **npm** | 10+ | Ships with Node 20 |
| **PostgreSQL** | 15+ | Primary database |
| **Docker** *(optional)* | 24+ | Run the API as a container instead of bare Node |
| **Google AI Studio account** | — | To get a free Gemini API key |

### 1. Clone the repo

```bash
git clone https://github.com/your-username/learnhub.git
cd learnhub
```

### 2. Set up environment variables

Copy the examples below and fill in your own values.

#### `api/.env`

```env
# ── Database ──────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gemini_hack

# ── Auth / sessions ──────────────────────────────────────
SESSION_SECRET=any-random-string-here

# ── Gemini AI (required) ─────────────────────────────────
# Get your key at https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash-exp

# ── Storage ──────────────────────────────────────────────
STORAGE_PROVIDER=local

# ── Frontend URL (for CORS) ──────────────────────────────
FRONTEND_URL=http://localhost:5173

# ── Optional: Telegram bot (only needed for nudge feature)
# TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

#### `web/.env`

```env
# Points to the local API server
VITE_API_URL=http://localhost:8000

# Same Gemini key — used client-side for Gemini Live voice sessions
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 3. Create the Postgres database

```bash
# Using psql (adjust user/password to match your local setup)
psql -U postgres -c "CREATE DATABASE gemini_hack;"
```

Or with Docker (no local Postgres install required):

```bash
docker run -d \
  --name learnhub-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=gemini_hack \
  -p 5432:5432 \
  postgres:15
```

### 4a. Run locally (bare Node — recommended for reviewers)

```bash
# Install dependencies
cd api && npm install
cd ../web && npm install

# Start the API (auto-runs migrations + seeds the DB on first boot)
cd ../api
npm run dev
# → API is live at http://localhost:8000
# → Verify: curl http://localhost:8000/health

# In a second terminal, start the web app
cd web
npm run dev
# → Web app is live at http://localhost:5173
```

### 4b. Run the API via Docker (alternative)

```bash
cd api

# Build the image
docker build -t learnhub-api .

# Run it (pass env vars from your .env)
docker run -d \
  --name learnhub-api \
  -p 8000:8000 \
  --env-file .env \
  learnhub-api

# Verify
curl http://localhost:8000/health
# → {"status":"ok","timestamp":"..."}

# Then start the web app normally
cd ../web
npm install && npm run dev
```

### 5. Verify everything is working

| Check | Command / URL | Expected |
|-------|---------------|----------|
| API health | `curl http://localhost:8000/health` | `{"status":"ok"}` |
| Web app loads | Open `http://localhost:5173` | Landing page renders |
| DB connected | Watch API terminal on startup | `Connected to database` + `Migrations completed` |
| Seeded data | Watch API terminal | `Basic seed data created` + `Lesson seeding complete` |

### 6. Useful API commands

```bash
# Inside api/

npm run dev              # Start dev server (migrate + watch)
npm run migrate:db       # Run DB migrations only
npm run seed             # Seed base data (curricula, classes, subjects)
npm run seed:lessons     # Seed lesson content from JSON files
npm run studio:db        # Open Drizzle Studio (visual DB browser)
npm run build            # Compile TypeScript to dist/
npm start                # Run compiled production build
```

### 7. What to test (feature walkthrough)

Once both servers are running, open `http://localhost:5173` in **Chrome** (required for mic/voice).

1. **Onboarding** — Pick a curriculum (CBSE / Knowledge Hub), grade, and subjects. Click through to the dashboard.
2. **Pulse Mode (voice)** — Click the Pulse button or say *"Hey LearnHub"*. Ask the agent to teach any topic (e.g. "Explain photosynthesis"). Watch the waveform + visual canvas.
3. **Lesson viewer** — Open any subject → chapter → microsection. Switch between **Article**, **Quiz**, **Story**, and **Braille** tabs.
4. **Braille overlay** — On a math-heavy lesson, click the Braille tab to see Nemeth Code output.
5. **Story Mode** — Click the Story tab to see Gemini-generated narrative + images.
6. **Admin roadmap** — Navigate to `/admin/roadmap`. Describe a student in one sentence and watch the roadmap generate.
7. **Telegram nudge** *(optional, requires bot token)* — `curl -X POST http://localhost:8000/api/telegram/nudge` to trigger a proactive message.

> **Tip:** Voice features require **HTTPS** or **localhost** and a working microphone. Use Chrome for best compatibility with the Web Speech API and `getUserMedia`.

---

## 🧪 Demo Flow (How to Show It Off)

1. **Setup / Onboarding**
   - Choose board (CBSE / ICSE / IB) or **Knowledge Hub**
   - Pick grade + subjects → land on student dashboard

2. **Pulse Mode (centre‑piece)**
   - Say: “**Hey LearnHub — let’s start learning**”
   - Gemini Live wakes, greets the student, and resumes where they left off
   - Ask: “**Explain the water cycle**” → waveform animates, diagram appears on canvas

3. **Micro‑lessons & Formats**
   - Open a topic → show Article, Quiz, Story, Braille tabs
   - Demonstrate Braille overlay on a LaTeX math equation
   - Switch to Story Mode with visuals

4. **Admin / Roadmap**
   - As a teacher, describe a student in one sentence
   - Watch Gemini generate profile + roadmap and exportable plan

5. **Telegram Re‑engagement**
   - Show a Telegram message that links straight back into the right lesson

The detailed spoken walkthrough lives in `DEMO_SCRIPT.md`.

---

## 📜 License

MIT – see `LICENSE`.

> **Every student deserves a tutor that adapts to them. LearnHub is our first step toward that future.**
