# Project Farmer Keynote Day 2026-07-18 — Scoring System Spec

Source of truth for rebuilding the voting/scoring system. Derived from `index.html.bak` (original implementation), updated for 4-team + role assignment model.

**Deployment:** GitHub Pages at `vote.mjmnursery.com` (see `CNAME`).

---

## 1. Purpose

A live, multi-device voting app for the **Project Farmer Keynote Day 2026-07-18** event. Four teams compete for total points. After sign-in, each user claims exactly one assignment — either a team (Team 1–4) or a role (Mentor, Pain Point Marks). Scoring behavior depends on assignment type (see §3). A dashboard shows live standings and vote status. The entire UI uses the **Cartoon Game Leaderboard** theme (§7).

---

## 2. Assignment Options

Each logged-in user must claim **exactly one** of six mutually exclusive slots. Once claimed, the slot is locked to that user's email; no other user may select it.

### 2.1 Teams (4 options)

| ID | Name   | Emoji | Color   |
|----|--------|-------|---------|
| 1  | Team 1 | 🔥    | `#f59e0b` |
| 2  | Team 2 | ⚡    | `#10b981` |
| 3  | Team 3 | 🌊    | `#6366f1` |
| 4  | Team 4 | 🦁    | `#ef4444` |

Configurable constant `TEAMS` — 4 teams, each with `id`, `name`, `emoji`, `color`.

Team slots are for **team representatives** who cast one fixed-value vote for their chosen best team (§3.1).

### 2.2 Roles (2 options)

| ID               | Name              |
|------------------|-------------------|
| `mentor`         | Mentor            |
| `pain_point_marks` | Pain Point Marks |

Configurable constant `ROLES` — each with `id`, `name`.

Role slots allow **scoring all four teams** with role-specific limits (§3.2, §3.3).

### 2.3 Slot keys (unified identifier)

All six options share one locking namespace. Use stable slot keys in the DB and client:

| Slot key                  | Display name     | Type  |
|---------------------------|------------------|-------|
| `team:1`                  | Team 1           | team  |
| `team:2`                  | Team 2           | team  |
| `team:3`                  | Team 3           | team  |
| `team:4`                  | Team 4           | team  |
| `role:mentor`             | Mentor           | role  |
| `role:pain_point_marks`   | Pain Point Marks | role  |

**Total: 6 options — pick one, no duplicates across users.**

---

## 3. Scoring Rules

All points are **additive**: a team's total is the sum of every score row received from all voters. Each voter's contribution is stored as one or more rows in the `votes` table (see §5.2).

### 3.1 Team representative — single tap vote (fixed 1,000 marks)

Applies when the logged-in user holds a `team:N` slot (Team 1–4).

| Rule | Detail |
|------|--------|
| Votes allowed | **Exactly one active vote** per user, for **one** other team |
| Cannot vote for | Own team |
| Points awarded | **Fixed 1,000 marks** — no score entry, no variable amount |
| Interaction | **Tap-to-vote** — user taps the team card they consider best |
| Confirmation | After tap, a **confirmation dialog** asks whether to cast their vote to that team |
| On confirm | Insert vote row (`points = 1000`); UI locks other cards; show voted state |
| Undo | Tap **Undo Vote** → delete vote row; unlock all eligible cards; user may tap a different team and confirm again |
| Re-vote | After undo, user may vote for any eligible team (same confirm flow) |
| Lock | **Undo and re-vote disabled** while the **Winner announcement** overlay is displayed (§8.12) — synced to all clients via `event_state.winner_announced` |
| On cancel | Close dialog; no vote cast; user may tap a different team |

**Flow:**

```
Tap team card (not own team)
  → Confirmation dialog: "Cast your vote (1,000 marks) to [Team X]?"
  → Confirm → save vote, lock other cards, show voted state + Undo
  → Undo   → delete vote, unlock cards for a new choice
  → Cancel → return to team cards, no change
```

After voting, show which team received the vote. Other team cards are inactive until **Undo**. While the winner announcement is displayed, all cards and **Undo** are disabled.

### 3.2 Mentor — score all four teams (0–3,000 each)

Applies when the logged-in user holds the `role:mentor` slot.

| Rule | Detail |
|------|--------|
| Targets | All **4 teams** |
| Per-team range | **Minimum 0**, **maximum 3,000** marks each |
| Input | Numeric score entry per team (four inputs) |
| Submission | User enters a score for a chosen team and taps **Submit** on that row |
| After submit | Input **locks**; row button changes from **Submit** to **Undo** |
| Undo | Tap **Undo** → delete that team's vote row; unlock input; clear ✓ on Vote Status Board for that column; Mentor must re-enter and submit a new score |
| Lock | **Submit and Undo disabled** while the **Winner announcement** overlay is displayed (§8.12) — synced via `event_state.winner_announced` |
| Amend | **Not allowed in place** — Mentor must **Undo** first, then enter and submit again |

Mentor may assign 0 to any team (e.g. skip a team without scoring it).

### 3.3 Pain Point Marks — score all four teams (0+, no cap)

Applies when the logged-in user holds the `role:pain_point_marks` slot.

