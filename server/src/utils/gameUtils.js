import he from 'he';

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

/**
 * Builds both correctionUrl and versionsUrl for a game.
 * @param {number|string} gameId - The game ID
 * @param {number|string|null} versionId - The version ID (optional)
 * @param {string} gameName - The game name for URL slug generation
 * @returns {Object} Object with correctionUrl and versionsUrl properties
 */
export const buildGameUrls = (gameId, versionId, gameName) => {
  const slug = slugifyName(gameName);
  const versionsUrl = `https://boardgamegeek.com/boardgame/${gameId}/${slug}/versions`;
  
  const correctionUrl =
    versionId && versionId > 0
      ? `https://boardgamegeek.com/item/correction/boardgameversion/${versionId}`
      : `https://boardgamegeek.com/item/correction/boardgame/${gameId}`;
  
  return { correctionUrl, versionsUrl };
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

/**
 * Unescapes HTML/XML entities and escaped characters in a string.
 * Uses the 'he' library for robust HTML entity decoding.
 * Also handles backward compatibility with \' escape sequence.
 * @param {*} value - The value to unescape
 * @returns {string|*} The unescaped string or the original value if not a string
 */
export const unescapeName = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  // Handle backward compatibility: \' → '
  const normalized = value.replace(/\\'/g, "'");
  
  // Use he.decode to handle all HTML/XML entities
  return he.decode(normalized);
};

/**
 * Gets the game name from a game object, falling back to gameId if not available.
 * @param {Object} game - The game object
 * @param {string|number|null} fallbackGameId - The game ID to use in fallback (optional)
 * @returns {string} The game name or fallback ID string
 */
export const getGameName = (game, fallbackGameId = null) => {
  return game?.gameName || game?.name || (fallbackGameId ? `ID:${fallbackGameId}` : `ID:${game?.gameId || 'Unknown'}`);
};

/**
 * Creates a display name from gameName and versionName.
 * Returns "gameName (versionName)" if versionName exists, otherwise just "gameName".
 * Falls back to gameId if gameName is not available.
 */
export const createDisplayName = (game, fallbackGameId = null) => {
  const gameName = game?.gameName || game?.name || (fallbackGameId ? `ID:${fallbackGameId}` : 'Unknown Game');
  const versionName = game?.versionName || null;
  return versionName ? `${gameName} (${versionName})` : gameName;
};

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

