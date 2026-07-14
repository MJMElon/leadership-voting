# Project Farmer Keynote Day 2026-07-18 — Scoring System Spec

Source of truth for rebuilding the voting/scoring system. Derived from `index.html.bak` (original implementation), updated for 4-team + role assignment model.

**Deployment:** GitHub Pages at `vote.mjmnursery.com` (see `CNAME`).

---

## 1. Purpose

A live, multi-device voting app for the **Project Farmer Keynote Day 2026-07-18** event. Four teams compete for total points. The login field accepts **email addresses** (team voters) or two reserved keywords — `interactive` and `mentor` — each with a distinct role (§4.1). After sign-in, email users claim exactly one team (Team 1–4) via the assignment picker (§4.2). The `mentor` keyword skips the picker and enters a combined UI: numeric Mentor scoring plus a single Pain Point tap-to-vote (§4.4, §8.5). Scoring behavior depends on assignment type (see §3). The entire UI uses the **Cartoon Game Leaderboard** theme (§7).

---



## 2. Assignment Options

Each logged-in user claims assignment slot(s) as follows: **email users** pick exactly one team (`team:1`–`team:4`); `mentor` keyword login claims both role slots (`role:mentor` and `role:pain_point_marks`) under one identifier. Once claimed, a slot is locked to that user's email/identifier; no other user may select it.

### 2.1 Teams (4 options)


| ID  | Name   | Emoji | Color     |
| --- | ------ | ----- | --------- |
| 1   | Team 1 | 🔥    | `#f59e0b` |
| 2   | Team 2 | ⚡     | `#10b981` |
| 3   | Team 3 | 🌊    | `#6366f1` |
| 4   | Team 4 | 🦁    | `#ef4444` |


Configurable constant `TEAMS` — 4 teams, each with `id`, `name`, `emoji`, `color`.

Team slots are for **team representatives** who cast one fixed-value vote for their chosen best team (§3.1).

### 2.2 Roles (2 options)


| ID                 | Name             | How to enter                                                                          |
| ------------------ | ---------------- | ------------------------------------------------------------------------------------- |
| `mentor`           | Mentor           | Login keyword `mentor` (§4.1, §4.4) — numeric scoring + Pain Point tap-to-vote (§8.5) |
| `pain_point_marks` | Pain Point Marks | Same `mentor` login — single tap-to-vote for one team (§3.3, §8.5)                    |


Configurable constant `ROLES` — each with `id`, `name`.

Role slots: **Mentor** scores all four teams with numeric entry (§3.2); **Pain Point Marks** is a single tap-to-vote for one team (§3.3).

### 2.3 Slot keys (unified identifier)

All six options share one locking namespace. Use stable slot keys in the DB and client:


| Slot key                | Display name     | Type |
| ----------------------- | ---------------- | ---- |
| `team:1`                | Team 1           | team |
| `team:2`                | Team 2           | team |
| `team:3`                | Team 3           | team |
| `team:4`                | Team 4           | team |
| `role:mentor`           | Mentor           | role |
| `role:pain_point_marks` | Pain Point Marks | role |


**Total: 6 slot keys** — email users choose one team; `mentor` keyword holds both role slots; no duplicates across users.

---



## 3. Scoring Rules

All points are **additive**: a team's total is the sum of every score row received from all voters. Each voter's contribution is stored as one or more rows in the `votes` table (see §5.2).

### 3.1 Team representative — single tap vote (fixed 1,000 marks)

Applies when the logged-in user holds a `team:N` slot (Team 1–4).


| Rule            | Detail                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Votes allowed   | **Exactly one active vote** per user, for **one** other team                                                                                            |
| Cannot vote for | Own team                                                                                                                                                |
| Points awarded  | **Fixed 1,000 marks** — no score entry, no variable amount                                                                                              |
| Interaction     | **Tap-to-vote** — user taps the team card they consider best                                                                                            |
| Own team card   | **Shown but locked** — "Your team" badge; not tappable                                                                                                  |
| Confirmation    | After tap, a **confirmation dialog** asks whether to cast their vote to that team                                                                       |
| On confirm      | Insert vote row (`points = 1000`); UI locks other cards; show voted state                                                                               |
| Undo            | Tap **Undo Vote** → delete vote row; unlock all eligible cards; user may tap a different team and confirm again                                         |
| Re-vote         | After undo, user may vote for any eligible team (same confirm flow)                                                                                     |
| Lock            | **Undo and re-vote disabled** while the **Winner announcement** overlay is displayed (§8.9) — synced to all clients via `event_state.winner_announced` |
| On cancel       | Close dialog; no vote cast; user may tap a different team                                                                                               |


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

Applies when the logged-in user holds the `role:mentor` slot (`mentor` keyword login, §4.4). Scores are entered via **numeric rows** in the consolidated Mentor panel (§8.5).


| Rule           | Detail                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Targets        | All **4 teams**                                                                                                                                     |
| Per-team range | **Minimum 0**, **maximum 3,000** marks each                                                                                                         |
| Input          | Numeric score entry per team (four inputs)                                                                                                          |
| Submission     | User enters a score for a chosen team and taps **Submit** on that row                                                                               |
| After submit   | Input **locks**; row button changes from **Submit** to **Undo**                                                                                     |
| Undo           | Tap **Undo** → delete that team's vote row; unlock input; Mentor must re-enter and submit a new score |
| Lock           | **Submit and Undo disabled** while the **Winner announcement** overlay is displayed (§8.9) — synced via `event_state.winner_announced`             |
| Amend          | **Not allowed in place** — Mentor must **Undo** first, then enter and submit again                                                                  |