| Rule | Detail |
|------|--------|
| Targets | All **4 teams** |
| Per-team range | **Minimum 0**, **no maximum cap** |
| Input | Numeric score entry per team (four inputs) |
| Submission | User enters a score for a chosen team and taps **Submit** on that row |
| After submit | Input **locks**; row button changes from **Submit** to **Undo** |
| Undo | Tap **Undo** → delete that team's vote row; unlock input; clear score on Vote Status Board for that column; user must re-enter and submit a new score |
| Lock | **Submit and Undo disabled** while the **Winner announcement** overlay is displayed (§8.12) — synced via `event_state.winner_announced` |
| Amend | **Not allowed in place** — must **Undo** first, then enter and submit again |

User may assign 0 to any team (e.g. skip a team without scoring it).

| Assignment | Teams scored | Points per submission | Max submissions | Input style |
|------------|--------------|----------------------|-----------------|-------------|
| Team 1–4   | 1 (not self) | Fixed 1,000          | 1 active (undo to change) | Tap + confirm dialog + undo |
| Mentor     | All 4        | 0–3,000 each         | 1 per team (undo to change) | Numeric entry + lock/undo |
| Pain Point Marks | All 4  | 0+ (no cap)          | 1 per team (undo to change) | Numeric entry + lock/undo |

### 3.5 Total score formula

```
team_total[team_id] = sum(all vote rows where to_team_id = team_id)
```

No separate bonus layer — Mentor and Pain Point Marks scores are regular vote rows distinguished by `from_team` (role label).

### 3.6 Ranking & champion

- Teams ranked by `team_total`, descending (for medals, champion banner, and `#1` treatment).
- Live chart bar positions are **fixed left-to-right** as Team 1 → Team 4 (not re-sorted by score); medals 🥇🥈🥉4️⃣ on each bar reflect rank when score > 0.
- **Champion banner** displays when any team has points > 0 (top team by total).
- Fireworks launch only when the **leader changes** (not on every score update).
- Confetti burst and gold crown on #1 bar (§7.5, §10).

---

## 4. User Roles & Authentication

### 4.1 Sign-in

- **Email-only** auth (no OAuth). User enters a Gmail address to vote or score.
- Name derived from email local-part: split on `@`, replace `._+` with spaces, title-case words.
- Avatar: first letter of derived name.
- **Viewer button** on the auth screen (below Continue): no email required. Tapping it enters the app in read-only **Viewer** mode (§4.7).
- **Secret Interactive entry:** if the email field contains exactly `interactive` (case-insensitive, no `@` required) and the user taps **Continue**, skip assignment picker and enter **Interactive** mode (§4.6). Not shown in the UI; intended for event display / MC devices.

### 4.2 Assignment picker dialog (post-login)

Immediately after a successful sign-in (or when a returning user has no valid saved assignment), a **modal dialog** appears. The user must choose **exactly one** of the six assignment options before entering the main app.

**Layout — single dialog, two sections:**

```
┌─────────────────────────────────────┐
│  SELECT YOUR ASSIGNMENT             │
│                                     │
│  ── TEAM ──────────────────────     │
│  [ Team 1 ]  [ Team 2 ]             │
│  [ Team 3 ]  [ Team 4 ]             │
│                                     │
│  ── ROLE ──────────────────────     │
│  [ Mentor ]  [ Pain Point Marks ]   │
│                                     │
│  (Cancel — optional, closes modal)  │
└─────────────────────────────────────┘
```

**Rules:**

1. User selects **one** button across both sections (not one team + one role).
2. On claim success → close dialog, enter main app with that assignment.
3. On claim failure (race) → refresh dialog, show slot as taken, toast error.
4. **Locked slots:** disabled button; show 🔒 and the **claimer's email** displayed directly under the option label (in the dialog).
5. Available slots: enabled; no email shown until claimed.

**Returning users:**

- If email matches an active `sessions` row → auto-login with that slot; **do not** show the dialog.
- If saved local session slot is no longer valid (another email claimed it) → clear session, show dialog again.

**Logout** does **not** release the slot; the same email can return to the same assignment.

### 4.3 Team representative (team slot)

- Holds a `team:N` slot (Team 1–4).
- Voting UI: tap-to-vote cards for the **3 other teams** (§3.1).
- Own team card shown disabled ("your team").
- After one confirmed vote → other cards locked; **Undo Vote** clears the vote so user can pick again (§3.1).
- **Undo and re-vote disabled** while the Winner announcement overlay is displayed (§8.12).
- User bar shows team emoji + name.

### 4.4 Mentor (role slot)

- Holds `role:mentor`.
- **Mentor scoring panel** visible below the live standings chart (§8.6).
- User chooses a team from four labeled rows (Team 1–4), enters a numeric score (0–3,000), and submits **per team**.
- After submit, the row locks; **Undo** clears that team's score so it can be re-entered (§8.6).
- **Submit and Undo disabled** while the Winner announcement overlay is displayed (§8.12).
- User bar shows "Mentor" with 🎓 avatar.

### 4.5 Pain Point Marks (role slot)

- Holds `role:pain_point_marks`.
- **Pain Point Marks scoring panel** visible below the live standings chart (§8.7).
- Same per-team submit / lock / undo flow as Mentor (§8.6); per-team range is **0+** with **no maximum**.
- **Submit and Undo disabled** while the Winner announcement overlay is displayed (§8.12).
- User bar shows "Pain Point Marks" with 📌 avatar.

### 4.6 Interactive (secret auth-screen entry)

