import { parseInteger, parseFloat } from '../../utils/numberUtils.js';
import { ensureArray } from '../../utils/arrayUtils.js';
import { unescapeName, buildVersionKey } from '../../utils/gameUtils.js';
import { DEFAULT_DIMENSIONS } from '../../utils/gameProcessingHelpers.js';

const uniqueSortedValues = (values = []) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const extractBestPlayerCount = (item) => {
  const summaryResult = item['poll-summary']?.result;
  if (summaryResult) {
    const wasArray = Array.isArray(summaryResult);
    const summaryArray = ensureArray(summaryResult);
    const bestWith = summaryArray.find((result) => result?.$?.name === 'bestwith') || (!wasArray ? summaryResult : undefined);
    const value = bestWith?.$?.value;
    if (value) {
      const match = value.match(/(\d+)/);
      if (match) {
        return parseInteger(match[1], -1);
      }
    }
  }

  const poll = (item.poll || []).find((p) => p?.$?.name === 'suggested_numplayers');
  if (!poll) {
    return -1;
  }

  const results = poll.results;
  const entries = ensureArray(results);

  let bestCount = -1;
  let maxBestVotes = 0;

  for (const entry of entries) {
    const numPlayers = entry?.$?.numplayers;
    const bestResult = (entry?.result || []).find((r) => r?.$?.value === 'Best');
    if (bestResult) {
      const votes = parseInteger(bestResult.$?.numvotes, 0);
      if (votes > maxBestVotes) {
        maxBestVotes = votes;
        bestCount = parseInteger(numPlayers, -1);
      }
    }
  }

  return bestCount;
};

const calculateWeightedAverage = (results, { valueKey = 'value', weightKey = 'numvotes' } = {}) => {
  if (!results) {
    return -1;
  }

  const entries = ensureArray(results);

  let totalWeight = 0;
  let totalValue = 0;

  for (const entry of entries) {
    const weightRaw = entry?.$?.[weightKey];
    const valueRaw = entry?.$?.[valueKey];

    const weight = parseInteger(weightRaw, 0);
    const value = parseFloat(valueRaw, -1);

    if (weight > 0 && value >= 0) {
      totalWeight += weight;
      totalValue += value * weight;
    }
  }

  if (totalWeight === 0) {
    return -1;
  }

  return Math.round(totalValue / totalWeight);
};

const extractCommunityAge = (item) => {
  const poll = (item.poll || []).find((p) => p?.$?.name === 'suggested_playerage');
  if (!poll) {
    return -1;
  }

  return calculateWeightedAverage(poll.results?.result);
};

const extractLanguageDependence = (item) => {
  const poll = (item.poll || []).find((p) => p?.$?.name === 'language_dependence');
  if (!poll) {
    return -1;
  }

  return calculateWeightedAverage(poll.results?.result, { valueKey: 'level' });
};

const extractLinks = (item, type) => {
  const links = item.link;
  if (!links) {
    return [];
  }

  const linkArray = ensureArray(links);
  return linkArray.filter((link) => link?.$?.type === type).map((link) => link.$?.value);
};

const extractLinkIds = (item, type) => {
  const links = item.link;
  if (!links) {
    return [];
  }

  const linkArray = ensureArray(links);
  return linkArray.filter((link) => link?.$?.type === type).map((link) => link.$?.id);
};


const deriveExpansionInfo = (item) => {
  const categories = extractLinks(item, 'boardgamecategory');
  const itemType = item.$?.type || '';
  const isExpansion = itemType === 'boardgameexpansion';
  let baseGameId = parseInteger(item.$?.id, -1);

  if (isExpansion) {
    const expansionLinks = ensureArray(item.link)
      .filter((link) => link?.$?.type === 'boardgameexpansion')
      .map((link) => link.$);

    if (expansionLinks.length > 0) {
      const linkedId = parseInteger(expansionLinks[0]?.id, -1);
      if (linkedId !== -1) {
        baseGameId = linkedId;
      }
    }
  }

  return {
    baseGameId: baseGameId !== -1 ? baseGameId : parseInteger(item.$?.id, -1),
    isExpansion,
  };
};

const computeDimensionsMeta = ({ length, width, depth }) => {
  const dims = [length, width, depth].map((value) => (Number.isFinite(value) ? value : -1));
  const allVersionsMissingDimensions = dims.some((value) => value <= 0);

  if (allVersionsMissingDimensions) {
    return {
      allVersionsMissingDimensions: true,
      volume: -1,
      area: -1,
    };
  }

  const volume = dims[0] * dims[1] * dims[2];
  const sorted = [...dims].sort((a, b) => a - b);
  const area = sorted[0] * sorted[1];

  return {
    allVersionsMissingDimensions: false,
    volume,
    area,
  };
};

