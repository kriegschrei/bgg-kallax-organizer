export const slugifyName = (name) => {
  if (!name || typeof name !== 'string') {
    return 'game';
  }

  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'game'
  );
};

export const buildVersionsUrl = (gameId, gameName) => {
  const slug = slugifyName(gameName);
  return `https://boardgamegeek.com/boardgame/${gameId}/${slug}/versions`;
};

export const buildCorrectionUrl = (versionId) => {
  if (!versionId) {
    return null;
  }
  return `https://boardgamegeek.com/item/correction/boardgameversion/${versionId}`;
};

export const buildGameCorrectionUrl = (gameId) => {
  if (!gameId) {
    return null;
  }
  return `https://boardgamegeek.com/item/correction/boardgame/${gameId}`;
};

export const extractVersionId = (game, fallbackVersionId = null) => {
  if (game?.selectedVersionId) {
    return game.selectedVersionId;
  }

  if (game?.id && typeof game.id === 'string' && game.id.includes('-')) {
    const parts = game.id.split('-');
    const possibleVersionId = parts[parts.length - 1];
    if (
      possibleVersionId &&
      possibleVersionId !== 'default' &&
      possibleVersionId !== 'no-version'
    ) {
      return possibleVersionId;
    }
  }

  if (
    fallbackVersionId &&
    fallbackVersionId !== 'default' &&
    fallbackVersionId !== 'no-version'
  ) {
    return fallbackVersionId;
  }

  return null;
};

export const extractVersionLabelFromName = (name) => {
  if (!name || typeof name !== 'string') {
    return null;
  }

  const match = name.trim().match(/\(([^()]+)\)\s*$/);
  if (!match) {
    return null;
  }

  const label = match[1]?.trim();
  return label && label.length > 0 ? label : null;
};

export const extractBaseGameId = (game) => {
  if (!game) return null;
  if (game.baseGameId && /^\d+$/.test(game.baseGameId)) {
    return game.baseGameId;
  }
  if (game.id) {
    const idPart = game.id.split('-')[0];
    if (idPart && /^\d+$/.test(idPart)) {
      return idPart;
    }
  }
  if (game.gameId && /^\d+$/.test(game.gameId)) {
    return game.gameId;
  }
  return null;
};

export const normalizeUsername = (username) =>
  username ? username.toString().toLowerCase() : username;

export const COLLECTION_STATUS_KEYS = [
  'own',
  'preordered',
  'wanttoplay',
  'prevowned',
  'fortrade',
  'want',
  'wanttobuy',
  'wishlist',
];

export const COLLECTION_STATUS_SET = new Set(COLLECTION_STATUS_KEYS);

export const isStatusActive = (value) => {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === '1' ||
      normalized === 'true' ||
      normalized === 'yes' ||
      normalized === 'y'
    ) {
      return true;
    }
    if (
      normalized === '' ||
      normalized === '0' ||
      normalized === 'false' ||
      normalized === 'no' ||
      normalized === 'n'
    ) {
      return false;
    }
    const numeric = Number.parseFloat(normalized);
    if (Number.isFinite(numeric)) {
      return numeric !== 0;
    }
  }
  return Boolean(value);
};

