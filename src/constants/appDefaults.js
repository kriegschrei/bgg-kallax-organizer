export const MOBILE_BREAKPOINT = 768;

export const DEFAULT_PRIORITIES = [
  { field: 'name', enabled: true, order: 'asc' },
  { field: 'categories', enabled: false, order: 'asc' },
  { field: 'families', enabled: false, order: 'asc' },
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
];

export const DEFAULT_PRIORITIES_BY_FIELD = DEFAULT_PRIORITIES.reduce((accumulator, priority) => {
  accumulator[priority.field] = priority;
  return accumulator;
}, {});

export const DEFAULT_ENABLED_PRIORITY_FIELDS = DEFAULT_PRIORITIES.filter(
  (priority) => priority.enabled
).map((priority) => priority.field);

export const PRIORITY_LABELS = {
  name: 'Name',
  categories: 'Categories',
  families: 'Families',
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

export const FILTER_PANEL_KEYS = ['preferences', 'collections', 'priorities'];

export const DEFAULT_FILTER_PANEL_STATE = FILTER_PANEL_KEYS.reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {});

export const createDefaultPriorities = () =>
  DEFAULT_PRIORITIES.map((priority) => ({ ...priority }));

export const createDefaultCollectionFilters = () => ({
  ...DEFAULT_COLLECTION_FILTERS,
});

export const createDefaultFilterPanelState = () => ({
  ...DEFAULT_FILTER_PANEL_STATE,
});

