export const MOBILE_BREAKPOINT = 768;

export const DEFAULT_STACKING = 'vertical';

export const STACKING_OPTIONS = ['horizontal', 'vertical'];

export const DEFAULT_COLLAPSED_BADGE_LIMIT = 4;

export const PRINT_TWO_COLUMN_GAME_THRESHOLD = 11;

export const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Master definition of all sorting fields.
 * This is the single source of truth for sorting field definitions.
 * Contains field name, display label, and default sorting configuration.
 */
export const SORTING_FIELD_DEFINITIONS = [
  { field: 'gameName', label: 'Game Name', defaultEnabled: true, defaultOrder: 'asc' },
  { field: 'versionName', label: 'Version Name', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'bggRank', label: 'BGG Rank', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'bggWeight', label: 'BGG Weight (Complexity)', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'bggRating', label: 'BGG Rating', defaultEnabled: false, defaultOrder: 'desc' },
  { field: 'categories', label: 'Categories', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'families', label: 'Families (Themes) / Languages', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'mechanics', label: 'Mechanics', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'numplays', label: 'Number of Plays', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'minPlayers', label: 'Min Players', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'maxPlayers', label: 'Max Players', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'bestPlayerCount', label: 'Best Player Count (Community)', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'minPlaytime', label: 'Min Playtime', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'maxPlaytime', label: 'Max Playtime', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'age', label: 'Minimum Age (Publisher)', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'communityAge', label: 'Minimum Recommended Community Age', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'languageDependence', label: 'Language Dependence', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'volume', label: 'Volume', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'area', label: 'Area (Smallest Edge)', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'weight', label: 'Weight (Physical)', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'gamePublishedYear', label: 'Game Published Year', defaultEnabled: false, defaultOrder: 'asc' },
  { field: 'versionPublishedYear', label: 'Version Published Year', defaultEnabled: false, defaultOrder: 'asc' },
];



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
  SORTING_FIELD_DEFINITIONS.map((def) => ({
    field: def.field,
    enabled: def.defaultEnabled,
    order: def.defaultOrder,
  }));

export const createDefaultCollectionFilters = () => ({
  ...DEFAULT_COLLECTION_FILTERS,
});

export const createDefaultFilterPanelState = () => ({
  ...DEFAULT_FILTER_PANEL_STATE,
});

