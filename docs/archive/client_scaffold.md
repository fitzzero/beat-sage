## Client Scaffold Plan (MVP)

This plan implements the initial client scaffolding aligned with the Beat Sage MVP spec (`docs/plans/beat_sage_initial_spec.md`). It focuses on the "Pending" instance state and party setup flow. Rendering of the active in-game scene will follow in a separate plan (`docs/plans/graphics_spec.md`).

### Objectives

- Replace Chat-first UI with a Game-first landing and navigation.
- Provide a clean, extensible foundation using existing layout/components, hooks architecture, and shared types.
- Implement the party/instance pending flow: select character, form a party, choose song/location, toggle ready, and be prepared to start an instance.

### Principles

- Use `client/app/components/layout/MainLayout.tsx` and `GlobalSideMenu.tsx` for shell.
- Follow `client-components-scaffold` and `client-ui` rules for layout/spacing/colors and responsiveness.
- Follow `service-hooks` rules for socket/service integration and naming; export types from `shared/types.ts` instead of redefining them [[memory:7042491]] [[memory:7042359]].
- Keep components small and composable; no bespoke CSS; rely on MUI props and theme.
- Default to Yarn Workspaces and commit gating with typecheck/lint/tests before commits [[memory:7043274]].

---

### Navigation updates (GlobalSideMenu)

Edits in `client/app/components/layout/GlobalSideMenu.tsx`:

- Remove the existing Chat nav section entirely.
- Rename "Home" to "Game" and keep the route at `/`.
- Add a new "Characters" accordion section:
  - Details shows up to 3 most recent characters via `characterService:listMine({ pageSize: 3 })`.
  - Each item routes to `/character/[id]`.
  - A "Create Character" button appears under the list; opens the create flow (modal) or links to `/characters` page (MVP: modal to create quickly; fallback link acceptable).
- Add a "Songs" item → `/songs` (index/search coming later).
- Add a "Map" item → `/map` (public location list/preview coming later).

Implementation notes:

- Create `client/app/components/layout/RecentCharacters.tsx` modeled after `RecentChats.tsx` to render the Characters accordion details.
- Use `useServiceMethod("characterService", "listMine")` helper inside `RecentCharacters`. Avoid embedding socket logic inside the component; keep it to hooks per rules.
- Keep Drawer behavior unchanged (permanent on desktop; `SwipeableDrawer` on mobile). Use `ListItemButton component={Link}`.

---

### Routes & Pages

- `/` → Game landing (Party landing). Uses `MainLayout` and wraps content in `GameContext` provider.
- `/character/[id]` → Character detail stub page (shows character card and actions; will expand later).
- `/characters` → Characters index stub (list mine + create character entrypoint).
- `/songs` → Songs index/search stub (list songs, filter by genre).
- `/map` → Map/locations index stub (list locations; show selected details/images).

Scaffold pages minimally with loading/empty/error states and use `Container` from layout (avoid nested `Container`).

---

### GameContext (shared party/instance state)

Create `client/app/game/GameContext.tsx` and `client/app/game/useGame.ts`:

- Responsibilities

  - Hold the player's selected character (and helper to change it later).
  - Subscribe to current `Party` and members (characters) via `partyService:subscribeWithMembers`.
  - Subscribe to current `Instance` snapshot (MVP: pending state only; later: active loop snapshots).
  - Hold currently selected Song and Location for the pending instance (from party/instance state; if not present, allow host to select).
  - Expose actions: `setReady`, `invitePlayers` (copy link), `leaveParty`, `joinParty`, `selectSong`, `selectLocation`, `createInstanceIfReady`.
  - Compute `isHost` (party.hostCharacterId === myCharacterId) and `canStart` predicates.

- API shape (context value)

  - `character`, `setCharacterId(id)`
  - `party`, `members` (characters resolved by id)
  - `instance` (pending snapshot), `status`
  - `song`, `location`
  - `isHost`, `isReady`, `canSelect`, `canStart`
  - Actions: `{ setReady, invitePlayers, leaveParty, joinParty, selectSong, selectLocation }`

- Lifecycle
  - On mount: ensure a party exists for the user (server auto-creates or create on first need). If a `partyId` param is present in URL, try `joinParty`.
  - Subscribe to party and instance after party is known.
  - Unsubscribe on unmount.

Implementation notes:

- Keep context lean; do not embed UI concerns. Return an SWR-like shape (`{ data, isLoading, error }`) for async fetches when helpful.
- Store clipboard invite link as `${NEXTAUTH_URL || window.location.origin}/?partyId=<id>`.
- For MVP, treat `song` and `location` as instance-level selections persisted by server mutations (see Server gaps below).

---

### Game page layout (Pending state)

File: `client/app/page.tsx` (use `MainLayout`)

Sections:

1. Party actions row

   - `Ready` toggle button → `partyService:setReady`.
   - `Invite Players` → copies party URL; ephemeral toast.
   - `Leave Party` → `partyService:leaveParty`.

