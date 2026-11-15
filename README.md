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

### Developer dashboard (`#dev`)

The dashboard has these sections: Overview, Characters, Groups, Seasons, Image Archive, Mysteries, Relationship labels, and Access (admins only).

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
| Original Claude Artifact | `preview/`: the same app code running on an in-memory database with sample data |

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

Both migrations only add things, and running them twice does no harm. The older `teams` table and `characters.team_id` are kept so no data is lost. Migration 2 copies their contents into `groups` and `group_relationships` with the same ids, so old `#team/…` links redirect to the group page.

### Security

- Roles live in `lore_user_roles`, which has no write policies. A user can't grant themselves a role. Only admins can change roles, through `lore_grant_role` and `lore_revoke_role`, which check permission in the database.
- Every content table has Row Level Security:
  - **Read:** signed-in users see published records. A link between two records is visible only when both ends are published.
  - **Write:** only `lore_is_developer()` passes. The browser's role check only hides buttons; the database is what enforces access.
- Storage reads follow the same rules: a file is readable only when the record that uses it is published.
- Story HTML is cleaned against an allow-list when it is saved and again when it is shown.

## Setup

1. **Make yourself admin.** Sign up on the site, then run this in the Supabase **SQL Editor**:
   ```sql
   insert into public.lore_user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'YOUR-EMAIL@example.com'
   on conflict do nothing;
   ```
   After that, you can add other developers from **Developer → Access**.
2. **Auth URLs.** In Supabase, open **Authentication → URL Configuration**. Set the **Site URL** to your website address and add it to **Redirect URLs**.
3. **Hosting.** For GitHub Pages, go to **Settings → Pages → Source: GitHub Actions**. Otherwise, publish the repo root on Netlify or any static host; there is no build command.
4. **Android APK.** Every push to `main` builds one. Download it from **Actions → Android APK → Artifacts**.

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