Mentor may assign 0 to any team (e.g. skip a team without scoring it).

### 3.3 Pain Point Marks — single tap vote (fixed 1,000 marks)

Applies when the logged-in user entered via the `mentor` keyword (§4.4) and casts their Pain Point Marks vote from the **consolidated Mentor panel** (§8.5). There is no separate Pain Point Marks login or assignment picker option. Behavior mirrors team-rep tap-to-vote (§3.1), except the Mentor may choose **any** of the four teams (no "own team" restriction).


| Rule           | Detail                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Votes allowed  | **Exactly one active vote** per Mentor user, for **one** team                                                                            |
| Targets        | Any **1** of the 4 teams                                                                                                                 |
| Points awarded | **Fixed 1,000 marks** — no score entry, no variable amount                                                                               |
| Interaction    | **Tap-to-vote** — Mentor taps the team card to award the Pain Point vote                                                                 |
| Confirmation   | After tap, a **confirmation dialog** asks whether to cast the Pain Point vote (1,000 marks) to that team                                 |
| On confirm     | Insert vote row (`points = 1000`, `from_team = 'Pain Point Marks'`); UI locks other cards; show voted state                              |
| Undo           | Tap **Undo Vote** → delete vote row; unlock all team cards; Mentor may tap a different team and confirm again                            |
| Re-vote        | After undo, user may vote for any team (same confirm flow)                                                                               |
| Lock           | **Undo and re-vote disabled** while the **Winner announcement** overlay is displayed (§8.9) — synced via `event_state.winner_announced` |
| On cancel      | Close dialog; no vote cast; user may tap a different team                                                                                |


**Flow:**

```
Tap team card (any of 4 teams)
  → Confirmation dialog: "Cast your Pain Point vote (1,000 marks) to [Team X]?"
  → Confirm → save vote, lock other cards, show voted state + Undo
  → Undo   → delete vote, unlock cards for a new choice
  → Cancel → return to team cards, no change
```

Mentor numeric scoring (§3.2) and Pain Point tap-to-vote are **independent** — the Mentor may submit 0–3,000 marks per team via numeric entry while also holding at most one active Pain Point vote.


| Assignment       | Teams scored | Points per submission | Max submissions             | Input style                        |
| ---------------- | ------------ | --------------------- | --------------------------- | ---------------------------------- |
| Team 1–4         | 1 (not self) | Fixed 1,000           | 1 active (undo to change)   | Tap + confirm dialog + undo        |
| Mentor           | All 4        | 0–3,000 each          | 1 per team (undo to change) | Numeric entry per team (§8.5)      |
| Pain Point Marks | 1 (any team) | Fixed 1,000           | 1 active (undo to change)   | Tap + confirm dialog + undo (§8.5) |




### 3.5 Total score formula

```
team_total[team_id] = sum(all vote rows where to_team_id = team_id)
```

No separate bonus layer — Mentor and Pain Point Marks scores are regular vote rows distinguished by `from_team` (role label).

### 3.6 Ranking

- Teams ranked by `team_total`, descending (used internally for winner announcement).
- `getRanks()[0]` returns the current #1 team when any team has points > 0.

---



## 4. User Roles & Authentication



### 4.1 Sign-in

The auth screen has a single text field (labeled for email) and **Continue**. Input is resolved in this order:


| Input             | Detection                                      | Result                                                                                                                                          |
| ----------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `interactive`     | Exact match, case-insensitive; no `@` required | **Interactive** mode (§4.6) — skip assignment picker                                                                                            |
| `mentor`          | Exact match, case-insensitive; no `@` required | **Mentor** mode (§4.4) — skip assignment picker; claim or restore `role:mentor` **and** `role:pain_point_marks`; consolidated scoring UI (§8.5) |
| **Email address** | Contains `@` (validated on Continue)           | **Team voter** — show assignment picker (§4.2); **Team 1–4 only**                                                                               |
| Anything else     | No `@` and not a reserved keyword              | Toast error: enter a valid email address                                                                                                        |


**Email users (no OAuth):**

- Name derived from email local-part: split on `@`, replace `._+` with spaces, title-case words.
- Avatar: first letter of derived name.

**Reserved keyword users:**

- `interactive`**:** display name "Interactive", avatar 📺; identifier stored as `interactive` (same as `INTERACTIVE_EMAIL` constant).
- `mentor`**:** display name "Mentor", avatar 🎓; identifier stored as `mentor` (same as `MENTOR_EMAIL` constant).

Neither `interactive` nor `mentor` is shown as a hint on the auth screen; both are reserved keywords for event staff / designated roles.

### 4.2 Assignment picker dialog (post-login, email users only)

Shown **only** after a successful **email** sign-in (§4.1). `interactive` and `mentor` keyword logins **never** see this dialog.

Immediately after email sign-in (or when a returning email user has no valid saved assignment), a **modal dialog** appears. The user must choose **exactly one** of four team options before entering the main app.

**Layout — teams only:**

```
┌─────────────────────────────────────┐
│  SELECT YOUR TEAM                   │
│                                     │
│  [ Team 1 ]  [ Team 2 ]             │
│  [ Team 3 ]  [ Team 4 ]             │
│                                     │
│  (Cancel — optional, closes modal)  │
└─────────────────────────────────────┘
```

**Rules:**

