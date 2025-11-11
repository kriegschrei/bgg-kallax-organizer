const parseInteger = (value, defaultValue = -1) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

const parseFloatValue = (value, defaultValue = -1) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

const uniqueSortedValues = (values = []) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const extractBestPlayerCount = (item) => {
  const summaryResult = item['poll-summary']?.result;
  if (summaryResult) {
    const bestWith = Array.isArray(summaryResult)
      ? summaryResult.find((result) => result?.$?.name === 'bestwith')
      : summaryResult;
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
  const entries = Array.isArray(results) ? results : [results];

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

  const entries = Array.isArray(results) ? results : [results];

  let totalWeight = 0;
  let totalValue = 0;

  for (const entry of entries) {
    const weightRaw = entry?.$?.[weightKey];
    const valueRaw = entry?.$?.[valueKey];

    const weight = parseInteger(weightRaw, 0);
    const value = parseFloatValue(valueRaw, -1);

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

  const linkArray = Array.isArray(links) ? links : [links];
  return linkArray.filter((link) => link?.$?.type === type).map((link) => link.$?.value);
};

const extractLinkIds = (item, type) => {
  const links = item.link;
  if (!links) {
    return [];
  }

  const linkArray = Array.isArray(links) ? links : [links];
  return linkArray.filter((link) => link?.$?.type === type).map((link) => link.$?.id);
};

const ensureArray = (value) => {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
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
  const missingDimensions = dims.some((value) => value <= 0);

  if (missingDimensions) {
    return {
      missingDimensions: true,
      volume: -1,
      area: -1,
    };
  }

  const volume = dims[0] * dims[1] * dims[2];
  const sorted = [...dims].sort((a, b) => a - b);
  const area = sorted[0] * sorted[1];

  return {
    missingDimensions: false,
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
  const ranksArray = Array.isArray(ranks?.rank) ? ranks.rank : ranks?.rank ? [ranks.rank] : [];
  const boardGameRank = ranksArray.find((rank) => rank?.$?.friendlyname === 'Board Game Rank');
  const rankValue = boardGameRank?.$?.value;

  const versionsNode = item.versions?.item || item.versions;
  const versionItems = Array.isArray(versionsNode) ? versionsNode : versionsNode ? [versionsNode] : [];

  const expansionInfo = deriveExpansionInfo(item);

  return {
    id: parseInteger(item.$.id, -1),
    type: item.$.type || 'thing',
    thumbnail: item.thumbnail || null,
    image: item.image || null,
    name:
      Array.isArray(item.name)
        ? item.name.find((entry) => entry?.$?.type === 'primary')?.$?.value ||
          item.name[0]?.$?.value ||
          null
        : item.name?.$?.value || item.name?._ || item.name || null,
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
    bggWeight: parseFloatValue(stats?.averageweight?.$?.value, -1),
    bggRank:
      rankValue && rankValue !== 'Not Ranked'
        ? parseInteger(rankValue, -1)
        : -1,
    bggRating: parseFloatValue(stats?.average?.$?.value, -1),
    baseGameId: expansionInfo.baseGameId !== -1 ? expansionInfo.baseGameId : parseInteger(item.$?.id, -1),
    isExpansion: expansionInfo.isExpansion,
  };
};

export const mapVersionItems = (item) => {
  const versionsNode = item?.versions?.item || item?.versions;
  if (!versionsNode) {
    return [];
  }

  const versionItems = Array.isArray(versionsNode) ? versionsNode : [versionsNode];

  return versionItems
    .map((version) => {
      const attributes = version?.$ || {};
      const canonName =
        version?.canonicalname?.$?.value ||
        version?.canonicalname?._ ||
        version?.canonicalname ||
        null;
      const linkToGame = Array.isArray(version?.link)
        ? version.link.find((link) => link?.$?.type === 'boardgameversion')
        : version?.link?.$?.type === 'boardgameversion'
        ? version.link
        : null;

      const languageLink = Array.isArray(version?.link)
        ? version.link.find((link) => link?.$?.type === 'language')
        : version?.link?.$?.type === 'language'
        ? version.link
        : null;

      const gameId = parseInteger(linkToGame?.$?.id, -1);
      const length = parseFloatValue(version?.length?.$?.value, -1);
      const width = parseFloatValue(version?.width?.$?.value, -1);
      const depth = parseFloatValue(version?.depth?.$?.value, -1);
      const dimensionsMeta = computeDimensionsMeta({ length, width, depth });
      const versionId = parseInteger(attributes.id, -1);

      return {
        versionId,
        name: canonName,
        gameId,
        versionKey: `${gameId}-${versionId !== -1 ? versionId : 'default'}`,
        versionYearPublished: parseInteger(version?.yearpublished?.$?.value, -1),
        width,
        length,
        depth,
        weight: parseFloatValue(version?.weight?.$?.value, -1),
        language: languageLink?.$?.value || null,
        missingDimensions: dimensionsMeta.missingDimensions,
        volume: dimensionsMeta.volume,
        area: dimensionsMeta.area,
      };
    })
    .filter((version) => version.versionId !== -1);
};


