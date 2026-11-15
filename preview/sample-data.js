// Sample content for the offline preview (Claude Artifact). Not used by the live site.
export function seed(M) {
  const { db, files } = M;
  const uid = () => crypto.randomUUID();
  const now = new Date().toISOString();
  const art = (a, b, c, w = 600, h = 800) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="r" cx=".5" cy=".38" r=".5"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#r)"/><path d="M0 ${h * .78} Q ${w * .3} ${h * .66} ${w * .55} ${h * .74} T ${w} ${h * .7} V ${h} H 0Z" fill="#000" opacity=".45"/></svg>`);
  const file = (path, url) => { files.set(path, url); return path; };
  const note = '<blockquote>Sample entry for the preview — open the Developer dashboard to edit or delete it. Changes reset when you reload.</blockquote>';
  const story = n => `<h2>Overview</h2><p>${n} is sample content. Stories support headings, lists, links and images with no length limit.</p><ul><li>Edit it in the Developer dashboard.</li><li>Preview, save drafts, publish and unpublish.</li></ul>${note}`;
  const rel = label => db.group_relationship_types.find(t => t.label_en === label).id;

  const C1 = uid(), C2 = uid(), C3 = uid();
  db.characters.push(
    { id: C1, name: 'The Foundation', story: story('The Foundation'), status: 'unknown', team_id: null, is_published: true, published_at: now, updated_at: now },
    { id: C2, name: 'Jonesy', story: story('Jonesy'), status: 'alive', team_id: null, is_published: true, published_at: now, updated_at: now },
    { id: C3, name: 'Unreleased Character', story: '', status: 'unknown', team_id: null, is_published: false, updated_at: now },
  );
  db.character_images.push(
    { id: uid(), character_id: C1, storage_path: file('characters/s1.svg', art('#1b2433', '#0b0d12', '#c9a25c')), image_name: 'Portrait', image_story: '<p>Sample image story.</p>', is_primary: true, sort_order: 0 },
    { id: uid(), character_id: C2, storage_path: file('characters/s2.svg', art('#23301f', '#0b0d12', '#8fb58f')), image_name: 'Portrait', image_story: '<p>Sample image story.</p>', is_primary: true, sort_order: 0 },
  );
  const G1 = uid(), G2 = uid();
  db.groups.push(
    { id: G1, name: 'The Seven', status: 'Active', logo_path: file('groups/g1.svg', art('#2a2016', '#0b0d12', '#c9a25c', 600, 600)), description: '<p>A sample faction profile.</p>', story: story('The Seven'), history: '<p>Background and history go here.</p>', goals: '<p>Goals and objectives go here.</p>', is_published: true, published_at: now, updated_at: now },
    { id: G2, name: 'The Imagined Order', status: 'Unknown', logo_path: null, description: '<p>Another sample faction.</p>', story: '', history: '', goals: '', is_published: true, published_at: now, updated_at: now },
  );
  db.group_relationships.push(
    { id: uid(), group_id: G1, character_id: C1, relationship_type_id: rel('Leader'), note: 'Sample note', sort_order: 0 },
    { id: uid(), group_id: G1, character_id: C2, relationship_type_id: rel('Ally'), note: '', sort_order: 1 },
    { id: uid(), group_id: G2, character_id: C2, relationship_type_id: rel('Enemy'), note: '', sort_order: 0 },
  );
  const S1 = uid(), S2 = uid();
  db.seasons.push(
    { id: S1, name: 'Sample Season A', chapter_number: 1, season_number: 1, cover_path: file('seasons/s1.svg', art('#16222e', '#08090c', '#6f9cc9', 1600, 900)), release_date: null, end_date: null,
      summary: '<p>A short introduction to the season. This is sample text.</p>', story: story('This season'), discoveries: '<ul><li>Sample discovery</li></ul>', missions: '<ol><li>Sample mission</li></ol>', is_published: true, published_at: now, updated_at: now },
    { id: S2, name: 'Sample Season B', chapter_number: 2, season_number: 1, cover_path: file('seasons/s2.svg', art('#2a2016', '#08090c', '#d98b4a', 1600, 900)), release_date: null, end_date: null,
      summary: '<p>Another sample season.</p>', story: '', discoveries: '', missions: '', is_published: true, published_at: now, updated_at: now },
  );
  const E1 = uid(), E2 = uid();
  db.season_events.push(
    { id: E1, season_id: S1, title: 'Opening event', image_path: file('events/e1.svg', art('#1f1a2b', '#08090c', '#c9a25c', 1200, 700)), body: '<p>What happened first. Sample text.</p>', event_date: null, position: 0 },
    { id: E2, season_id: S1, title: 'Live event finale', image_path: null, body: '<p>How the season ended. Sample text.</p>', event_date: null, position: 1 },
  );
  db.event_characters.push({ event_id: E1, character_id: C1 }, { event_id: E2, character_id: C2 });
  db.event_groups.push({ event_id: E2, group_id: G1 });
  db.season_characters.push({ season_id: S1, character_id: C1, note: 'Key figure this season', sort_order: 0 }, { season_id: S1, character_id: C2, note: '', sort_order: 1 });
  db.season_groups.push({ season_id: S1, group_id: G1, note: '', sort_order: 0 });
  db.season_references.push({ id: uid(), season_id: S1, title: 'Sample reference', url: 'https://example.com', note: 'Replace with a real source', sort_order: 0 });
  const A1 = uid();
  db.image_archive.push(
    { id: A1, storage_path: file('archive/a1.svg', art('#2a2016', '#08090c', '#d98b4a', 1600, 900)), image_name: 'Sample archive image', story: '<p>Every image has a full story and optional links.</p>', character_id: C1, season_id: S1, event_name: null, chapter: 'Chapter 1', is_published: true, published_at: now, uploaded_at: now },
  );
  db.event_images.push({ event_id: E2, image_id: A1 });
  db.mysteries.push({ id: uid(), title: 'A sample unanswered question', body: '<p>Theories and clues go here.</p>', status: 'open', season_id: S1, is_published: true, published_at: now, updated_at: now });
  // The preview visitor is an admin, so after entering the demo code
  // (PREVIEW) every dashboard section, including Access, can be tried.
  M.user.email = 'you@preview';
  db.lore_user_roles.splice(0, db.lore_user_roles.length, { user_id: M.user.id, role: 'admin', email: 'you@preview' });
}
