import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';

import { BGG_API_BASE } from './configService.js';

const parseXmlString = promisify(parseString);

export const bggApiRequest = async (url, config = {}, maxRetries = 5) => {
  let retries = 0;
  const baseDelay = 5000;

  while (retries < maxRetries) {
    try {
      const response = await axios.get(url, config);
      return response;
    } catch (error) {
      const status = error.response?.status;
      if (status === 429 || status === 500 || status === 503) {
        retries += 1;

        const retryAfter = error.response?.headers['retry-after'];
        let waitTime = baseDelay;

        if (retryAfter) {
          const retryAfterNum = Number.parseInt(retryAfter, 10);
          if (!Number.isNaN(retryAfterNum)) {
            waitTime = retryAfterNum * 1000;
          } else {
            const retryDate = new Date(retryAfter);
            if (!Number.isNaN(retryDate.getTime())) {
              waitTime = Math.max(retryDate.getTime() - Date.now(), 1000);
            }
          }
        } else {
          waitTime = baseDelay * Math.pow(2, retries - 1);
        }

        console.log(
          `   ⚠️  Server error (${status}). Waiting ${(waitTime / 1000).toFixed(
            1,
          )}s before retry ${retries}/${maxRetries}...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Rate limit exceeded after ${maxRetries} retries`);
};

export const processGameItem = (item, versionInfo = null, versionId = null) => {
  const gameId = item.$.id;
  let name =
    item.name?.find((n) => n.$.type === 'primary')?.$?.value || item.name?.[0]?.$?.value || 'Unknown';

  if (versionInfo?.name && versionId && versionId !== 'default') {
    name = `${name} (${versionInfo.name})`;
  } else if (versionId && versionId !== 'default' && versionInfo?.yearPublished) {
    name = `${name} (${versionInfo.yearPublished} Edition)`;
  }

  const minPlayers = Number.parseInt(item.minplayers?.[0]?.$?.value || 1, 10);
  const maxPlayers = Number.parseInt(item.maxplayers?.[0]?.$?.value || 1, 10);
  const minPlaytime = Number.parseInt(item.minplaytime?.[0]?.$?.value || 0, 10);
  const maxPlaytime = Number.parseInt(item.maxplaytime?.[0]?.$?.value || 0, 10);
  const age = Number.parseInt(item.minage?.[0]?.$?.value || 0, 10);

  const categories =
    item.link?.filter((l) => l.$.type === 'boardgamecategory').map((l) => l.$.value) || [];

  const families =
    item.link?.filter((l) => l.$.type === 'boardgamefamily').map((l) => l.$.value) || [];

  const familyIds =
    item.link?.filter((l) => l.$.type === 'boardgamefamily').map((l) => l.$.id) || [];

  const expansionLinks = item.link?.filter((l) => l.$.type === 'boardgameexpansion') || [];

  let baseGameId = null;
  if (expansionLinks.length > 0) {
    baseGameId = expansionLinks[0].$.id || null;
  }

  const isExpansion =
    baseGameId !== null ||
    item.$.type === 'boardgameexpansion' ||
    categories.includes('Expansion for Base-game');

  const resolvedBaseGameId = baseGameId || gameId;

  const stats = item.statistics?.[0]?.ratings?.[0];
  const bggRating = Number.parseFloat(stats?.average?.[0]?.$?.value || 0);
  const weight = Number.parseFloat(stats?.averageweight?.[0]?.$?.value || 0);

  const ranks = stats?.ranks?.[0]?.rank || [];
  let bggRank = null;
  for (const rank of ranks) {
    if (rank.$.name === 'boardgame' && rank.$.value !== 'Not Ranked') {
      bggRank = Number.parseInt(rank.$.value, 10);
      break;
    }
  }

  let bestPlayerCount = null;
  let communityAge = null;

  const polls = item.poll || [];
  for (const poll of polls) {
    if (poll.$.name === 'suggested_numplayers') {
      let maxBestVotes = 0;
      const results = poll.results || [];
      for (const result of results) {
        const numPlayers = result.$.numplayers;
        const bestResult = result.result?.find((r) => r.$.value === 'Best');
        if (bestResult) {
          const votes = Number.parseInt(bestResult.$.numvotes || 0, 10);
          if (votes > maxBestVotes) {
            maxBestVotes = votes;
            bestPlayerCount = Number.parseInt(numPlayers, 10);
          }
        }
      }
    }

    if (poll.$.name === 'suggested_playerage') {
      let maxVotes = 0;
      const results = poll.results?.[0]?.result || [];
      for (const result of results) {
        const votes = Number.parseInt(result.$.numvotes || 0, 10);
        if (votes > maxVotes) {
          maxVotes = votes;
          communityAge = Number.parseInt(result.$.value, 10);
        }
      }
    }
  }

  let dimensions;
  if (versionInfo && versionInfo.width && versionInfo.length && versionInfo.depth) {
    const width = Number.parseFloat(versionInfo.width);
    const length = Number.parseFloat(versionInfo.length);
    const depth = Number.parseFloat(versionInfo.depth);

    if (width > 0 && length > 0 && depth > 0) {
      dimensions = {
        length,
        width,
        depth,
        missingDimensions: false,
      };
    } else {
      dimensions = {
        length: 0,
        width: 0,
        depth: 0,
        missingDimensions: true,
      };
    }
  } else {
    dimensions = {
      length: 0,
      width: 0,
      depth: 0,
      missingDimensions: true,
    };
  }

  return {
    id: gameId,
    name,
    versionName: versionInfo?.name || null,
    dimensions,
    categories,
    families,
    bggRank,
    minPlayers,
    maxPlayers,
    bestPlayerCount,
    minPlaytime,
    maxPlaytime,
    age,
    communityAge,
    weight,
    bggRating,
    baseGameId: resolvedBaseGameId,
    isExpansion,
    familyIds,
  };
};

export const findDimensionsFromVersions = (item) => {
  try {
    const versions = item.versions?.[0]?.item || [];

    if (versions.length === 0) {
      return { length: 12.8, width: 12.8, depth: 1.8, missingDimensions: true };
    }

    const versionData = versions.map((v) => {
      const yearPublished = Number.parseInt(v.yearpublished?.[0]?.$?.value || 0, 10);
      const language = v.link?.find((l) => l.$.type === 'language')?.$?.value || '';
      const width = Number.parseFloat(v.width?.[0]?.$?.value || 0);
      const length = Number.parseFloat(v.length?.[0]?.$?.value || 0);
      const depth = Number.parseFloat(v.depth?.[0]?.$?.value || 0);

      return {
        year: yearPublished,
        language,
        width,
        length,
        depth,
        hasValidDimensions: width > 0 && length > 0 && depth > 0,
      };
    });

    const englishVersions = versionData
      .filter((v) => v.hasValidDimensions && v.language === 'English')
      .sort((a, b) => b.year - a.year);

    if (englishVersions.length > 0) {
      const selected = englishVersions[0];
      return {
        length: selected.length,
        width: selected.width,
        depth: selected.depth,
        missingDimensions: false,
      };
    }

    const allVersionsWithDims = versionData
      .filter((v) => v.hasValidDimensions)
      .sort((a, b) => b.year - a.year);

    if (allVersionsWithDims.length > 0) {
      const selected = allVersionsWithDims[0];
      return {
        length: selected.length,
        width: selected.width,
        depth: selected.depth,
        missingDimensions: false,
      };
    }

    return { length: 12.8, width: 12.8, depth: 1.8, missingDimensions: true };
  } catch (error) {
    console.error('Error in findDimensionsFromVersions:', error.message);
    return { length: 12.8, width: 12.8, depth: 1.8, missingDimensions: true };
  }
};

export const extractDimensions = (item) => findDimensionsFromVersions(item);

export const parseBggXml = (xml) => parseXmlString(xml);

export { BGG_API_BASE };