export const mapThingItem = (item) => {
  if (!item || !item.$) {
    return null;
  }

  const stats = item.statistics?.ratings;

  const ranks = stats?.ranks;
  const ranksArray = ensureArray(ranks?.rank);
  const boardGameRank = ranksArray.find((rank) => rank?.$?.friendlyname === 'Board Game Rank');
  const rankValue = boardGameRank?.$?.value;

  const versionsNode = item.versions?.item || item.versions;
  const versionItems = ensureArray(versionsNode);

  const expansionInfo = deriveExpansionInfo(item);

  const nameArray = ensureArray(item.name);
  const rawName = nameArray.length > 0
    ? nameArray.find((entry) => entry?.$?.type === 'primary')?.$?.value ||
      nameArray[0]?.$?.value ||
      null
    : item.name?.$?.value || item.name?._ || item.name || null;

  return {
    id: parseInteger(item.$.id, -1),
    type: item.$.type || 'thing',
    thumbnail: item.thumbnail || null,
    image: item.image || null,
    name: unescapeName(rawName),
    gamePublishedYear: parseInteger(item.yearpublished?.$?.value, -1),
    minPlayers: parseInteger(item.minplayers?.$?.value, -1),
    maxPlayers: parseInteger(item.maxplayers?.$?.value, -1),
    bestPlayerCount: extractBestPlayerCount(item),
    minPlayTime: parseInteger(item.minplaytime?.$?.value, -1),
    maxPlayTime: parseInteger(item.maxplaytime?.$?.value, -1),
    minAge: parseInteger(item.minage?.$?.value, -1),
    communityAge: extractCommunityAge(item),
    languageDependence: extractLanguageDependence(item),
    categories: uniqueSortedValues(extractLinks(item, 'boardgamecategory')),
    mechanics: uniqueSortedValues(extractLinks(item, 'boardgamemechanic')),
    families: uniqueSortedValues(extractLinks(item, 'boardgamefamily')),
    versionIds: versionItems.map((version) => parseInteger(version?.$?.id, -1)).filter((id) => id !== -1),
    bggWeight: parseFloat(stats?.averageweight?.$?.value, -1),
    bggRank:
      rankValue && rankValue !== 'Not Ranked'
        ? parseInteger(rankValue, -1)
        : -1,
    bggRating: parseFloat(stats?.average?.$?.value, -1),
    baseGameId: expansionInfo.baseGameId !== -1 ? expansionInfo.baseGameId : parseInteger(item.$?.id, -1),
    isExpansion: expansionInfo.isExpansion,
  };
};

export const mapVersionItems = (item, thingGameId) => {
  const versionsNode = item?.versions?.item || item?.versions;
  if (!versionsNode) {
    return [];
  }

  const versionItems = ensureArray(versionsNode);

  return versionItems
    .map((version) => {
      const attributes = version?.$ || {};
      const nameArray = ensureArray(version?.name);
      const primaryName = nameArray.length > 0
        ? nameArray.find((n) => n?.$?.type === 'primary')?.$?.value || null
        : version?.name?.$?.value || version?.name?._ || version?.name || null;
      const canonName =
        version?.canonicalname?.$?.value ||
        version?.canonicalname?._ ||
        version?.canonicalname ||
        null;
      const displayName = unescapeName(primaryName || canonName);
      const linkArray = ensureArray(version?.link);
      const linkToGame = linkArray.find((link) => link?.$?.type === 'boardgameversion') || null;
      const languageLink = linkArray.find((link) => link?.$?.type === 'language') || null;

      // Use thingGameId if provided and valid, otherwise fall back to link gameId
      const linkGameId = parseInteger(linkToGame?.$?.id, -1);
      const gameId = (Number.isInteger(thingGameId) && thingGameId > 0) 
        ? thingGameId 
        : (linkGameId !== -1 ? linkGameId : -1);
      
      const versionId = parseInteger(attributes.id, -1);
      
      const rawLength = version?.length?.$?.value;
      const rawWidth = version?.width?.$?.value;
      const rawDepth = version?.depth?.$?.value;
      
      let length = parseFloat(rawLength, -1);
      let width = parseFloat(rawWidth, -1);
      let depth = parseFloat(rawDepth, -1);
      
      // BGG returns default dimensions matching DEFAULT_DIMENSIONS for games without dimensions
      // Treat these as missing dimensions so we can try alternate versions or use our defaults
      const TOLERANCE = 0.01;
      const matchesDefault = (val, defaultVal) => Math.abs(val - defaultVal) < TOLERANCE;
      
      // Check if dimensions match DEFAULT_DIMENSIONS (in any order)
      const defaultDims = [DEFAULT_DIMENSIONS.length, DEFAULT_DIMENSIONS.width, DEFAULT_DIMENSIONS.depth];
      const parsedDims = [length, width, depth];
      
      // Sort both arrays to compare regardless of order
      const sortedDefaults = [...defaultDims].sort((a, b) => a - b);
      const sortedParsed = [...parsedDims].sort((a, b) => a - b);
      
      const isBggDefaultDimensions = sortedDefaults.every((def, idx) => 
        matchesDefault(sortedParsed[idx], def)
      );
      
      // If these match DEFAULT_DIMENSIONS, treat them as missing
      if (isBggDefaultDimensions) {
        console.debug(`⚠️  Filtering BGG default dimensions (${DEFAULT_DIMENSIONS.length}" × ${DEFAULT_DIMENSIONS.width}" × ${DEFAULT_DIMENSIONS.depth}") for ${buildVersionKey(gameId, versionId)}`);
        // Set to -1 to mark as missing
        length = -1;
        width = -1;
        depth = -1;
      }
      
      const dimensionsMeta = computeDimensionsMeta({ length, width, depth });

      return {
        versionId,
        name: displayName,
        gameId,
        versionKey: buildVersionKey(gameId, versionId),
        versionYearPublished: parseInteger(version?.yearpublished?.$?.value, -1),
        width,
        length,
        depth,
        weight: parseFloat(version?.weight?.$?.value, -1),
        language: languageLink?.$?.value || null,
        allVersionsMissingDimensions: dimensionsMeta.allVersionsMissingDimensions, // Keep for backward compatibility in cache
        volume: dimensionsMeta.volume,
        area: dimensionsMeta.area,
        bggDefaultDimensions: isBggDefaultDimensions, // Flag to indicate BGG defaults were filtered
      };
    })
    .filter((version) => version.versionId !== -1);
};