1. User selects **one** team button.
2. **No role section** — Mentor and Pain Point Marks are entered via the `mentor` login keyword (§4.1, §4.4), not this dialog.
3. On claim success → close dialog, enter main app with that assignment.
4. On claim failure (race) → refresh dialog, show slot as taken, toast error.
5. **Locked slots:** disabled button; show 🔒 and the **claimer's email** displayed directly under the option label (in the dialog).
6. Available slots: enabled; no email shown until claimed.

**Returning email users:**

- If email matches an active `sessions` row → auto-login with that slot; **do not** show the dialog.
- If saved local session slot is no longer valid (another email claimed it) → clear session, show dialog again.

**Returning** `mentor` **keyword users:**

- If identifier `mentor` matches active `sessions` rows for **both** `role:mentor` and `role:pain_point_marks` → auto-login as Mentor; **do not** show the dialog.
- If either role slot is held by another identifier → toast error; remain on auth screen.

**Logout** does **not** release the slot; the same email (or `mentor` identifier) can return to the same assignment.

### 4.3 Team representative (team slot)

- Holds a `team:N` slot (Team 1–4).
- Voting UI: tap-to-vote cards for all 4 teams (§3.1); own team card is **locked** with "Your team" badge — not tappable.
- After one confirmed vote → other cards locked; **Undo Vote** clears the vote so user can pick again (§3.1).
- **Undo and re-vote disabled** while the Winner announcement overlay is displayed (§8.9).
- User bar shows team emoji + name.



### 4.4 Mentor (role slots, keyword login)

- Entered by typing `mentor` in the login field and tapping **Continue** (§4.1). **No assignment picker** and **no** `@` validation for this exact string.
- On first login: claim **both** `role:mentor` and `role:pain_point_marks` in `sessions` with identifier `mentor` and display name "Mentor".
- On return: restore both role slots if still owned by `mentor`; same race/lock rules as email slot claims (§4.2).
- Holds `role:mentor` (primary slot for client state) and manages Pain Point Marks vote under the same session.
- **Consolidated panel** in the main app (§8.5):
  - **Mentor scoring** — numeric entry 0–3,000 per team (§3.2)
  - **Pain Point Marks** — tap-to-vote cards for all 4 teams; single vote worth 1,000 marks (§3.3)
- Mentor numeric **Submit/Undo** and Pain Point **Undo Vote** disabled while the Winner announcement overlay is displayed (§8.9).
- User bar shows "Mentor" with 🎓 avatar.



### 4.5 Pain Point Marks (consolidated under Mentor login)

- **Not a separate login or assignment.** Pain Point vote is cast from the **same consolidated panel** as Mentor scoring (§8.5).
- Vote row uses `from_team = 'Pain Point Marks'`, `points = 1000` (§5.2); the `role:pain_point_marks` session slot is claimed alongside `role:mentor` on `mentor` keyword login (§4.4).
- **Exactly one active Pain Point vote** — tap-to-vote + confirm + undo, same pattern as team reps (§3.3).



### 4.6 Interactive (reserved login keyword)

- Entered by typing `interactive` in the login field and tapping **Continue** (§4.1). **No assignment slot** and **no** `@` validation for this exact string.
- **Display viewport:** all Interactive UI (user bar + event screens, §8.8) is constrained to a maximum **3840 × 2160** pixel area, centered on larger displays.
- **Read-only:** no voting or scoring UI for the Interactive operator — team vote UI, Mentor panel, and assignment picker remain hidden.
- User bar: avatar 📺, name "Interactive", pill "📺 Interactive".
- Receives realtime / polling updates.
- **No** row in `sessions`; **no** votes persisted. Logout clears local interactive session only.
- **Audio preload (login):** on Interactive login, **preload all MP3 assets** used in this mode (`sounds/vote_bgm.mp3`, `sounds/champion.mp3`, `sounds/done_vote.mp3`) into the browser cache. **Do not start playback** until the user taps **Let's go!** (§8.8).
- **Two-phase event display (§8.8):**
  1. **Ready screen** — large colorful caption **"Are you ready to vote?"** and tappable **"Let's go!"** button.
  2. **Voting screen** — on **Let's go!** tap: cross-fade from ready screen to voting screen; **start looping** `sounds/vote_bgm.mp3`; show large centered QR code (`images/vote-qr-code.png`) with decorative frame; animated caption **"Voting in progress..."** below the QR.
- **Winner announcement (§8.9):** opened from the **"Voting is done! And the winner is..."** button (§8.8). **Fade out** any playing `vote_bgm.mp3` over 1 second, then open winner overlay and loop `champion.mp3` (§10).



### 4.7 Slot ownership resolution

`getSlotOwnerEmail(slotKey)`:

1. Active session holder in `sessions` table for that `slot_key`, if any.
2. Else earliest voter associated with that slot in `voteLog` (fallback for legacy rows).
3. Else `null` (slot available).

---



## 5. Data Model (Supabase)



### 5.1 `sessions`

Locks an assignment slot to an email. **One row per slot; one slot per user.**