- Entered by typing **`interactive`** in the email field and tapping **Continue** (§4.1). **No assignment slot** and **no** `@` validation for this exact string.
- Read-only access: live standings chart (§8.4), champion banner (§8.9), and vote status matrix (§8.8) — same surfaces as Viewer (§4.7).
- **Hidden / disabled:** assignment picker, team vote UI, role score inputs, vote confirmation dialog.
- User bar: avatar 📺, name "Interactive", pill "📺 Interactive".
- Receives realtime / polling updates like other users (chart, champion, matrix refresh).
- **No** row in `sessions`; **no** votes persisted. Logout clears local interactive session only.
- **Background music:** on login, **preload** `sounds/vote_bgm.mp3` and `sounds/champion.mp3` into the browser cache, then loop `vote_bgm.mp3` until **logout** or tapping the 📢 announce control (§8.12); on 📢 tap, **fade out** over 1 second before the winner overlay opens (§10).
- **Winner announcement trigger:** when the champion banner is visible (`show`), display a tappable 📢 emoji anchored to the **lower-right corner** of `#champ-banner` (§8.9). Tapping fades out BGM, then opens the **Winner announcement** full-screen overlay (§8.12).

### 4.7 Viewer (auth-screen entry)

- Entered via **Viewer** button on the auth screen (§8.1). **No email** and **no assignment slot**.
- Read-only access: live standings chart (§8.4), champion banner (§8.9), and vote status matrix (§8.8).
- **Hidden / disabled:** assignment picker, team vote UI, role score inputs, vote confirmation dialog.
- User bar: avatar 👁, name "Viewer", pill "👁️ Viewer".
- Receives realtime / polling updates like other users (chart, champion, matrix refresh).
- **No** row in `sessions`; **no** votes persisted. Logout clears local viewer session only.

### 4.8 Slot ownership resolution

`getSlotOwnerEmail(slotKey)`:

1. Active session holder in `sessions` table for that `slot_key`, if any.
2. Else earliest voter associated with that slot in `voteLog` (fallback for legacy rows).
3. Else `null` (slot available).

---

## 5. Data Model (Supabase)

### 5.1 `sessions`

Locks an assignment slot to an email. **One row per slot; one slot per user.**

| Column      | Type        | Notes                                           |
|-------------|-------------|-------------------------------------------------|
| `slot_key`  | text (PK)   | e.g. `team:1`, `role:mentor` (see §2.3)         |
| `email`     | text        | Owner email (unique per active user)            |
| `name`      | text        | Display name                                    |
| `locked_at` | timestamptz | Default `now()`                                 |

**Suggested SQL (new system):**

```sql
create table if not exists sessions (
  slot_key  text primary key,
  email     text not null,
  name      text not null,
  locked_at timestamptz default now()
);
create unique index if not exists sessions_email_unique on sessions (email);
```

Legacy `index.html.bak` used `team_id int` PK — migrate or replace for the slot_key model.

### 5.2 `votes`

All score events from every assignment type.

| Column        | Type        | Notes                                              |
|---------------|-------------|----------------------------------------------------|
| `id`          | serial (PK) |                                                    |
| `voter_email` | text        | Voter's email                                      |
| `voter_name`  | text        | Display name                                       |
| `from_team`   | text        | Source team name (`Team 1`…) or role label (`Mentor`, `Pain Point Marks`) |
| `to_team_id`  | int         | Target team 1–4                                    |
| `points`      | int         | Point amount                                       |
| `created_at`  | timestamptz | Default `now()`                                    |

**`from_team` values by assignment:**

