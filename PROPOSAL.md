# Proposal: Group Expansions with Base Games & Group Series

## BGG API Analysis

### Expansion-to-Base Game Relationships
**Finding:** The BGG API provides expansion relationships through link elements in the `/thing` endpoint (game details), NOT in the collection endpoint.

- **Link Type:** `boardgameexpansion`
- **Structure:** `<link type="boardgameexpansion" id="BASE_GAME_ID" value="Base Game Name" />`
- **Location:** Available when fetching game details via `/thing?id=...`
- **Important:** The link's `id` attribute contains the base game ID that this expansion belongs to

### Series/Family Relationships
**Finding:** Games can be grouped by series using `boardgamefamily` links.

- **Link Type:** `boardgamefamily` (we're already extracting these, but only names)
- **Structure:** `<link type="boardgamefamily" id="FAMILY_ID" value="Family Name" />`
- **Location:** Available in both collection and `/thing` endpoints
- **Important:** We need to extract the `id` attribute (not just `value`) to properly group games by series

### Current State
- ✅ We extract `boardgamefamily` links but only store the `value` (name), not the `id`
- ❌ We don't extract `boardgameexpansion` links at all
- ✅ We already fetch game details via `/thing` endpoint, so expansion links should be available

## Proposed Implementation

### 1. Data Extraction Changes

#### 1.1 Extract Expansion Relationships
**Location:** `server/server.js` - `processGameItem()` function

**Changes:**
- Extract `boardgameexpansion` links from game items
- Store `baseGameId` on expansion games (or `null` if not an expansion or base game not in collection)
- Extract `boardgamefamily` link IDs (not just values) for series grouping

**New fields to add to game objects:**
```javascript
{
  baseGameId: null | string,  // ID of base game if this is an expansion
  isExpansion: boolean,        // True if this game is an expansion
  familyIds: string[],         // Array of family/series IDs this game belongs to
  // ... existing fields
}
```

#### 1.2 Update `extractGameData()` in `cache.js`
- Also extract expansion and family ID relationships for caching

### 2. UI Changes

#### 2.1 Add New Checkboxes
**Location:** `src/App.jsx`

**New state variables:**
```javascript
const [groupExpansions, setGroupExpansions] = useState(false);
const [groupSeries, setGroupSeries] = useState(false);
```

**New checkboxes:**
1. **"Group Expansions with Base Game"**
   - Only enabled when `includeExpansions === true`
   - Place it right after the "Include expansions" checkbox
   - Tooltip: "Keep expansions with their base game in the same cube when possible"

2. **"Group Series"**
   - Always available (independent of expansions)
   - Tooltip: "Keep games from the same series together in the same cube"

#### 2.2 Update API Call
**Location:** `src/App.jsx` - `handleSubmit()` and `src/services/bggApi.js` - `fetchPackedCubes()`

Add new query parameters:
- `groupExpansions`
- `groupSeries`

### 3. Server-Side Grouping Logic

#### 3.1 Create Grouping Functions
**Location:** `server/server.js` - New functions before `packGamesIntoCubes()`

**Function: `groupExpansionsWithBaseGames(games, allGameIds)`**
- Creates groups where base games and their expansions are grouped together
- Only groups expansions if the base game is in the collection
- Returns: `Map<groupId, Game[]>` where groupId is the base game ID

**Function: `groupGamesBySeries(games)`**
- Groups games by their family IDs
- Games can be in multiple series (multiple family IDs)
- For games with multiple series, prioritize the most specific/less common series
- Returns: `Map<groupId, Game[]>` where groupId is the family ID

**Function: `createGameGroups(games, options)`**
- Combines expansion grouping and series grouping
- Handles games that belong to both an expansion group AND a series group
- Strategy: Expansion grouping takes priority (expansion groups are more specific)
- Returns: `{groups: Map<groupId, Game[]>, standaloneGames: Game[]}`

#### 3.2 Modify Packing Algorithm

**New Approach:**
1. Before packing, create game groups based on options
2. Calculate combined dimensions for each group (sum of areas)
3. If a group's total area exceeds cube size (128×128 = 16384 sq in), split the group:
   - Start with base game + largest expansions
   - Move smallest expansions to separate groups until each fits
4. Treat groups as single "meta-games" during initial packing
5. Within a cube, place grouped games near each other (prefer adjacent positions)

**Function: `calculateGroupDimensions(group)`**
- Sums the 2D footprint areas of all games in the group
- Returns combined dimensions if they fit in a cube, or `null` if too large

**Function: `splitOversizedGroup(group, maxArea)`**
- Splits a group that's too large for one cube
- Strategy:
  1. Keep base game (if expansion group) or largest game (if series group)
  2. Sort remaining games by area (descending)
  3. Add games until area limit reached
  4. Create new groups for remaining games
- Returns: `Game[][]` (array of groups)

**Modified: `packGamesIntoCubes()`**
- New parameters: `groupExpansions`, `groupSeries`
- Before packing:
  1. Create groups if options enabled
  2. Split oversized groups
  3. Create "meta-games" from groups (for packing algorithm)
- During packing:
  - When placing a meta-game, try to place all games in the group together
  - If group doesn't fit in one cube, fall back to individual placement
- After packing:
  - Try to move grouped games to be adjacent within their cubes

### 4. Implementation Details

#### 4.1 Expansion Grouping Logic
```
For each expansion game:
  1. Check if baseGameId exists and is in collection
  2. If yes, add to base game's group
  3. If base game not in collection, treat as standalone

Groups are keyed by baseGameId
```

#### 4.2 Series Grouping Logic
```
For each game:
  1. Extract all familyIds
  2. For each familyId:
     - Add game to that family's group
     - But only if groupExpansions is false or game is not in an expansion group

Groups are keyed by familyId
If a game has multiple families, it goes into the most specific one (fewer games)
```

#### 4.3 Combined Grouping (when both options enabled)
```
Priority order:
1. Expansion groups (highest priority - most specific)
2. Series groups (for games not in expansion groups)
3. Standalone games

A game can only be in ONE group at a time
```

#### 4.4 Splitting Oversized Groups
```
Algorithm:
1. Calculate total area of group
2. If area > 16384 sq in (128×128):
   a. Sort games by area (descending)
   b. Create first sub-group with base/largest game
   c. Add games until area limit would be exceeded
   d. Create new sub-groups for remaining games
   e. Recursively split any sub-group that's still too large
3. Return array of groups (each fits in one cube)
```

#### 4.5 Packing with Groups
```
Modified packing strategy:
1. Create meta-games from groups (virtual games with combined dimensions)
2. Pack meta-games using existing algorithm
3. When placing a meta-game:
   a. Try to find space for the entire group
   b. Calculate bounding box for all games in group
   c. Place games within that bounding box
   d. If group doesn't fit, fall back to individual placement
4. After initial placement, optimize positions to keep groups together
```

### 5. Edge Cases

1. **Expansion without base game:** Treat as standalone (don't group)
2. **Multiple expansions for same base:** All go in same group
3. **Game in multiple series:** Choose most specific (fewest games) series
4. **Oversized group:** Split into multiple groups, try to keep base game + largest expansions together
5. **Group doesn't fit in any cube:** Fall back to individual game placement
6. **Partial group placement:** If only some games from a group fit, still try to keep them together in the same cube

### 6. API Endpoint Changes

**Endpoint:** `GET /api/games/:username`

**New query parameters:**
- `groupExpansions` (boolean): Group expansions with base games
- `groupSeries` (boolean): Group games by series

**Response:** No changes needed (cubes structure remains the same, games are just positioned together)

### 7. Testing Considerations

1. Test with collections that have:
   - Expansions with base games
   - Expansions without base games (base not owned)
   - Games in series
   - Games in multiple series
   - Large expansion sets (many expansions for one base game)
   - Oversized groups (need splitting)

2. Verify:
   - Groups stay together when possible
   - Oversized groups split correctly
   - Performance impact is acceptable
   - No regression in existing packing logic

## Summary

This proposal adds two new grouping features:

1. **Group Expansions with Base Game:** When enabled and expansions are included, expansions are kept with their base games. Groups that exceed cube size are intelligently split.

2. **Group Series:** Games from the same series/family are kept together when possible.

Both features use the BGG API's existing link structure (`boardgameexpansion` and `boardgamefamily` with IDs) which is available in the game details we already fetch. The implementation modifies the packing algorithm to treat groups as cohesive units while handling edge cases like oversized groups and missing base games.

**Estimated Complexity:** Medium-High
- Requires changes to data extraction, grouping logic, and packing algorithm
- Need to handle splitting oversized groups intelligently
- Performance impact needs to be monitored

**Recommendation:** Implement in phases:
1. Phase 1: Data extraction (expansion/family IDs)
2. Phase 2: Basic grouping logic
3. Phase 3: Packing algorithm integration
4. Phase 4: Oversized group splitting
5. Phase 5: UI and testing

