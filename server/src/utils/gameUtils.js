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

export const normalizeUsername = (username) =>
  username ? username.toString().toLowerCase() : username;

/**
 * Builds a version key string from gameId and versionId.
 * @param {number|string} gameId - The game ID
 * @param {number|string|null|undefined} versionId - The version ID (can be -1, null, or undefined for default)
 * @returns {string} Version key in format "gameId-versionId" or "gameId-default"
 */
export const buildVersionKey = (gameId, versionId) => {
  const normalizedVersionId = versionId !== -1 && versionId !== null && versionId !== undefined 
    ? versionId 
    : 'default';
  return `${gameId}-${normalizedVersionId}`;
};


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