| Column      | Type        | Notes                                                                                                                                                            |
| ----------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slot_key`  | text (PK)   | e.g. `team:1`, `role:mentor` (see §2.3)                                                                                                                          |
| `email`     | text        | Owner identifier — real voter email, or literal `mentor` for keyword login (§4.4; locks both `role:mentor` and `role:pain_point_marks`). Interactive has no row. |
| `name`      | text        | Display name                                                                                                                                                     |
| `locked_at` | timestamptz | Default `now()`                                                                                                                                                  |


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


| Column        | Type        | Notes                                                                     |
| ------------- | ----------- | ------------------------------------------------------------------------- |
| `id`          | serial (PK) |                                                                           |
| `voter_email` | text        | Voter's email                                                             |
| `voter_name`  | text        | Display name                                                              |
| `from_team`   | text        | Source team name (`Team 1`…) or role label (`Mentor`, `Pain Point Marks`) |
| `to_team_id`  | int         | Target team 1–4                                                           |
| `points`      | int         | Point amount                                                              |
| `created_at`  | timestamptz | Default `now()`                                                           |


`from_team` **values by assignment:**


| Assignment       | `from_team` value                         |
| ---------------- | ----------------------------------------- |
| Team 1–4         | `Team 1`, `Team 2`, … (voter's team name) |
| Mentor           | `Mentor`                                  |
| Pain Point Marks | `Pain Point Marks`                        |


**Persistence rules:**

- **Team rep:** one row per `voter_email` total (single active vote). **Undo** deletes the row; user may confirm a new vote for a different team. Disabled while winner announcement is displayed.
- **Pain Point Marks:** one row per `voter_email` total (single active vote, `from_team = 'Pain Point Marks'`). Same undo / re-vote rules as team rep (§3.3). Disabled while winner announcement is displayed.
- **Mentor numeric:** one row per `voter_email` + `to_team_id` + `from_team = 'Mentor'`. **Undo** deletes the row. No in-place amend — undo then re-submit. Disabled while winner announcement is displayed.



### 5.3 `event_state`

Singleton row gating vote/score edits while the Winner announcement overlay is open.


| Column             | Type     | Notes                                   |
| ------------------ | -------- | --------------------------------------- |
| `id`               | int (PK) | Always `1` (check constraint)           |
| `winner_announced` | boolean  | `true` while §8.9 overlay is displayed |


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

- Interactive user opens Winner announcement (§8.9) → upsert `winner_announced = true`; all clients lock undo/submit via realtime.
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


| Variable          | Type                                                      | Description                                                                                                                                                                                                |
| ----------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `currentUser`     | `{name, email, avatar, slot?, isInteractive?}` | `slot` when assigned (`team:N` or `role:mentor` for keyword login); `email` may be a real address, `interactive`, or `mentor`; `isInteractive: true` (§4.6) for read-only entry |
| `votes`           | `{teamId: total}`                                         | Running totals per team                                                                                                                                                                                    |
| `voteLog`         | array                                                     | Vote rows for running totals and winner announcement                                                                                                                                                       |
| `myTeamVote`      | `{teamId, confirmed}` or `null`                           | Team rep's single vote (§3.1)                                                                                                                                                                              |
| `myPainPointVote` | `{teamId, confirmed}` or `null`                           | Mentor's single Pain Point vote (§3.3)                                                                                                                                                                     |
| `myRoleScores`    | `{teamId: points}`                                        | Mentor keyword user's numeric Mentor scores (§3.2)                                                                                                                                                         |
| `takenSlots`      | `{slotKey: email}`                                        | Active session locks for all 6 options                                                                                                                                                                     |
| `roleScoreDrafts` | `{teamId: string}`                                        | In-progress role score inputs                                                                                                                                                                              |
| `ourVoteIds`      | Set                                                       | Dedup own inserts from realtime                                                                                                                                                                            |
| `winnerAnnounced` | boolean                                                   | `true` when Winner announcement overlay is open (§8.9); synced from `event_state`                                                                                                                         |




### 6.1 Session persistence (localStorage)

- Key: `lv_session_v2`
- Fields: `{ email, name, slotKey }` for assigned users — e.g. `team:2` or `role:mentor` (with `email: "mentor"`). Mentor keyword sessions also lock `role:pain_point_marks` in DB but localStorage uses `slotKey: 'role:mentor'` as primary.
- Interactive: `{ isInteractive: true, votingStarted?: boolean }` — `votingStarted: true` after **Let's go!** (§8.8); restored on reload to skip ready screen
- Restored on page load via `tryRestoreSession()`
- Cleared on logout; abandoned if slot claimed by another email



### 6.2 Editing grace period

- `isUserEditing()`: true while a confirmation dialog is open, or during active role score input, or for a short grace period after interaction.
- Remote re-renders skip scoring UI updates while editing.

---



## 7. UI Theme — Cartoon Game Leaderboard

All screens, components, motion, and audio must follow a single visual system: **Cartoon Game Leaderboard** — bright arcade / mobile-party-game energy (think colorful scoreboard, chunky UI, playful medals, bouncy motion). **Do not** use the dark sci-fi / cyber aesthetic from `index.html.bak` (Orbitron, Rajdhani, dark gradients).

### 7.1 Design principles


| Principle   | Guideline                                                               |
| ----------- | ----------------------------------------------------------------------- |
| Mood        | Fun, energetic, competitive — like a cartoon game results screen        |
| Readability | Large labels, high contrast, legible on phones in a live room           |
| Touch-first | Big tap targets, chunky buttons, no tiny controls                       |
| Motion      | Bouncy, exaggerated — score pops, bar growth, rank swaps feel rewarding |
| Consistency | Same border weight, shadow style, and corner radius everywhere          |




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


| Use                     | Font (Google Fonts)                  | Style                    |
| ----------------------- | ------------------------------------ | ------------------------ |
| Headings, scores, ranks | **Fredoka** (600–700) or **Bangers** | Rounded / arcade display |
| Body, labels, emails    | **Nunito** (600–800)                 | Friendly, rounded sans   |


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



### 7.5 Motion & interaction catalog


| Interaction                 | Animation                                                        |
| --------------------------- | ---------------------------------------------------------------- |
| Button tap                  | Press-in shadow + `scale(0.97)`                                  |
| Team card tap (pre-confirm) | Bounce + highlight ring                                          |
| Vote confirmed              | Star burst from card + coin pop sound                              |
| Score submitted             | Coin / point pop chime + mini star burst particles                 |
| New leader                  | Confetti on winner announcement open (§8.9)                        |
| Modal open                  | Scale from `0.9` with overshoot ease                             |
| Locked slot                 | Gentle shake if user taps taken assignment                       |


Prefer CSS transitions/keyframes for UI; canvas only for confetti/particles (optional).

### 7.6 Responsive & accessibility

- Mobile-first: single-column vote cards
- `touch-action: manipulation` on all interactive elements
- Focus visible: dashed comic outline matching theme
- Color is not the only signal — use icons, labels, and borders for state (voted, locked, error)



### 7.7 Theme vs. legacy (`index.html.bak`)


| Aspect     | Legacy               | Cartoon Game Leaderboard          |
| ---------- | -------------------- | --------------------------------- |
| Background | Dark `#0a0e1a` space | Bright sky / playfield            |
| Fonts      | Orbitron, Rajdhani   | Fredoka/Bangers + Nunito          |
| Buttons    | Flat gradient sci-fi | Chunky bordered “sticker” buttons |
| #1 effect  | Neon spotlight cone  | Winner announcement overlay (§8.9) |
| Overall    | Cyber trophy room    | Arcade party game scoreboard      |


