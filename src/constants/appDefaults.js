export const MOBILE_BREAKPOINT = 768;

export const DEFAULT_SORTING_RULES = [
  { field: 'gameName', enabled: true, order: 'asc' },
  { field: 'versionName', enabled: false, order: 'asc' },
  { field: 'gameId', enabled: false, order: 'asc' },
  { field: 'versionId', enabled: false, order: 'asc' },
  { field: 'bggRank', enabled: false, order: 'asc' },
  { field: 'minPlayers', enabled: false, order: 'asc' },
  { field: 'maxPlayers', enabled: false, order: 'asc' },
  { field: 'bestPlayerCount', enabled: false, order: 'asc' },
  { field: 'minPlaytime', enabled: false, order: 'asc' },
  { field: 'maxPlaytime', enabled: false, order: 'asc' },
  { field: 'age', enabled: false, order: 'asc' },
  { field: 'communityAge', enabled: false, order: 'asc' },
  { field: 'weight', enabled: false, order: 'asc' },
  { field: 'bggRating', enabled: false, order: 'desc' },
  { field: 'categories', enabled: false, order: 'asc' },
  { field: 'families', enabled: false, order: 'asc' },
  { field: 'mechanics', enabled: false, order: 'asc' },
];

export const DEFAULT_SORTING_BY_FIELD = DEFAULT_SORTING_RULES.reduce((accumulator, rule) => {
  accumulator[rule.field] = rule;
  return accumulator;
}, {});

export const DEFAULT_ENABLED_SORTING_FIELDS = DEFAULT_SORTING_RULES.filter(
  (rule) => rule.enabled
).map((rule) => rule.field);

export const SORTING_LABELS = {
  gameName: 'Game Name',
  versionName: 'Version Name',
  gameId: 'Game ID',
  versionId: 'Version ID',
  bggRank: 'BGG Rank',
  minPlayers: 'Min Players',
  maxPlayers: 'Max Players',
  bestPlayerCount: 'Best Player Count',
  minPlaytime: 'Min Playtime',
  maxPlaytime: 'Max Playtime',
  age: 'Age',
  communityAge: 'Community Age',
  weight: 'Weight',
  bggRating: 'BGG Rating',
  categories: 'Categories',
  families: 'Families',
  mechanics: 'Mechanics',
};

export const COLLECTION_STATUSES = [
  { key: 'own', label: 'Own' },
  { key: 'preordered', label: 'Pre-Ordered' },
  { key: 'wanttoplay', label: 'Want To Play' },
  { key: 'prevowned', label: 'Previously Owned' },
  { key: 'fortrade', label: 'For Trade' },
  { key: 'want', label: 'Want' },
  { key: 'wanttobuy', label: 'Want To Buy' },
  { key: 'wishlist', label: 'Wishlist' },
];

export const DEFAULT_COLLECTION_FILTERS = COLLECTION_STATUSES.reduce((acc, status) => {
  acc[status.key] = status.key === 'own' ? 'include' : 'neutral';
  return acc;
}, {});

export const FILTER_PANEL_KEYS = ['preferences', 'collections', 'sorting'];

export const DEFAULT_FILTER_PANEL_STATE = FILTER_PANEL_KEYS.reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {});

export const createDefaultSortingRules = () =>
  DEFAULT_SORTING_RULES.map((rule) => ({ ...rule }));

export const createDefaultCollectionFilters = () => ({
  ...DEFAULT_COLLECTION_FILTERS,
});

export const createDefaultFilterPanelState = () => ({
  ...DEFAULT_FILTER_PANEL_STATE,
});

