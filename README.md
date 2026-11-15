# Fortnite Lore

A fan encyclopedia of the Fortnite story, in **English (LTR)** and **Arabic (RTL)**: characters, groups and factions, seasons with timelines, an image archive and mysteries.

## Sections

| Section | What it holds |
|---|---|
| **Story Archive** | The whole saga in reading order: every season's summary, chapter by chapter |
| **Chapters** | Seasons grouped by chapter number |
| **Seasons** | One page per season: cinematic cover, chapter and season numbers, release and end dates, summary, full story, ordered timeline, characters, groups, discoveries, story missions, mysteries, images and references |
| **Characters** | Profiles with full story, status, images, groups (with relationship labels) and season and event appearances |
| **Groups & Factions** | One page per group: logo, description, full story, background and history, goals, status, members grouped by relationship, related seasons and events, extra images |
| **Image Archive** | Lore images with a full story, related character, season, events and chapter |
| **Timeline** | Every event from every season in chronological order |
| **Mysteries** | Open, partly answered and solved questions, optionally linked to a season |
| **Search** | Searches characters, groups, seasons, events, images and mysteries |
| **Profile** | Account, role, language, password, sign out |

All long-form fields use the built-in rich-text editor: headings, bold and italic, lists, quotes, links, images and right-to-left or left-to-right paragraphs. None of them has a length limit.

### Developer Mode

Content management is behind a **developer access code**:

1. A signed-in user opens **Developer Mode** (in the sidebar or on the Profile page) and enters the code.
2. The database function `lore_enter_dev_mode` compares the code with a **bcrypt hash** kept in the private schema `lore_private`. The API doesn't expose that schema. The code itself is never in this repo, the website, or the browser.
3. If the code is right, the account gets a **Developer Mode session that lasts 8 hours** (`lore_dev_sessions`). It is never a permanent role. The session ends when the user clicks **Exit Developer Mode**, signs out, or the 8 hours run out. An admin can also end it.
4. Wrong codes show a clear error. After **5 wrong attempts in 15 minutes**, the account is locked out for the rest of that window.
5. Every write is checked by Row Level Security through `lore_is_developer()`, which is true only while the session is active. Normal accounts can only read published content.

**Set or change the access code.** Run this in the Supabase SQL Editor, replacing the placeholder with the new code:

```sql
insert into lore_private.settings (key, value)
values ('dev_code_hash', extensions.crypt('YOUR-NEW-CODE', extensions.gen_salt('bf', 10)))
on conflict (key) do update set value = excluded.value, updated_at = now();
```

To end every active session after changing the code, run `delete from public.lore_dev_sessions;`.

### Developer dashboard (`#dev`)

The dashboard has these sections: Overview (stats, waiting drafts, recent changes, quick create), Characters, Groups, Seasons, Timeline, Stories (every long-form story with its word count), Image Archive, Mysteries, Publishing (publish or unpublish anything in one place), Relationship labels, and Access (admins only: active Developer Mode sessions and admin roles).

Every item can be created, edited, previewed, saved as a draft, published, unpublished and deleted.

- **Groups:** upload a logo and extra images, write the description, story, history and goals, manage members, and link seasons and events.
- **Members** are many-to-many. One character can be in several groups and can hold several labels in the same group, for example *Former Member* and *Enemy*.
- **Relationship labels** start with Member, Leader, Former Member, Enemy, Ally and Unknown. Each label has an English and an Arabic name, and you can add, rename, reorder or delete labels. A label that is still in use can't be deleted.
- **Seasons:** set the cover, dates and numbers, write the summary, story, discoveries and missions, link characters and groups (each with a note), add images and references, and manage the timeline.
- **Timeline events** each have a name, image, full explanation, date, related characters, groups and archive images. To reorder events, drag them or use ↑ and ↓. The new order is saved immediately; events are never recreated.

## Architecture

| Part | Where |
|---|---|
| Website | Static ES modules: `index.html`, `css/`, `js/`. There is no build step. |
| Database | Supabase Postgres (`supabase/migrations/`) |
| Image files | Supabase Storage, private bucket `lore-media`, served with signed URLs |
| Android app | Capacitor, built by GitHub Actions (`.github/workflows/android.yml`) |
| Website deploy | GitHub Pages (`.github/workflows/pages.yml`) or any static host |
| Original Claude Artifact | `preview/`: the same app code running on an in-memory database with sample data. Its Developer Mode uses the demo code `PREVIEW` and is not connected to the real database. |

### Database

Migrations, applied in order:

1. `20261115120000_lore_archive.sql`: roles, teams, characters, character images, image archive, storage bucket
2. `20261115140000_groups_seasons.sql` adds:
   - `groups`, `group_images`
   - `group_relationships`: group ↔ character, many-to-many with a label
   - `group_relationship_types`: the configurable labels
   - `seasons`, `season_events` (ordered by `position`), `season_characters`, `season_groups`, `season_images`, `season_references`
   - `event_characters`, `event_groups`, `event_images`
   - `mysteries`
   - `image_archive.season_id`

3. `20261115160000_developer_mode.sql`: server-side Developer Mode (hashed access code, rate limiting, 8-hour sessions). `lore_is_developer()` now means "has an active Developer Mode session".

All migrations only add things, and running them twice does no harm. The older `teams` table and `characters.team_id` are kept so no data is lost. Migration 2 copies their contents into `groups` and `group_relationships` with the same ids, so old `#team/…` links redirect to the group page.

### Security

- Developer access is a time-limited server-side session opened with the access code (see **Developer Mode**). Nothing in the browser can create a session.
- Admin roles live in `lore_user_roles`, which has no write policies. Admin tools also require an active Developer Mode session.
- Every content table has Row Level Security:
  - **Read:** signed-in users see published records. A link between two records is visible only when both ends are published.
  - **Write:** only `lore_is_developer()` passes. The browser's role check only hides buttons; the database is what enforces access.
- Storage reads follow the same rules: a file is readable only when the record that uses it is published.
- Story HTML is cleaned against an allow-list when it is saved and again when it is shown.

## Setup

1. **Developer Mode** works once migration `20261115160000_developer_mode.sql` is applied and the access code hash is stored (see **Developer Mode**).
2. **Optional: make yourself admin**, so you can see and end other people's Developer Mode sessions. Sign up on the site, then run:
   ```sql
   insert into public.lore_user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'YOUR-EMAIL@example.com'
   on conflict do nothing;
   ```
3. **Auth URLs.** In Supabase, open **Authentication → URL Configuration**. Set the **Site URL** to your website address and add it to **Redirect URLs**.
4. **Hosting.** For GitHub Pages, go to **Settings → Pages → Source: GitHub Actions**. Otherwise, publish the repo root on Netlify or any static host; there is no build command.
5. **Android APK.** Every push to `main` builds one. Download it from **Actions → Android APK → Artifacts**.

## Development

```bash
npx serve .                       # live site (uses Supabase)
open http://localhost:3000/preview/   # offline preview with sample data
node scripts/build-preview.mjs    # builds dist-preview/ (what is published as the Claude Artifact)
```

UI tests run against the in-memory database, using Python Playwright and Chrome:

```bash
python3 tests/ui_test.py .        # characters, image archive, auth, access, XSS
python3 tests/lore_test.py        # groups, labels, seasons, timeline, mysteries, search, profile
```

---
Fan-made project. Fortnite is a trademark of Epic Games; this site is not affiliated with or endorsed by Epic Games.