---



## 8. UI Surfaces

All surfaces in this section must implement §7 (Cartoon Game Leaderboard theme).

### 8.1 Auth screen

- Text input (email-style) + Continue (chunky CTA button)
- **Accepted input on Continue** (§4.1):
  - Valid **email address** (`@` present) → assignment picker (**Team 1–4 only**)
  - Reserved keyword `interactive` (exact, case-insensitive) → Interactive mode (§4.6)
  - Reserved keyword `mentor` (exact, case-insensitive) → Mentor mode (§4.4); claims `role:mentor` + `role:pain_point_marks`; consolidated scoring UI (§8.5)
  - Invalid (no `@` and not a keyword) → error toast
- **No visible hints** for `interactive` or `mentor` on the auth screen
- Title: "PROJECT FARMER KEYNOTE DAY 2026-07-18 VOTING SYSTEM" in display font (three lines on auth screen: PROJECT FARMER / KEYNOTE DAY 2026-07-18 / VOTING SYSTEM)
- Trophy 🏆 hero icon with gentle float animation
- Sign-in card: cream panel on sky background



### 8.2 Assignment picker dialog

- **Email users only** — not shown for `interactive` or `mentor` keyword entry (§4.1).
- **Mandatory** on first email login (unless returning user with valid slot); styled as §7.4 game panel modal.
- **Teams only:** 4 buttons (Team 1–4), 2×2 grid or similar. **No role section.**
- Dialog title: "SELECT YOUR TEAM" (not "assignment").
- **Taken slot:** button disabled; label + **email of claimer** shown under the option name.
- **Available slot:** enabled; no email.
- Selecting any option claims that slot; user cannot select a second option.
- Optional Cancel closes modal without claiming (user stays on auth or limited state).



### 8.3 User bar

- Avatar, name, assignment pill (team emoji + name, role name, or **📺 Interactive**)
- Logout (local only; DB session retained for assigned users; Interactive has no DB session)



### 8.4 Team representative voting UI (tap-to-vote)

Shown only for `team:N` assignments. **No numeric input or keypad.**

- Display **4 team cards**; own team card is **locked** with "your team" badge (not tappable). The other **3 cards** are eligible to vote.
- Instruction text: e.g. "Tap the team you think is best — you have one vote worth 1,000 marks."
- **On tap** (eligible team, no active vote): open **confirmation dialog**
  - Message: confirm casting the vote (1,000 marks) to the chosen team
  - **Confirm** → persist vote, lock other cards, show voted state + **Undo Vote** button
  - **Cancel** → close dialog, no vote
- **After vote:** highlight chosen team; show "✓ Voted — 1,000 marks to [Team X]"; other cards disabled; **Undo Vote** below grid.
- **Undo Vote:** delete vote row; unlock eligible cards; instruction prompts user to tap a team again.
- **While Winner announcement displayed (§8.9):** all cards and **Undo Vote** disabled; instruction notes voting is locked.
- Optional: star-burst fly animation + coin sound on confirm (see §10)



### 8.5 Mentor scoring UI (consolidated with Pain Point Marks)

Shown only for `mentor` keyword login (`role:mentor`). **Must be visible** (`display: block`) when a Mentor is logged in — hidden for team reps and Interactive.

