# Skein

Skein is a visual workflow canvas for freelancers and solo operators. Drag a
trigger onto the canvas, connect it to an AI response node, wire in another
saved workflow if you need to chain steps, and drop the result wherever you
need it — no code, no team settings, no enterprise bloat. It's built for the
person running client intake, replies, and follow-up alone.

## Try it live

**[skein-canvas.vercel.app](https://skein-canvas.vercel.app)**

Two seeded demo accounts are ready to explore, each with two pre-built,
connected workflows already saved:

| Persona | Email | Password |
| --- | --- | --- |
| Wedding & event photographer | `demo.photographer@skein.app` | `SkeinDemo-Photo!26` |
| Freelance brand consultant | `demo.consultant@skein.app` | `SkeinDemo-Brand!26` |

Or hit **Try the demo** on the homepage for a no-signup canvas with a
simulated AI reply, or sign up for your own free workspace.

## Features

- **Visual canvas** — drag-and-drop nodes and threaded edges (built on React
  Flow), with a live dash-travel animation on edges feeding a node that's
  currently executing.
- **Node types** — Trigger, AI Response, Run Workflow (calls another saved
  workflow as a sub-step), and Output.
- **Templates** — start from a library of ready-made pipelines (client
  inquiry reply, proposal follow-up, scope-creep response) instead of a blank
  canvas.
- **Workflow composition** — a Run Workflow node can call another saved
  workflow, passing its output through as input. Cycle detection (direct and
  indirect self-reference) is enforced server-side, not just in the UI.
- **Public intake forms** — every saved workflow gets a shareable, no-login
  URL (`/f/{workflow-id}`) that runs the full pipeline server-side from a
  single text field and shows the visitor a plain confirmation — never the
  AI output or any of your other data. Rate limited per IP, separately from
  the authenticated usage limit.
- **Email + Slack delivery** — the Output node can send its result to an
  email address (via Resend) or post it to a Slack channel (via an Incoming
  Webhook you paste in once), on every run from the canvas or a public form.
- **Per-account isolation** — every workflow, and every email/Slack setting
  on it, is scoped to its owner via Postgres row-level security.

## Tech stack

React 19 · TanStack Start · Tailwind CSS 4 · React Flow (`@xyflow/react`) ·
Supabase (Postgres, Auth, RLS) · Gemini API · Resend

## Run locally

**Requirements:** Node 20+, a Supabase project, a Gemini API key.

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the values:

   ```bash
   cp .env.example .env
   ```

   - `SUPABASE_URL` / `VITE_SUPABASE_URL` — your Supabase project URL.
   - `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` — the
     project's anon/publishable key (Settings → API in the Supabase
     dashboard).
   - `SUPABASE_SERVICE_ROLE_KEY` — the service role key. Server-only; never
     exposed to the browser.
   - `GEMINI_API_KEY` — a Gemini API key from
     [Google AI Studio](https://aistudio.google.com/apikey). Server-only.
   - `RESEND_API_KEY` — optional, a [Resend](https://resend.com/api-keys) API
     key. Only needed for the Output node's "Send as email" action; without
     it, everything else still works and email sends just fail with a clear
     error.

3. Apply the database schema (creates `profiles`, `workflows`, and
   `rate_limits`, with RLS enabled on every table):

   ```bash
   npx supabase db push --db-url "postgresql://postgres:<db-password>@db.<project-ref>.supabase.co:5432/postgres"
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   The app runs at `http://localhost:8080`.
