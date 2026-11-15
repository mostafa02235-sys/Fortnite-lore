# Fortnite Lore

A fan archive of Fortnite characters, teams/factions and lore images, in **English (LTR)** and **Arabic (RTL)**.

- **Character Archive** – a profile page for every character: name, full story (rich text, no length limit), status (Alive / Dead / Unknown), team, and any number of images, each with its own name and story.
- **Teams & Factions** – created by developers; nothing is hard-coded.
- **Image Archive** – lore images with a full story, an optional related character, event and chapter, publish status and upload date, shown on a cinematic detail page.
- **Developer dashboard** – add, edit, preview, save as draft, publish, unpublish and delete characters, teams and images. Admins can grant and revoke developer access.

Signed-in members can read published content. Only verified developers can change it.

## How it works

| Part | Where |
|---|---|
| Website | Static files (`index.html`, `css/`, `js/`). No build step is needed. |
| Database | Supabase Postgres (`supabase/migrations/`) |
| Image files | Supabase Storage, private bucket `lore-media` |
| Android app | Capacitor, built by GitHub Actions (`.github/workflows/android.yml`) |

### Security model

- Roles are stored in `public.lore_user_roles`. That table has **no insert, update or delete policies**, so nobody can give themselves a role from the browser. Roles change only through the admin-only database functions `lore_grant_role` and `lore_revoke_role`, or through SQL you run in the Supabase dashboard.
- Row Level Security on `teams`, `characters`, `character_images` and `image_archive`:
  - **Read:** signed-in users can read published records; developers can read everything.
  - **Write:** only `lore_is_developer()`, which checks the database, never the browser.
- Storage policies follow the same rules. A file can be read only if the record that uses it is published, or if the reader is a developer.
- Story HTML is cleaned against an allow-list when it is saved **and** again when it is shown.

## Database tables

- `teams` (id, name unique, description)
- `characters` (id, name, story, status enum, team_id → teams **on delete set null**, is_published, published_at)
- `character_images` (character_id → characters **on delete cascade**, storage_path, image_name, image_story, is_primary, sort_order)
- `image_archive` (storage_path, image_name, story, character_id → characters **on delete set null**, event_name, chapter, is_published, published_at, uploaded_at)
- `lore_user_roles` (user_id → auth.users, role `developer` | `admin`)

Every table name that other apps on the same Supabase project might also use is prefixed with `lore_`. The migration only adds new objects; it does not change existing tables.

## First-time setup

1. **Make yourself admin.** Create an account on the site, then run this in the Supabase **SQL Editor**:
   ```sql
   insert into public.lore_user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'YOUR-EMAIL@example.com'
   on conflict do nothing;
   ```
   After that you can grant developer access to other people from **Developer → Access**.
2. **Auth redirect URLs.** In Supabase go to **Authentication → URL Configuration**. Set **Site URL** to your website address, and add it under **Redirect URLs**. Without this, confirmation and password-reset emails link to the wrong place.
3. **Website hosting.** Choose one:
   - GitHub Pages: in **Settings → Pages**, set **Source** to **GitHub Actions**. The `pages.yml` workflow deploys on every push to `main`. A private repo needs a paid GitHub plan for Pages.
   - Netlify / Vercel / any static host: publish the repository root. There is no build command.
4. **Android APK.** Every push to `main` runs **Actions → Android APK**. Download `fortnite-lore-apk` from the run's artifacts.

## Run locally

Serve the folder with any static server (ES modules don't load from `file://`):

```bash
npx serve .
```

## Applying the migration to another Supabase project

Paste `supabase/migrations/20261115120000_lore_archive.sql` into the SQL Editor, or run `supabase db push`. The migration is idempotent: running it twice does no harm. Then update `js/config.js` with that project's URL and publishable key.

---
Fan-made project. Fortnite is a trademark of Epic Games; this site is not affiliated with or endorsed by Epic Games.