Single cream game panel in the main app (§7.4) with **two sections**:

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  🎓 Mentor Scoring                                           │
│  Enter 0–3,000 mentor marks per team and submit.             │
│                                                              │
│  🔥 Team 1   [ 1500 ]  [ Submit ]                            │
│  ⚡ Team 2   [  800 ]  [ Undo  ]  (locked)                   │
│  🌊 Team 3   [    0 ]  [ Submit ]                            │
│  🦁 Team 4   [ 2200 ]  [ Undo  ]  (locked)                   │
│                                                              │
│  ── 📌 Pain Point Vote (1,000 marks) ──────────────────     │
│  Tap the team to award your single Pain Point vote.          │
│                                                              │
│  [ Team 1 ]  [ Team 2 ]  [ Team 3 ]  [ Team 4 ]              │
│  (after vote: chosen card highlighted; others disabled)      │
│  [ Undo Vote ]                                               │
└──────────────────────────────────────────────────────────────┘
```

**Section 1 — Mentor numeric scoring (§3.2):**

Per-team row (four rows):

1. **Team label** — emoji + name + left accent stripe in team color.
2. **Score input** — large centered numeric field; `0–3,000` validation (clamp or warn above max).
3. **Submit** (unsubmitted rows) — persist that team's Mentor score; lock input; switch button to **Undo**.
4. **Undo** (submitted rows) — delete that team's Mentor vote row; unlock input. **Disabled** while Winner announcement is displayed (§8.9).
5. **Saved indicator** — when locked, show `Saved: N` under the team name (visible to Mentor only).

- Enter key in an unlocked input submits that row.
- No batch submit.

**Section 2 — Pain Point tap-to-vote (§3.3):**

Same interaction pattern as team-rep voting (§8.4), with these differences:

- **All 4 team cards** are tappable (Mentor has no "own team").
- Instruction: e.g. "Tap the team to award your Pain Point vote — one vote worth 1,000 marks."
- **On tap** (no active Pain Point vote): open **confirmation dialog** (§8.7)
  - Message: confirm casting the Pain Point vote (1,000 marks) to the chosen team
  - **Confirm** → persist vote (`from_team = 'Pain Point Marks'`, `points = 1000`); lock other cards; show voted state + **Undo Vote**
  - **Cancel** → close dialog, no vote
- **After vote:** highlight chosen team; show "✓ Pain Point vote — 1,000 marks to [Team X]"; other cards disabled.
- **Undo Vote:** delete Pain Point vote row; unlock all four cards.
- **While Winner announcement displayed (§8.9):** all cards and **Undo Vote** disabled.

**While Winner announcement displayed:** all Mentor **Submit** / **Undo** and Pain Point cards / **Undo Vote** disabled; hint text notes scoring is locked.

**Returning users:** pre-fill and lock Mentor numeric rows from `myRoleScores`; restore Pain Point voted state from `myPainPointVote` (unless announcement is displayed).

### 8.6 Toast notifications

- Bottom-right, 3s auto-hide; error style for failures



### 8.7 Vote confirmation dialog (team reps & Pain Point vote)

- Modal overlay triggered by tap on an eligible team card (team rep §8.4 or Mentor Pain Point §8.5)
- Shows chosen team name/emoji and fixed 1,000 marks
- Team rep copy: e.g. "Cast your vote (1,000 marks) to [Team X]?"
- Pain Point copy: e.g. "Cast your Pain Point vote (1,000 marks) to [Team X]?"
- Confirm / Cancel buttons
- Blocks interaction with vote cards until dismissed



### 8.8 Interactive display (event screen)

Shown only for `interactive` keyword login (§4.6). Replaces the main voting/scoring content area; user bar (§8.3) remains visible above.

**Viewport constraint:**

- Entire Interactive layout (`#main-app.interactive-mode`) is capped at **3840 px** wide and **2160 px** tall (`INTERACTIVE_MAX_W`, `INTERACTIVE_MAX_H`), centered horizontally on ultra-wide displays; content scales down within the viewport on smaller screens.

**Hidden for Interactive:** team vote section (§8.4), Mentor panel (§8.5), assignment picker. Page title header (§8.3 area) **remains visible**.

**Phase 1 — Ready screen (`#interactive-ready`):**

```
┌────────────────────────────────────────────┐
│  (user bar)                                │
│                                            │
│     Are you ready to vote?                 │  ← large, colorful display type
│                                            │
│         [ Let's go! ]                      │  ← chunky CTA button
│                                            │
└────────────────────────────────────────────┘
```

- Shown immediately after Interactive login (unless session restored with `votingStarted: true`). **`#interactive-ready` is hidden for all non-Interactive users.**
- Caption: exact copy **"Are you ready to vote?"** — warm gradient (orange → gold → cream) with ink accents; avoids cool blues/teals that clash with the sky background (§7).
- **Let's go!** button: primary chunky CTA; single tap advances to Phase 2.
- No background music during this phase (MP3 assets preloaded only).

**Phase 2 — Voting screen (`#interactive-voting`):**

```
┌────────────────────────────────────────────┐
│  (user bar)                                │
│                                            │
│     Scan the QR Code below and start       │
│              voting.                       │  ← instruction above QR
│                                            │
│        ✨   ┌──────────────┐   🎉          │
│        🌟   │              │   ⭐          │
│             │   QR CODE    │               │
│        🎈   │  (large)     │   🏆          │
│             └──────────────┘               │
│                                            │
│      Voting in progress...                 │  ← animated text
│                                            │
└────────────────────────────────────────────┘
```

- **Transition:** on **Let's go!** tap, fade out Phase 1 (~400 ms) and fade in Phase 2 (~400 ms).
- **Instruction above QR:** exact copy **"Scan the QR Code below and start voting."**
- **QR code:** `images/vote-qr-code.png`, large and centered; chunky frame with **animated glow ring**, plus decorative emoji accents (corners and sides). **Animated background** behind the voting screen: shifting color gradients, soft drifting blobs, slow rotating light rays, and twinkling sparkles (cartoon game style, §7).
- **Audio:** start looping `sounds/vote_bgm.mp3` at the same time Phase 2 fades in (user gesture satisfies autoplay policy).
- **Status caption below QR:** starts as **"Voting in progress..."** with CSS animation (pulse, shimmer, or ellipsis cycle).
- **Completion detection:** voting is **complete** when all of the following are satisfied in the current `voteLog` / DB state:
  - Each of the **4 team slots** has cast its team-rep vote (`from_team` = `Team 1` … `Team 4`, one row each).
  - **Mentor** has submitted a score for **all 4 teams** (`from_team = 'Mentor'`, one row per target team).
  - **Pain Point Marks** vote has been awarded (`from_team = 'Pain Point Marks'`, one row).
