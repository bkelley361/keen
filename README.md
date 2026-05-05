# WatchTower

A web monitoring app that tracks changes on web pages and YouTube channels, notifying you via email when something changes.

## Features

- **Web Page Monitoring** — Track any element on a page using a CSS selector. Supports JavaScript-rendered pages via headless Chrome, iframes, and Shadow DOM.
- **YouTube Channel Monitoring** — Detects new videos, shorts, and community posts.
- **Click Before Extract** — Optionally click a tab/button before reading the value (for pages that require interaction).
- **Email Notifications** — Sends an email when a monitored value changes.
- **Change History** — View a log of all detected changes per monitor.
- **Status Indicators** — Green/amber/red dots show last check status at a glance.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** InstantDB (real-time sync)
- **Auth:** InstantDB Auth
- **Scraping:** Cheerio (static HTML) + Puppeteer (JS-rendered pages)
- **Email:** Nodemailer (Gmail)
- **UI:** Tailwind CSS, shadcn/ui (Base UI), Sonner toasts
- **Deployment:** Vercel (with `@sparticuz/chromium` for serverless Puppeteer)

## Getting Started

### Prerequisites

- Node.js 18+
- Google Chrome (for local Puppeteer)
- An [InstantDB](https://instantdb.com) app
- A Gmail account with an App Password

### Install

```bash
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_INSTANT_APP_ID=your_instant_app_id
INSTANT_ADMIN_TOKEN=your_instant_admin_token
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password
CRON_SECRET=a_random_secret_string
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Cron Setup

The app exposes a cron endpoint at `/api/cron/check` that checks all active monitors. It requires a secret for authorization.

**Using [cron-job.org](https://cron-job.org) (free):**

1. Create an account on cron-job.org
2. Add a new job:
   - **URL:** `https://your-domain.vercel.app/api/cron/check?secret=YOUR_CRON_SECRET`
   - **Method:** GET
   - **Schedule:** Every 15 minutes (or your preference)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── cron/check/route.ts    # Cron endpoint - checks all monitors
│   │   └── monitors/check/route.ts # Manual check endpoint - single monitor
│   ├── login/page.tsx              # Login page
│   ├── monitors/
│   │   ├── new/page.tsx            # Create monitor form
│   │   └── edit/page.tsx           # Edit monitor form
│   └── page.tsx                    # Dashboard
├── components/                     # UI components
├── lib/
│   ├── email.ts                    # Email notifications via Nodemailer
│   ├── instant.ts                  # InstantDB client
│   ├── instant-admin.ts            # InstantDB admin client
│   └── scraper.ts                  # Web scraping (fetch + Puppeteer)
```

## How the Scraper Works

1. **Fetch first** — Tries a plain HTTP request with Cheerio for fast extraction
2. **Browser fallback** — If fetch fails (JS-rendered, Cloudflare, empty result), launches headless Chrome
3. **Click action** — If a `clickSelector` is configured, clicks that element and waits for network idle
4. **Deep search** — If the selector isn't in the main document, searches iframes and Shadow DOM
5. **Screenshot on failure** — Saves a debug screenshot only when the selector can't be found anywhere