2. Instance info row (two columns)

   - Left column: Song info; if host, show `Select song` button (opens `SongSelectDialog`).
   - Left column: Location info; if host, show `Select location` button (opens `LocationSelectDialog`).
   - Location flavor text under location name.
   - Right column: location image placeholder (kept responsive via `Box` ratio or `Image`).

3. Party information row
   - First column: Primary user's character card.
   - Horizontal scroll list for additional members.

Components to add under `client/app/game/components/`:

- `PartyActions.tsx`
- `InstanceInfo.tsx` (composes `SelectedSongCard`, `SelectedLocationCard`)
- `CharacterCard.tsx` (user avatar, character placeholder image, name)
- `PartyMembersRow.tsx`
- `SongSelectDialog.tsx`
- `LocationSelectDialog.tsx`

Use MUI `Stack` for rows/columns; prefer theme spacing and tokens (no hardcoded px).

---

### Hooks to add (client)

Under `client/app/hooks/` following `service-hooks` conventions:

- `character/useCharacterMethods.ts`

  - `listMine`
  - `createCharacter`
  - `updateCharacter`
  - `useCharacterSub` (by id)

- `party/usePartyMethods.ts`

  - `createParty`, `joinParty`, `leaveParty`, `setReady`, `subscribeWithMembers`

- `instance/useInstanceMethods.ts`

  - `createInstance`, `startInstance`, `subscribe`

- `song/useSongMethods.ts`

  - `listSongs`, `getSongBeats` (for later)

- `location/useLocationMethods.ts`
  - `listLocations`

Export all from `client/app/hooks/index.ts` and keep client method payload/response types from `shared/types.ts` [[memory:7042491]] [[memory:7042359]].

---

### Server integration & gaps (to stage during client work)

Current server methods in `shared/types.ts` cover MVP basics. To support pending flow cleanly, verify or add:

- `partyService:subscribeWithMembers` returns `{ hostCharacterId, members: Array<{ characterId, isReady }> }` (already specified in spec).
- `instanceService:createInstance` accepts `{ partyId, locationId, songId }` and returns `{ id, status }`.
- Optional helpers for pending selections if not embedded in party/instance yet:
  - `partyService:setPendingSong({ partyId, songId })`
  - `partyService:setPendingLocation({ partyId, locationId })`
  - Alternatively, keep selections only within `instanceService:createInstance` (host picks both, then creates pending instance). MVP: prefer minimal surface by creating the instance when both selections exist; store on `Instance`.

ACL expectations (MVP):

- Party read for members; host-only mutations for selection/creation.
- `setReady` allowed for any party member.

---

### UI/UX details

- Loading/empty/error states

  - Characters: show skeleton list; empty state CTA to create a character.
  - Party: if absent, auto-create or prompt to create on first action.
  - Instance: when absent, show selection prompts; when pending, show selections; when active, route/flip to active view.

- Responsiveness

  - Use `Stack` and responsive `sx` values; avoid inline media queries.
  - Party members row uses horizontal scroll with snap.

- Accessibility
  - Ensure interactive elements have labels; dialogs are focus-trapped; keyboard accessible.

---

### QA & Testing

- Unit-light, integration-first.
- Manual QA with Playwright MCP (shared browser):

  1. Navigate to `/` (Game). Sign in if needed.
  2. Ensure Characters panel shows up to 3 recent characters; create one if none exist.
  3. Verify party actions render; Ready/Unready toggles via socket ack.
  4. Open Song/Location dialogs and make selections (stubs acceptable initially; wire to real list endpoints).
  5. Verify invite link copies and a second browser can join via URL (joins same party).

- Automated checks (incremental):
  - Smoke test that `/`, `/songs`, `/map`, `/character/[id]` render under auth.
  - Hook-level tests for method calls with mocked socket layer (optional if covered by server integration tests).

---

### Phased implementation plan

1. Nav shell

   - Remove Chat, rename Home→Game, add Characters/Songs/Map.
   - Add `RecentCharacters` in side menu.

2. Hooks

   - Add character/party/instance/song/location method hooks per above and export.

3. GameContext + Game page

   - Implement context with subscriptions + actions; mount on `/`.
   - Scaffold `PartyActions`, `InstanceInfo`, `PartyMembersRow`, dialogs.

4. Stub pages

   - `/character/[id]`, `/characters`, `/songs`, `/map` minimal UIs.

5. Wire selections

   - Song/Location dialogs list from services; on select, persist (either via instance create or party pending setters per server choice).

6. QA pass (Playwright MCP)
   - Validate end-to-end pending flow.

---

### Acceptance criteria (MVP Pending)

- Side menu reflects Game-first nav; Characters accordion loads and links work.
- Game page shows party actions, instance selection prompts, and party member cards.
- Host can select song and location (UI + service calls wired).
- Ready/Invite/Leave actions work via service methods.
- Joining via invite URL places the second user in the party.
- No ESLint/type errors; minimal layout is responsive and accessible.

---

### Follow-ups (separate plans)

- Active instance rendering per `docs/plans/graphics_spec.md`.
- Post-game summary screen and continue flow.
- Character management (equipment, cosmetics), song search/filters, map details.
- Party invites UI polish and permissions surface.
