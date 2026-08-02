# LHMAC — Laurel Highlands Model Airplane Club Website

Next.js site skeleton with Firebase backend. This is the project scaffold — all pages are
stubbed with placeholder content and layout. Real data will come from Firestore, Firebase
Auth, and Firebase Storage as features are built out.

## Prerequisites

- Node.js 18+ (https://nodejs.org/)
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project (create one at https://console.firebase.google.com/)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run locally
npm run dev
# → Open http://localhost:3000

# 3. Build for production
npm run build

# 4. Start the production server
npm start
# → Open http://localhost:3000
```

## Ubuntu Server Deployment

This project now runs as a Node/Next server with API routes, so it should be deployed as a production Next.js app rather than a static export.

> **Do not deploy this as a static export.** Events and photos live in SQLite behind `/api/events`
> and `/api/photos`, which a static export cannot serve. A static build silently falls back to
> per-browser `localStorage` and shifts event dates by a day (`new Date("2026-08-15")` parses as UTC
> midnight = Aug 14 in Eastern time). The old Firebase Hosting config has been retired to
> `firebase.json.unused` / `.firebaserc.unused` for this reason; the stale export left in
> `/var/www/lhmac` is dead and is no longer served.

### Redeploying after a code change

```bash
cd ~/lhmac-site
npm run deploy    # next build + systemctl restart lhmac-site
```

```bash
# 1. Install dependencies on the server
npm install

# 2. Create the photo database directory
sudo mkdir -p /var/www/lhmac-photos
sudo chown -R $(whoami):$(whoami) /var/www/lhmac-photos

# 3. Build the app
npm run build

# 4. Start the app in production
NODE_ENV=production PHOTO_DB_PATH=/var/www/lhmac-photos/photos.db npm start
```

### Optional: run as a systemd service

Create `/etc/systemd/system/lhmac-site.service` with:

```ini
[Unit]
Description=LHMAC Next.js app
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/youruser/lhmac-site
Environment=NODE_ENV=production
Environment=PHOTO_DB_PATH=/var/www/lhmac-photos/photos.db
ExecStart=/usr/bin/npm start
Restart=on-failure
User=youruser
Group=www-data

[Install]
WantedBy=multi-user.target
```

Then enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable lhmac-site
sudo systemctl start lhmac-site
```

### Reverse proxy with Nginx

If you want Nginx in front of the app, proxy to `http://127.0.0.1:3000`.

Example Nginx site config:

```nginx
server {
  listen 80;
  server_name your-domain.example;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

## Accounts & Permissions

- Passwords are hashed with scrypt (`src/lib/password.js`). Accounts created before hashing
  existed are upgraded automatically the next time they sign in successfully.
- Sessions are server-side rows in the `sessions` table, keyed by an httpOnly `lhmac_session`
  cookie. Nothing about auth lives in `localStorage`.
- An account with `needsPasswordReset` set is **not** treated as signed in. Login issues it a
  session only so `/reset-password/` knows whose password to change; every other API returns 401
  until the reset is completed.
- API authorization lives in `src/lib/apiAuth.js` (`requireUser` / `requireAdmin`). Route summary:
  - **Public**: `GET /api/events`, `GET /api/classifieds`, `GET /api/field-status`,
    `GET /api/photos/recent`, `GET /api/forecast`, `POST /api/contact`, `POST /api/membership/submit`
  - **Signed-in member**: event create/edit/delete (own only), classifieds post/delete (own only),
    photo upload
  - **Admin only**: `/api/members`, `/api/photos/queue`, `/api/photos/approve`,
    `/api/membership/requests`, `GET|PATCH|DELETE /api/contact`, `POST /api/field-status`
- Approved applicants get a generated username and the temporary password `welcome`, which they
  must change on first sign-in.

## Live Data

- **Weather** — `GET /api/forecast` calls the National Weather Service (grid `PBZ 97,58`, the
  Mammoth Park field) and caches for 15 minutes. No API key required. Flyability thresholds are in
  `flyStatus()` in `src/app/api/forecast/route.js`.
- **Field status** — admins set open / closed / maintenance from the dashboard; the homepage banner
  re-checks every 60 seconds.
- **Scheduled closures (NOTAM-style)** — admins schedule a closed/maintenance window ahead of time.
  A running window overrides the manual toggle and the field reverts on its own when it ends; if
  windows overlap, the one ending last wins. Upcoming windows are listed publicly on the homepage
  banner. Start/end are stored as **UTC instants**; `src/lib/datetimeLocal.js` converts to and from
  the browser's local time so a 10:00 AM closure reads as 10:00 AM regardless of server timezone
  (the server runs UTC).
- **Club officers** — assign an officer title on the member roster; the About page lists officers in
  board order (President first, not alphabetical) with name and email only.
- **Newsletters** — admins upload PDF issues (25 MB max) from the dashboard; they appear on the
  Media page immediately, newest first, with the most recent highlighted. Uploads are validated by
  the file's `%PDF-` header rather than the client-supplied MIME type. `issueDate` is a plain
  `YYYY-MM-DD` string parsed with `parseDateString`, so the month label never shifts.
- **Instructors** — flag a member as an instructor with a short public blurb; they become selectable
  on the Membership page's lesson request form. The public endpoint exposes name and blurb only.
- **Contact form** — submissions land in the `contact_messages` table and appear in the admin Inbox.

## Site Configuration

- **Homepage header image** — admins upload one from the dashboard; it renders above "Come, Fly with
  Us!". Until one is set, the homepage falls back to the plane icon. Slots are declared in
  `SITE_IMAGE_SLOTS` (`src/lib/clubConstants.js`); add a slot there to make another image
  admin-configurable.
- **Field maps** — `src/components/FieldMap.js` embeds OpenStreetMap with a pin. No API key, no
  billing account, no third-party script. "Get Directions" hands off to Apple Maps on iOS/macOS and
  Google Maps elsewhere, both of which open the native app on a phone when installed.
- **Field coordinates** live in `FLYING_SITES` (`src/lib/clubConstants.js`). Mammoth Park is the
  verified location already used across the site. **Acme Dam is an unverified approximation** and is
  flagged `verified: false` — confirm it before members rely on it for navigation.
- **Classifieds expire after 90 days.** This is enforced at read time in `getClassifieds()`, not just
  claimed in the banner, so the page cannot promise something untrue. `purgeExpiredClassifieds()`
  physically deletes expired rows to reclaim photo storage. The lifetime is
  `CLASSIFIED_LIFETIME_DAYS`.

## Photo Storage Behavior

- Uploaded photos are saved in a SQLite database file defined by `PHOTO_DB_PATH`.
- In production, the default path is `/var/www/lhmac-photos/photos.db`.
- This keeps photo records and image content persistent across app rebuilds and startup restarts.

## Project Structure

## Project Structure

```
src/
├── app/
│   ├── layout.js          Root layout (nav + footer)
│   ├── page.js            Home page (hero, fly forecast, photos, events)
│   ├── globals.css         Tailwind + custom styles
│   ├── about/page.js       Club info, officers, history
│   ├── fields/page.js      Mammoth Park + Acme Dam field pages
│   ├── membership/page.js  How to join, dues, FAA/TRUST info
│   ├── events/page.js      Calendar and event listings
│   ├── media/page.js       Photo gallery + newsletters + videos
│   ├── classifieds/page.js Buy/sell/trade listings
│   ├── links/page.js       External resources
│   ├── contact/page.js     Contact form + club info
│   └── admin/page.js       Admin dashboard (photo queue, email, members)
├── components/
│   ├── Navigation.js       Responsive nav with mobile menu
│   ├── Footer.js           Site footer
│   ├── FlyDayForecast.js   5-day flyability weather forecast
│   ├── PhotoStrip.js       Rolling photo carousel
│   ├── FieldStatus.js      Live field open/closed indicator
│   └── PageShell.js        Page wrapper for consistent layout
└── lib/
    └── firebase.js         Firebase SDK initialization (fill in your config)
```

## Firebase Setup

1. Go to https://console.firebase.google.com/
2. Create a new project (e.g., "lhmac-site")
3. Enable these services:
   - **Authentication** → Email/Password sign-in method
   - **Firestore Database** → Start in test mode for now
   - **Storage** → For photo uploads
   - **Hosting** → This is where the site gets deployed
4. Register a Web App in Project Settings and copy the config into `src/lib/firebase.js`
5. Copy the Project ID into `.firebaserc`

## Tech Stack

- **Next.js 14** — React framework with App Router
- **Tailwind CSS 3** — Utility-first styling
- **Firebase** — Auth, Firestore, Storage, Hosting
- **Lucide React** — Icon library

## Color Palette

| Name           | Hex       | Usage                          |
|----------------|-----------|--------------------------------|
| Field Green    | `#2D5A27` | Primary brand, buttons, links  |
| Dark Green     | `#1A3D17` | Nav bar, footer, hover states  |
| Sky Blue       | `#4A8FCA` | Secondary accent               |
| Fly Day Go     | `#2E7D32` | Green flyability indicator     |
| Fly Day Maybe  | `#E8890C` | Yellow/amber marginal          |
| Fly Day No-Go  | `#C62828` | Red no-fly indicator           |
| Surface Warm   | `#FAF9F6` | Page background                |
| Ink            | `#1A1A2E` | Body text                      |

## What's Next

This skeleton has placeholder data throughout. The build-out order:
1. Firebase Auth — protect admin page, member login
2. NWS Weather API — live fly day forecast
3. Photo system — Firebase Storage + Firestore approval queue
4. Events — Firestore CRUD + iCal feed
5. Email integration — SendGrid/Mailgun setup
6. Member management — Firestore member collection
7. Mobile apps — React Native companion app