- **Done control:** when complete, wait **5 seconds** (`INTERACTIVE_VOTING_DONE_MS`) with **no undo** (no vote `DELETE` that breaks completeness); then hide the status caption and show a large colorful animated button: **"Voting is done! And the winner is..."**. Tapping the button opens the Winner announcement overlay (§8.9). Any undo during the wait or after done reverts to **"Voting in progress..."**, restarts the 5-second stability window once complete again, and resumes `vote_bgm.mp3`.
- **Done audio:** when the done button appears, **stop** looping `sounds/vote_bgm.mp3` and **play once** `sounds/done_vote.mp3` (preloaded on login).
- Persists `votingStarted: true` in localStorage so reload skips Phase 1.

### 8.9 Winner announcement (Interactive only)

Full-screen overlay opened from the **"Voting is done! And the winner is..."** button (`#voting-done-btn`, §8.8). Uses current **#1 team** from vote totals (`getRanks()[0]`).

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

- **Open:** tap **"Voting is done! And the winner is..."** (§8.8) while Interactive; **fade out** `vote_bgm.mp3` over **1 second** (`VOTE_BGM_FADE_MS`) if still playing; then set `event_state.winner_announced = true` (locks all vote/score undo and submit on every client), open overlay, and start `champion.mp3` (§10).
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
- Toast if another user claimed a slot (e.g. "[user@email.com](mailto:user@email.com) claimed Team 2")



### `event_state` (INSERT/UPDATE)

- Set `winnerAnnounced` from `winner_announced` column
- Re-render voting UI so undo/submit controls reflect lock state on all clients

---



## 10. Audio & Visual Effects

Cartoon-game flavored effects — playful, not sci-fi. Align with §7.8 motion catalog.


| Event               | Effect                                                                   |
| ------------------- | ------------------------------------------------------------------------ |
| Team vote confirmed | Star burst from card + cheerful whoosh (Web Audio) |
| Score submitted     | Coin / point pop chime + mini star burst particles |
| Winner announcement | Confetti burst (8s auto-stop, `FW_DURATION_MS`)      |


**Synthesized UI sounds** (Web Audio): vote whoosh, coin pop — see table above. `AudioContext` resumed on first user gesture. Prefer bright sine/triangle tones (coin pickup, level-up) over dark sawtooth whoosh.

**MP3 loops (Interactive mode only):**


| When                             | Asset                 | Behavior                                                                                        |
| -------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| Interactive login                | `sounds/vote_bgm.mp3`, `sounds/champion.mp3`, `sounds/done_vote.mp3` | Preload all on login; **no playback** until **Let's go!** (§8.8)                               |
| Interactive voting screen (§8.8) | `sounds/vote_bgm.mp3`                                                | Loop until voting done (§8.8) or logout                                                        |
| Voting complete (§8.8)           | `sounds/done_vote.mp3`                                               | Stop `vote_bgm.mp3`; play **once** when done button appears                                    |
| Winner announcement open (§8.9) | `sounds/champion.mp3`                        | Fade out `vote_bgm.mp3` over 1s; then open overlay and loop `champion.mp3` until overlay closed |
| Winner announcement closed       | —                     | Stop `champion.mp3` only; do **not** resume `vote_bgm.mp3`                                      |