| Assignment | `from_team` value |
|------------|-------------------|
| Team 1–4   | `Team 1`, `Team 2`, … (voter's team name) |
| Mentor     | `Mentor` |
| Pain Point Marks | `Pain Point Marks` |

**Persistence rules:**

- **Team rep:** one row per `voter_email` total (single active vote). **Undo** deletes the row; user may confirm a new vote for a different team. Disabled while winner announcement is displayed.
- **Mentor / Pain Point Marks:** one row per `voter_email` + `to_team_id`. **Undo** deletes the row. No in-place amend — undo then re-submit. Disabled while winner announcement is displayed.

### 5.3 `event_state`

Singleton row gating vote/score edits while the Winner announcement overlay is open.

| Column             | Type    | Notes                                      |
|--------------------|---------|--------------------------------------------|
| `id`               | int (PK)| Always `1` (check constraint)              |
| `winner_announced` | boolean | `true` while §8.12 overlay is displayed    |

**Suggested SQL:**

```sql
create table if not exists event_state (
  id               int primary key default 1 check (id = 1),
  winner_announced boolean not null default false
);
insert into event_state (id, winner_announced) values (1, false)
  on conflict (id) do nothing;
```

**Behavior:**

- Interactive user opens Winner announcement (§8.12) → upsert `winner_announced = true`; all clients lock undo/submit via realtime.
- Overlay closed → upsert `winner_announced = false`; undo and re-vote/re-key allowed again.

### 5.4 Row Level Security

Demo setup: `allow all` policies on `sessions`, `votes`, and `event_state`. Restrict in production.

### 5.5 Realtime

Enable on all tables:

```sql
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table event_state;
```

**Fallback:** poll every 4 seconds (`POLL_MS = 4000`) if Realtime unavailable.

---

## 6. Client State

| Variable          | Type                              | Description                                      |
|-------------------|-----------------------------------|--------------------------------------------------|
| `currentUser`     | `{name, email, avatar, slot?, isViewer?, isInteractive?}` | `slot` when assigned; `isViewer: true` (§4.7) or `isInteractive: true` (§4.6) for read-only entry |
| `votes`           | `{teamId: total}`                 | Running totals per team                          |
| `voteLog`         | array                             | All vote rows for matrix / history               |
| `myTeamVote`      | `{teamId, confirmed}` or `null`   | Team rep's single vote (§3.1)                    |
| `myRoleScores`    | `{teamId: points}`                | Mentor / Pain Point Marks scores for this user   |
| `takenSlots`      | `{slotKey: email}`                | Active session locks for all 6 options           |
| `roleScoreDrafts` | `{teamId: string}`                | In-progress role score inputs                    |
| `ourVoteIds`      | Set                               | Dedup own inserts from realtime                  |
| `winnerAnnounced` | boolean                           | `true` when Winner announcement overlay is open (§8.12); synced from `event_state` |

### 6.1 Session persistence (localStorage)

- Key: `lv_session_v2`
- Fields: `{ email, name, slotKey }` for assigned users — e.g. `team:2` or `role:mentor`
- Viewer: `{ isViewer: true }` only (no email/slot)
- Interactive: `{ isInteractive: true }` only (no email/slot)
- Restored on page load via `tryRestoreSession()`
- Cleared on logout; abandoned if slot claimed by another email

### 6.2 Editing grace period

- `isUserEditing()`: true while a confirmation dialog is open, or during active role score input, or for a short grace period after interaction.
- Remote re-renders skip scoring UI updates while editing (chart still updates).

---

## 7. UI Theme — Cartoon Game Leaderboard

All screens, components, motion, and audio must follow a single visual system: **Cartoon Game Leaderboard** — bright arcade / mobile-party-game energy (think colorful scoreboard, chunky UI, playful medals, bouncy motion). **Do not** use the dark sci-fi / cyber aesthetic from `index.html.bak` (Orbitron, Rajdhani, dark gradients).

### 7.1 Design principles

| Principle | Guideline |
|-----------|-----------|
| Mood | Fun, energetic, competitive — like a cartoon game results screen |
| Readability | Large labels, high contrast, legible on phones in a live room |
| Touch-first | Big tap targets, chunky buttons, no tiny controls |
| Motion | Bouncy, exaggerated — score pops, bar growth, rank swaps feel rewarding |
| Consistency | Same border weight, shadow style, and corner radius everywhere |

### 7.2 Color palette

Use CSS custom properties. Team accent colors (§2.1) stay; surround them with a bright game-board base.

```css
:root {
  /* Base board */
  --bg-sky:        #5BC8F5;      /* sky-blue playfield */
  --bg-sky-deep:   #3AABE0;
  --surface:       #FFF8E7;      /* warm cream panels */
  --surface-2:     #FFE8B8;      /* secondary panel */
  --ink:           #2D1B4E;      /* primary text — deep purple, not black */
  --ink-muted:     #6B5B8A;

  /* Game chrome */
  --border-chunky: #2D1B4E;      /* 3–4px comic outline */
  --shadow-pop:    0 6px 0 #2D1B4E; /* hard offset “sticker” shadow */
  --gold:          #FFD93D;
  --gold-dark:     #E8B800;
  --cta:           #FF6B35;      /* primary action orange */
  --cta-hover:     #FF8F5C;
  --success:       #4CD964;
  --error:         #FF4757;
  --locked:        #C4B5FD;
}
```

- **Background:** sky gradient or subtle cloud pattern — not dark space.
- **Panels / cards:** cream or light yellow with thick dark outline and hard drop shadow.
- **Leader (#1):** gold crown, star burst, extra glow — still cartoon (yellow sparkles), not neon cyber.

### 7.3 Typography

| Use | Font (Google Fonts) | Style |
|-----|---------------------|-------|
| Headings, scores, ranks | **Fredoka** (600–700) or **Bangers** | Rounded / arcade display |
| Body, labels, emails | **Nunito** (600–800) | Friendly, rounded sans |

- Avoid monospace sci-fi fonts (Orbitron, Rajdhani).
- Score numbers: large, bold, slight letter-spacing; optional subtle text stroke for comic legibility.
- Section titles: uppercase or title case with emoji icons (🏆 📊 🗳️).

### 7.4 Component styling

**Buttons**

- Thick `3–4px` border (`--border-chunky`), `border-radius: 16–20px`
- Hard offset shadow (`--shadow-pop`); on press: shadow collapses + `translateY(4px)` (button “pushes in”)
- Primary CTA: orange gradient or flat orange with white/bold label
- Disabled / locked: muted fill, 🔒 icon, reduced shadow

**Cards (team vote, assignment picker)**

- Rounded rectangle “sticker” panels on cream surface
- Team color as top stripe or left accent bar + large emoji
- Hover/tap: slight scale `1.03` + wiggle or bounce keyframe
- Selected / voted: green check badge, gold star burst

**Inputs (email, role scores)**

- Rounded inset field with chunky border; focus ring as dashed comic outline
- Numeric inputs: large centered digits, game-score style

**Modals (assignment picker, vote confirm)**

- Centered “game panel” with double-border or thick single border
- Title bar with trophy/star decoration
- Backdrop: semi-transparent dark purple blur, not flat black

**User bar**

- Horizontal pill strip; avatar as circular badge with thick border (letter or emoji)

**Toast**

- Small comic panel sliding up from bottom-right; success = green border, error = red border

### 7.5 Live standings chart (leaderboard centerpiece)

The chart is the **hero leaderboard** — not a minimal data viz.

- **Layout:** four horizontal bars in fixed team order (Team 1 left → Team 4 right) inside a framed “LEADERBOARD” board
- **Bars:** thick, rounded caps, vertical candy-gradient fills using each team’s color
- **Rank medals:** 🥇🥈🥉4️⃣ on or above bars; #1 bar slightly taller pulse / star particles
- **Score labels:** big Fredoka/Bangers numbers above each bar; animate count-up or pop on change
- **Team row:** emoji + name; **claimer email** underneath in smaller Nunito muted ink
- **Rank change:** bar positions stay fixed; medal updates on the bar whose rank changed; brief sparkle on a bar that moved up in rank
- **#1 treatment:** gold crown on champion bar, soft yellow halo (cartoon stars, not laser spotlight)
- **Empty state:** flat gray bar stub + “0” or empty — still styled, not bare HTML

### 7.6 Champion banner

- Wide gold ribbon / trophy panel across top of leaderboard area
- “CHAMPION!” in Bangers/Fredoka, crown 👑, team emoji + name, total score in huge digits
- Subtle looping shimmer on gold fill (CSS gradient animation)
- Confetti burst when leader changes (see §10)

### 7.7 Vote status matrix

- Styled as arcade **score grid**: rounded table cells, alternating row tints
- Header row: team emojis on colored pills
- Checkmarks: green chunky ✓; scores: tabular nums in display font
- **Team rows:** before voting, show `·` in each Team 1–4 column; after voting, one ✓ in a single cell **colspanning all four team columns** (vote target hidden from other participants)
- **Mentor row:** soft purple tint, 🎓 icon; per column show `·` until scored, then **✓ only** — numeric marks are **not** shown on the board (privacy)
- **Pain Point Marks row:** soft pink tint, 📌 icon; per column show `·` until scored, then the **actual marks** in display font

### 7.8 Motion & interaction catalog

| Interaction | Animation |
|-------------|-----------|
| Button tap | Press-in shadow + `scale(0.97)` |
| Team card tap (pre-confirm) | Bounce + highlight ring |
| Vote confirmed | Star burst from card → bar flies to leaderboard + coin pop sound |
| Score increase | Bar grows with elastic ease; number scales up then settles |
| Rank change | Medals update in place; short sparkle on bar that gained rank |
| New leader | Confetti + champion ribbon reveal |
| Modal open | Scale from `0.9` with overshoot ease |
| Locked slot | Gentle shake if user taps taken assignment |

Prefer CSS transitions/keyframes for UI; canvas only for confetti/particles (optional).

### 7.9 Responsive & accessibility

- Mobile-first: single-column vote cards, scrollable matrix, chart height ~220px on narrow screens
- `touch-action: manipulation` on all interactive elements
- Focus visible: dashed comic outline matching theme
- Color is not the only signal — use icons, labels, and borders for state (voted, locked, error)

### 7.10 Theme vs. legacy (`index.html.bak`)

| Aspect | Legacy | Cartoon Game Leaderboard |
|--------|--------|--------------------------|
| Background | Dark `#0a0e1a` space | Bright sky / playfield |
| Fonts | Orbitron, Rajdhani | Fredoka/Bangers + Nunito |
| Buttons | Flat gradient sci-fi | Chunky bordered “sticker” buttons |
| Chart | Sleek dark bars | Candy bars, medals, big scores |
| #1 effect | Neon spotlight cone | Gold crown + star halo + confetti |
| Overall | Cyber trophy room | Arcade party game scoreboard |

---

## 8. UI Surfaces

All surfaces in this section must implement §7 (Cartoon Game Leaderboard theme).

### 8.1 Auth screen

- Email input + Continue (chunky CTA button)
- **Viewer** button below Continue: secondary/chunky style; **no email validation**; enters read-only dashboard (§4.7)
- **Secret:** email exactly `interactive` + Continue → Interactive mode (§4.6); no visible hint on the auth screen
- Title: "PROJECT FARMER KEYNOTE DAY 2026-07-18 VOTING SYSTEM" in display font (three lines on auth screen: PROJECT FARMER / KEYNOTE DAY 2026-07-18 / VOTING SYSTEM)
- Trophy 🏆 hero icon with gentle float animation
- Sign-in card: cream panel on sky background

### 8.2 Assignment picker dialog

- **Mandatory** on first login (unless returning user with valid slot); styled as §7.4 game panel modal.
- **Team section:** 4 buttons (Team 1–4), 2×2 grid or similar.
- **Role section:** 2 buttons (Mentor, Pain Point Marks).
- Visual separator between sections (headings: "Team" and "Role").
- **Taken slot:** button disabled; label + **email of claimer** shown under the option name.
- **Available slot:** enabled; no email.
- Selecting any option claims that slot; user cannot select a second option.
- Optional Cancel closes modal without claiming (user stays on auth or limited state).

### 8.3 User bar

- Avatar, name, assignment pill (team emoji + name, role name, or **👁️ Viewer**)
- Logout (local only; DB session retained for assigned users; viewer has no DB session)

### 8.4 Live standings chart

- Implements §7.5 (leaderboard centerpiece)
- Horizontal bar chart for **4 teams**; bars stay in **fixed team order** (Team 1 → Team 4, left to right); rank shown via medals and `#1` crown, not bar position
- **No rank hint** in the chart header — title only (`📊 Live Standings`)
- **Team label row:** emoji + team name, with **claimer email** underneath (muted Nunito)
- If no one has claimed the team slot yet, omit email or show "—"

### 8.5 Team representative voting UI (tap-to-vote)

Shown only for `team:N` assignments. **No numeric input or keypad.**

- Display **3 tappable team cards** (all teams except own).
- Own team card shown disabled with "your team" badge.
- Instruction text: e.g. "Tap the team you think is best — you have one vote worth 1,000 marks."
- **On tap** (eligible team, no active vote): open **confirmation dialog**
  - Message: confirm casting the vote (1,000 marks) to the chosen team
  - **Confirm** → persist vote, lock other cards, show voted state + **Undo Vote** button
  - **Cancel** → close dialog, no vote
- **After vote:** highlight chosen team; show "✓ Voted — 1,000 marks to [Team X]"; other cards disabled; **Undo Vote** below grid.
- **Undo Vote:** delete vote row; unlock eligible cards; instruction prompts user to tap a team again.
- **While Winner announcement displayed (§8.12):** all cards and **Undo Vote** disabled; instruction notes voting is locked.
- Optional: star-burst fly animation + coin sound on confirm (see §10)

### 8.6 Mentor scoring UI

Shown only for `role:mentor` assignment. **Must be visible** (`display: block`) when a Mentor is logged in — hidden for team reps, Pain Point Marks, and viewers.

**Layout** — cream game panel below the leaderboard, matching §7.4:

```
┌──────────────────────────────────────────────┐
│  🎓 Mentor Scoring                           │
│  Enter 0–3,000 marks per team and submit.    │
│                                              │
│  🔥 Team 1   [ 1500 ]  [ Submit ]            │  ← unsubmitted
│  ⚡ Team 2   [  800 ]  [ Undo  ]  (locked)   │  ← submitted
│  🌊 Team 3   [    0 ]  [ Submit ]            │
│  🦁 Team 4   [ 2200 ]  [ Undo  ]  (locked)   │
└──────────────────────────────────────────────┘
```

**Per-team row:**

1. **Team label** — emoji + name + left accent stripe in team color.
2. **Score input** — large centered numeric field; `0–3,000` validation (clamp or warn above max).
3. **Submit** (unsubmitted rows) — persist that team's score; lock input; switch button to **Undo**; show ✓ on Vote Status Board for that column.
4. **Undo** (submitted rows) — delete vote row from DB; subtract points from standings; clear ✓ on board; unlock input and clear value; button returns to **Submit**. **Disabled** while Winner announcement is displayed (§8.12).
5. **Saved indicator** — when locked, show `Saved: N` under the team name (visible to the Mentor only in this panel).

**Actions:**

- **Submit** (per row) — persist one team's score; row locks immediately.
- **Undo** (per row) — remove that team's score entirely; Mentor must re-key and submit again. **Disabled** while Winner announcement is displayed (§8.12).
- Enter key in an unlocked input submits that row.

**No batch submit** — there is no "Submit All Scores" button for role scoring (Mentor or Pain Point Marks).

**While Winner announcement displayed:** all **Submit** and **Undo** controls disabled; hint text notes scoring is locked.

**Returning users:** pre-fill and lock rows with saved scores from `myRoleScores`; show **Undo** on locked rows (unless announcement is displayed).

**Validation:** minimum 0; maximum 3,000 per team. Mentor may assign 0 to skip a team.

### 8.7 Pain Point Marks scoring UI

Shown only for `role:pain_point_marks` assignment. **Must be visible** (`display: block`) when a Pain Point Marks user is logged in.

**Same UI and flow as Mentor (§8.6):** four team rows, per-team **Submit** / **Undo**, lock after submit, no batch submit, no in-place edit. **Submit and Undo disabled** while Winner announcement is displayed (§8.12).

**Differences from Mentor:**

| Aspect | Mentor | Pain Point Marks |
|--------|--------|------------------|
| Title | 🎓 Mentor Scoring | 📌 Pain Point Marks |
| Per-team range | 0–3,000 | 0+ (no max) |
| Vote Status Board | ✓ only (no numeric amount) | Actual marks shown |

**Layout** — same cream game panel as §8.6:

```
┌──────────────────────────────────────────────┐
│  📌 Pain Point Marks                         │
│  Enter marks per team (min 0) and submit.    │
│                                              │
│  🔥 Team 1   [  500 ]  [ Submit ]            │
│  ⚡ Team 2   [ 1200 ]  [ Undo  ]  (locked)   │
│  🌊 Team 3   [    0 ]  [ Submit ]            │
│  🦁 Team 4   [ 3500 ]  [ Undo  ]  (locked)   │
└──────────────────────────────────────────────┘
```

**Validation:** minimum 0; no maximum cap.

### 8.8 Vote status matrix

- Visible when logged in
- Header row: Voter | Team 1 … Team 4
- Rows for each assignment slot holder (teams + roles)
- **Team rows:** before voting, `·` in each Team 1–4 column; after voting, one ✓ spanning all four team columns (`colspan="4"`) so observers cannot infer which team received the vote
- **Mentor row:** per column, `·` until that team has been scored, then **✓** — do **not** display the numeric score on the board (only participation is visible)
- **Pain Point Marks row:** per column, `·` until scored, then the **actual marks** submitted (0+)
- Subtitle: participation summary (e.g. "N voters have submitted scores")

### 8.9 Champion banner

- Implements §7.6 (gold ribbon / trophy panel)
- Shown when top score > 0
- **Interactive mode only:** when banner has class `show`, render a 📢 **announce** control at the **lower-right** of `#champ-banner` (`position: relative` on banner, absolute on button). Tapping opens §8.12. Hidden for all other roles and when banner is hidden.

### 8.10 Toast notifications

- Bottom-right, 3s auto-hide; error style for failures

### 8.11 Vote confirmation dialog (team reps)

- Modal overlay triggered by tap on an eligible team card
- Shows chosen team name/emoji and fixed 1,000 marks
- Confirm / Cancel buttons
- Blocks interaction with vote cards until dismissed

### 8.12 Winner announcement (Interactive only)

Full-screen overlay opened from the 📢 control on `#champ-banner` (§8.9). Uses current **#1 team** from live standings (`getRanks()[0]`).

**Layout:**

```
┌────────────────────────────────────────────┐
│  (animated celebration background)         │
│  floating cartoon stars / balloons / etc.  │
│                                            │
│     Congratulations to                     │
│         Team {N}                           │  ← very large display type
│  For winning today's keynote day!          │
│                                            │
│  [ ✕ close ]                               │
└────────────────────────────────────────────┘
```

**Caption** (exact copy, `{N}` = winning team number 1–4):

```
Congratulations to
Team {N}
For winning today's keynote day!
```

**Behavior:**

- **Open:** tap 📢 on champion banner while Interactive and banner visible; **fade out** `vote_bgm.mp3` over **1 second** (`VOTE_BGM_FADE_MS`); then set `event_state.winner_announced = true` (locks all vote/score undo and submit on every client), open overlay, and start `champion.mp3` (§10).
- **Close:** ✕ control or tap backdrop; set `event_state.winner_announced = false`; stops `champion.mp3` loop only (`vote_bgm.mp3` does **not** resume); undo and re-vote/re-key allowed again.
- **Audio:** loop `sounds/champion.mp3` infinitely while overlay is open (§10).
- **Motion:** CSS/keyframe celebration background (gradient shimmer, confetti-like particles); multiple animated cartoon elements (stars ⭐, balloons 🎈, party poppers 🎉) drifting/bouncing — align with §7 Cartoon Game Leaderboard.
- Winning team emoji may appear beside the team number in the headline (optional accent; number is required).

---

## 9. Realtime Event Handling

### INSERT `votes`

- Skip if `id` in `ourVoteIds` (already applied locally)
- Add points to `votes[to_team_id]` total; append to `voteLog`
- Dedupe by voter email + target + points where appropriate

### DELETE `votes`

- Subtract points from total; remove from `voteLog` (requires row `id` in payload)

### INSERT `sessions`

- Update `takenSlots`; refresh assignment dialog if open
- Toast if another user claimed a slot (e.g. "user@email.com claimed Team 2")
- Re-render chart so new claimer email appears under team name on dashboard

### `event_state` (INSERT/UPDATE)

- Set `winnerAnnounced` from `winner_announced` column
- Re-render voting UI so undo/submit controls reflect lock state on all clients

---

## 10. Audio & Visual Effects

Cartoon-game flavored effects — playful, not sci-fi. Align with §7.8 motion catalog.

| Event              | Effect |
|--------------------|--------|
| Team vote confirmed| Star flies from card to leaderboard bar; cheerful whoosh (Web Audio) |
| Score lands on bar | Coin / point pop chime + mini star burst particles |
| Leader changes     | Confetti burst (8s auto-stop, `FW_DURATION_MS`); champion ribbon shimmer |
| #1 on leaderboard  | Gold crown + soft star halo pulse (CSS), not neon spotlight |

**Synthesized UI sounds** (Web Audio): vote whoosh, coin pop — see table above. `AudioContext` resumed on first user gesture. Prefer bright sine/triangle tones (coin pickup, level-up) over dark sawtooth whoosh.

**MP3 loops (Interactive mode only):**

| When | Asset | Behavior |
|------|-------|----------|
| Interactive login | `sounds/vote_bgm.mp3` | Loop until logout or 📢 tap (§8.12) |
| Winner announcement open (§8.12) | `sounds/champion.mp3` | Fade out `vote_bgm.mp3` over 1s; then open overlay and loop `champion.mp3` until overlay closed |
| Winner announcement closed | — | Stop `champion.mp3` only; do **not** resume `vote_bgm.mp3` |

Use HTML5 `Audio` with `loop: true` and `preload: auto`. On Interactive login, call `preloadInteractiveBgm()` to buffer both MP3 assets (`vote_bgm.mp3`, `champion.mp3`) before playback — reuse the same cached `Audio` elements for `startVoteBgm()` / `startChampionBgm()` to avoid decode/network lag. Start playback after user gesture (Continue tap). Release cached elements on Interactive logout; stop champion audio on overlay close.

---

## 11. Configuration Constants

```javascript
TEAM_VOTE_PTS         = 1000   // fixed marks for team rep single vote
MENTOR_MIN_PTS        = 0
MENTOR_MAX_PTS        = 3000   // per team, Mentor role
PAIN_POINT_MIN_PTS    = 0        // per team, no max
FW_DURATION_MS        = 8000     // confetti burst duration
POLL_MS               = 4000     // polling fallback interval
VOTE_BGM_FADE_MS      = 1000     // vote BGM fade-out before winner overlay (§8.12)
STORAGE_KEY           = 'lv_session_v2'
INTERACTIVE_EMAIL     = 'interactive'  // secret auth-screen entry (§4.6)
USE_SUPABASE          = true

TEAMS = [ /* 4 teams — see §2.1 */ ]
ROLES = [ /* 2 roles — see §2.2 */ ]
SLOT_KEYS = [ 'team:1', 'team:2', 'team:3', 'team:4',
              'role:mentor', 'role:pain_point_marks' ]
```

Supabase credentials: `SUPABASE_URL`, `SUPABASE_KEY` (anon/public key).

---

## 12. Constraints & Edge Cases

1. **One slot per user:** a user may hold only one of the six options; enforced by unique email index and UI.
2. **One user per slot:** once claimed, slot locked; other users see email under that option in dialog and (for teams) on chart.
3. **Team rep — one active vote:** after confirm, other cards locked; **Undo Vote** deletes row and allows a new choice. Disabled while Winner announcement is displayed (§8.12).
4. **Team rep — cannot vote for self:** own team card never opens confirmation dialog.
5. **Team rep — fixed 1,000:** no variable amount; `points` always `1000` in DB.
6. **Mentor — per-team cap:** reject or clamp scores outside 0–3,000.
7. **Pain Point Marks — no max:** only enforce minimum 0; allow any positive integer.
8. **Role score changes:** **Mentor / Pain Point Marks** — undo deletes row; must re-submit (no in-place edit). Disabled while Winner announcement is displayed (§8.12).
9. **Winner announcement lock:** while §8.12 overlay is open (`event_state.winner_announced = true`), all team **Undo Vote**, role **Submit**, and role **Undo** controls are disabled on every client.
10. **Race on slot claim:** check existing session before insert; refresh dialog on failure.
11. **Logout ≠ unlock:** session row stays so email can return; other emails blocked.
12. **Chart updates during editing:** scoring UI frozen while confirmation dialog open or role inputs active; chart/champion still update.
13. **Champion confetti:** only on leader *change*, not every point update.
14. **Email display:** claimer email must appear (a) under locked options in assignment dialog, (b) under team name on live standings chart.
15. **Matrix score privacy:** team-rep rows must not reveal vote target — use a single spanning ✓ across Team 1–4 columns after vote. **Mentor** rows show per-column ✓ when a team has been scored, but **never** the numeric amount. **Pain Point Marks** rows show per-column numeric scores.

---

## 13. Tech Stack

- Single-page HTML + inline CSS + vanilla JS
- Supabase JS v2 (ESM from jsDelivr CDN)
- Google Fonts: **Fredoka** or **Bangers** (display) + **Nunito** (body) — see §7.3
- No build step; static hosting (GitHub Pages)
- Optional canvas layer for confetti/particles (fixed, `pointer-events: none`)

---

## 14. Out of Scope (current system)

- No admin dashboard separate from the app
- No vote audit export
- No authentication beyond email string
- No automatic session expiry / slot release
- RLS is wide open (demo mode)
- No secret admin edit panel (removed from original keypad model)

---

## 15. File Reference

| File            | Role                                      |
|-----------------|-------------------------------------------|
| `index.html.bak`| Original full implementation (archived; 6-team model) |
| `CNAME`         | Custom domain for GitHub Pages            |
| `SCORING_SPEC.md`| This document                             |

---

## 16. Changelog from `index.html.bak`

| Area | Old | New |
|------|-----|-----|
| Teams | 6 teams | 4 teams (Team 1–4) |
| Post-login | Team picker or Viewer | Single dialog: Team section + Role section |
| Assignments | Team or Viewer | Exactly one of 6 slots (4 teams + 2 roles) |
| Roles | None | Mentor, Pain Point Marks |
| Viewer mode | Explicit button on auth screen | **Restored** — no email, read-only leaderboard |
| Interactive mode | — | **Secret** — email `interactive` + Continue; BGM + winner announcement overlay (§4.6, §8.12) |
| Session PK | `team_id` int | `slot_key` text |
| Chart labels | Team name only | Team name + claimer email underneath |
| Dialog taken state | "🔒 Taken" only | 🔒 + claimer email under option |
| Team rep voting | Up to 5 votes, 1–5,000 each, keypad | **1 active vote**, fixed **1,000**, tap + confirm + **Undo Vote** (locked during winner announcement) |
| Mentor | Observer only | Scores all 4 teams, **0–3,000** each |
| Pain Point Marks | Bonus row only | Scores all 4 teams, **0+**, no cap |
| Bonus layer | Separate `__BONUS__` sentinel | Removed; all scores in `votes` table |
| Score entry | Keypad for team reps | Tap-to-vote (teams); numeric inputs (roles) |
| Visual theme | Dark sci-fi (Orbitron, neon) | **Cartoon Game Leaderboard** (§7) — sky bg, chunky UI, Fredoka/Nunito |
