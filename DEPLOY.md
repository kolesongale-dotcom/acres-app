# Deploying Acres Painting CRM to the cloud (Railway)

This puts the app online so you can use it on your phone **without your PC on**, while
you keep editing the localhost copy. The cloud copy is your *stable* app; localhost is
your *sandbox*. When you've refined things, you "ship" an update (one push) and the
phone app updates — your cloud data is never wiped.

You do this **once**. After that, updating is a single step (see "Updating later").

---

## What you'll need (free to create)
1. A **GitHub** account — stores your code so Railway can deploy it (and gives you version history).
2. A **Railway** account — runs the app online (~$5/month after a small free trial).

---

## Part 1 — Put the code on GitHub (easiest with GitHub Desktop)

1. Install **GitHub Desktop**: https://desktop.github.com/ — sign in with your GitHub account.
2. In GitHub Desktop: **File → Add Local Repository**.
3. Browse to this folder:
   `...\Acres Painting Estimating Application via Claude\acres-app`
   (the repo is already initialized — it will recognize it).
4. Click **Publish repository**.
   - Name it e.g. `acres-app`.
   - **Keep "Keep this code private" CHECKED** (your pricing/customers should not be public).
   - Click **Publish**.

Your code is now on GitHub.

---

## Part 2 — Create the app on Railway

1. Go to https://railway.app and **Log in with GitHub**.
2. Click **New Project → Deploy from GitHub repo** → pick your `acres-app` repo.
   - Railway will start building. It may fail the FIRST time because the database
     settings aren't in place yet — that's expected. Do the next steps, then redeploy.

### 2a. Add a persistent disk (so your data survives)
1. Open your service → **Variables / Settings** area → find **Volumes** → **New Volume**.
2. Set the **Mount path** to exactly:
   ```
   /data
   ```
   This is where your database and uploaded photos/logos live permanently.

### 2b. Add environment variables
In the service's **Variables** tab, add these (click "New Variable" for each):

| Name | Value |
| --- | --- |
| `DATABASE_URL` | `file:/data/dev.db` |
| `UPLOAD_DIR` | `/data/uploads` |
| `APP_PASSWORD` | *a password you choose* (you'll type this on your phone) |
| `AUTH_SECRET` | *a long random string* (e.g. mash 40+ random characters) |

> Tip for `AUTH_SECRET`: any long random gibberish string. It's the secret that keeps
> your login session valid — you never type it, so make it long and don't reuse it.

### 2c. Confirm the start command
Railway should pick up `railway.json` automatically, which sets the start command to
`npm run start:prod` (this creates the database tables and starter data on first run).
If it didn't, set **Custom Start Command** = `npm run start:prod`.

### 2d. Deploy + get your link
1. Click **Deploy** (or **Redeploy**).
2. When it's live, go to **Settings → Networking → Generate Domain**.
3. You'll get a URL like `https://acres-app-production.up.railway.app`. **This is your app.**

---

## Part 3 — First-time setup in the live app
1. Open the URL → you'll see the **login** screen → enter your `APP_PASSWORD`.
2. Go to **Settings → Company Profile** → fill it in and **upload your logo**.
3. Go to **Settings → Business Settings → Public Base URL** and paste your Railway URL
   (e.g. `https://acres-app-production.up.railway.app`). This makes the client e-sign
   links in proposals point at the live site.
4. Add the same URL to **Settings → Zoho Mail** flow as needed (the sign link uses Public Base URL).

### Put it on your phone (install as an app)
- **iPhone (Safari):** open the URL → Share button → **Add to Home Screen**.
- **Android (Chrome):** open the URL → menu (⋮) → **Add to Home screen / Install app**.

---

## Updating later (your "ship a new version" step)
1. Make and test your edits on localhost as usual.
2. In **GitHub Desktop**: type a short summary → **Commit to main** → **Push origin**.
3. Railway auto-deploys the new version in a couple of minutes. Your phone shows it on
   next refresh. **Your live data is preserved** (deploys run migrations, never resets).

> If you changed the database structure (`schema.prisma`), make sure you created a
> migration locally first: stop the dev server, then
> `cd acres-app && npx prisma migrate dev --name your_change`. Commit the new file in
> `prisma/migrations/`. Railway applies it automatically on deploy. (Never use
> `db:reset` against the cloud — that wipes data.)

---

## ⚠️ NEVER reset the production database
This is the one rule that can lose all of your business data, so it gets its own section.

- **`prisma migrate reset` (and the `npm run db:reset` shortcut) DROPS EVERY TABLE and
  recreates the database empty.** It is a local-development-only command. Never run it
  against the cloud / production database (`DATABASE_URL` pointing at `/data/dev.db`).
- **Production only ever runs `prisma migrate deploy`** (it's baked into `start:prod`). That
  applies any new migrations without touching existing data.
- **If a migration fails on deploy:** do NOT reset. Fix the migration file in
  `prisma/migrations/<name>/migration.sql` (or create a corrective migration locally with
  `prisma migrate dev`), commit, and redeploy. Resetting to "make the error go away" deletes
  everything.
- **Before any risky database operation**, take a backup first: **Settings → Data Backup →
  Export All Data** (full JSON copy). It only takes a second.

---

## Backups (do this occasionally — it's your business data)
Your cloud data is the single SQLite file `/data/dev.db` plus the `/data/uploads` folder.
- **Best / easiest backup:** in the app, **Settings → Data Backup → Export All Data**. This
  downloads a complete copy of every table as one JSON file (`acres-backup-<date>.json`). To
  restore, use **Import from Backup** on the same screen — it puts every record back with its
  original ID. Do this before any deploy that changes the database.
- Excel export (**Settings → Data Export**) is for accounting/printing, not restore.
- For a raw database copy, use the Railway dashboard's volume/CLI tools to download
  `/data/dev.db`. (Ask Claude to walk you through the Railway CLI when you want this.)

---

## Notes / gotchas
- **Local vs cloud are separate databases.** Data you enter on the phone (cloud) does
  NOT appear on localhost, and vice-versa. That's intentional (dev sandbox vs. real data).
- **Local stays login-free.** The password gate only turns on when `APP_PASSWORD` is set,
  which it is only in the cloud.
- **First deploy is the fiddly one.** After that, updates are just commit + push.