Use HTML5 `Audio` with `loop: true` for BGM and `preload: auto`. On Interactive login, call `preloadInteractiveSounds()` to buffer `vote_bgm.mp3`, `champion.mp3`, and `done_vote.mp3` **without playing**. Reuse cached `Audio` elements for `startVoteBgm()` (on **Let's go!**, §8.8), `playDoneVoteSound()` (voting complete, §8.8), and `startChampionBgm()` (§8.9). Release cached elements on Interactive logout; stop champion and done_vote audio on overlay close / logout.

---



## 11. Configuration Constants

```javascript
TEAM_VOTE_PTS         = 1000   // fixed marks for team rep single vote
PAIN_POINT_VOTE_PTS   = 1000   // fixed marks for Mentor Pain Point single vote (§3.3)
MENTOR_MIN_PTS        = 0
MENTOR_MAX_PTS        = 3000   // per team, Mentor numeric scoring
FW_DURATION_MS        = 8000     // confetti burst duration
POLL_MS               = 4000     // polling fallback interval
VOTE_BGM_FADE_MS      = 1000     // vote BGM fade-out before winner overlay (§8.9)
INTERACTIVE_MAX_W     = 3840     // max Interactive viewport width (§8.8)
INTERACTIVE_MAX_H     = 2160     // max Interactive viewport height (§8.8)
INTERACTIVE_QR_IMAGE  = 'images/vote-qr-code.png'
INTERACTIVE_VOTING_DONE_MS = 5000   // stability window before done button (§8.8)
STORAGE_KEY           = 'lv_session_v2'
INTERACTIVE_EMAIL     = 'interactive'  // reserved login keyword (§4.6)
MENTOR_EMAIL          = 'mentor'       // reserved login keyword (§4.4)
USE_SUPABASE          = true

TEAMS = [ /* 4 teams — see §2.1 */ ]
ROLES = [ /* 2 roles — see §2.2 */ ]
SLOT_KEYS = [ 'team:1', 'team:2', 'team:3', 'team:4',
              'role:mentor', 'role:pain_point_marks' ]
```

Supabase credentials: `SUPABASE_URL`, `SUPABASE_KEY` (anon/public key).

---



## 12. Constraints & Edge Cases

1. **One slot per email user:** an email user may hold only one team slot (`team:1`–`team:4`); enforced by unique email index and UI. `mentor` keyword login holds both `role:mentor` and `role:pain_point_marks` under identifier `mentor`.
2. **One user per slot:** once claimed, slot locked; other users see email under that option in the assignment dialog.
3. **Team rep — one active vote:** after confirm, other cards locked; **Undo Vote** deletes row and allows a new choice. Disabled while Winner announcement is displayed (§8.9).
4. **Team rep — cannot vote for self:** own team card is locked and never opens the confirmation dialog.
5. **Team rep — fixed 1,000:** no variable amount; `points` always `1000` in DB.
6. **Mentor numeric — per-team cap:** reject or clamp scores outside 0–3,000.
7. **Pain Point Marks — one active vote:** after confirm, other cards locked; **Undo Vote** deletes row and allows a new choice. Disabled while Winner announcement is displayed (§8.9).
8. **Pain Point Marks — fixed 1,000:** no variable amount; `points` always `1000` in DB; `from_team = 'Pain Point Marks'`.
9. **Mentor numeric score changes:** undo deletes row; must re-submit (no in-place edit). Disabled while Winner announcement is displayed (§8.9).
10. **Winner announcement lock:** while §8.9 overlay is open (`event_state.winner_announced = true`), all team **Undo Vote**, Mentor **Submit** / **Undo**, and Pain Point **Undo Vote** controls are disabled on every client.
11. **Race on slot claim:** check existing session before insert; refresh dialog on failure.
12. **Logout ≠ unlock:** session row stays so email can return; other emails blocked.
13. **UI updates during editing:** scoring UI frozen while confirmation dialog open or role inputs active.
14. **Email display:** claimer email must appear under locked options in the assignment dialog.

---



## 13. Tech Stack

- Single-page HTML + inline CSS + vanilla JS
- Supabase JS v2 (ESM from jsDelivr CDN)
- Google Fonts: **Fredoka** or **Bangers** (display) + **Nunito** (body) — see §7.3
- No build step; static hosting (GitHub Pages)
- Optional canvas layer for confetti/particles (fixed, `pointer-events: none`)

---



## 14. Out of Scope (current system)

- No live standings chart, vote status board, or champion banner (removed)
- No admin dashboard separate from the app
- No vote audit export
- No authentication beyond email string or reserved login keywords (`interactive`, `mentor`)
- No automatic session expiry / slot release
- RLS is wide open (demo mode)
- No secret admin edit panel (removed from original keypad model)

---



## 15. File Reference


| File              | Role                                                  |
| ----------------- | ----------------------------------------------------- |
| `index.html.bak`  | Original full implementation (archived; 6-team model) |
| `CNAME`           | Custom domain for GitHub Pages                        |
| `SCORING_SPEC.md` | This document                                         |


---



## 16. Changelog from `index.html.bak`


| Area               | Old                                 | New                                                                                                   |
| ------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Teams              | 6 teams                             | 4 teams (Team 1–4)                                                                                    |
| Post-login         | Team picker or Viewer               | Email → team picker (4 teams only); `mentor` keyword → consolidated Mentor + Pain Point Marks UI      |
| Assignments        | Team or Viewer                      | 6 slots in DB (4 teams + 2 roles); email users pick teams only; both role slots via `mentor` keyword  |
| Roles              | None                                | Mentor + Pain Point Marks (single `mentor` keyword login, consolidated UI §8.5)                       |
| Viewer mode        | Explicit button on auth screen      | **Removed** — use `interactive` keyword for read-only display (§4.6)                                  |
| Interactive mode   | —                                   | Reserved keyword `interactive` + Continue; two-phase event display (§8.8), BGM on **Let's go!**, winner overlay (§8.9) |
| Mentor entry       | —                                   | Reserved keyword `mentor` + Continue; claims both role slots; consolidated scoring panel (§8.5)       |
| Session PK         | `team_id` int                       | `slot_key` text                                                                                       |
| Chart labels       | Team name only                      | *(removed — no live standings chart)*                                                                 |
| Vote status board  | Participation matrix                | *(removed)*                                                                                           |
| Dialog taken state | "🔒 Taken" only                     | 🔒 + claimer email under option                                                                       |
| Team rep voting    | Up to 5 votes, 1–5,000 each, keypad | **1 active vote**, fixed **1,000**, tap + confirm + **Undo Vote** (locked during winner announcement) |
| Mentor             | Observer only                       | **0–3,000** per team via consolidated UI (§8.5)                                                       |
| Pain Point Marks   | Bonus row only                      | Single tap-to-vote in Mentor UI (§8.5); fixed **1,000** marks                                         |
| Bonus layer        | Separate `__BONUS__` sentinel       | Removed; all scores in `votes` table                                                                  |
| Score entry        | Keypad for team reps                | Tap-to-vote (team reps + Pain Point); numeric inputs (Mentor marks only, §8.5)                        |
| Visual theme       | Dark sci-fi (Orbitron, neon)        | **Cartoon Game Leaderboard** (§7) — sky bg, chunky UI, Fredoka/Nunito                                 |


