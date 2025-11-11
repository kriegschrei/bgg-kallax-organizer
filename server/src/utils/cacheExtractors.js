// Extract minimal collection data from parsed XML for caching
export function extractCollectionData(collectionXml) {
  if (!collectionXml.items || !collectionXml.items.item) {
    return { items: [] };
  }

  const items = Array.isArray(collectionXml.items.item) 
    ? collectionXml.items.item 
    : [collectionXml.items.item];

  return {
    items: items.map(item => ({
      gameId: item.$.objectid,
      versionId: item.version?.[0]?.item?.[0]?.$?.id || 'default',
      subtype: item.$.subtype,
      name: item.name?.[0]?._ || item.name?.[0]
    }))
  };
}

// Extract minimal game data from parsed XML (for sorting/organizing)
export function extractGameData(item) {
  const gameId = item.$.id;
  const name = item.name?.find(n => n.$.type === 'primary')?.$?.value || 'Unknown';
  
  const minPlayers = parseInt(item.minplayers?.[0]?.$?.value || 1);
  const maxPlayers = parseInt(item.maxplayers?.[0]?.$?.value || 1);
  const minPlaytime = parseInt(item.minplaytime?.[0]?.$?.value || 0);
  const maxPlaytime = parseInt(item.maxplaytime?.[0]?.$?.value || 0);
  const age = parseInt(item.minage?.[0]?.$?.value || 0);

  // Extract categories and families
  const categories = item.link
    ?.filter(l => l.$.type === 'boardgamecategory')
    .map(l => l.$.value) || [];
  
  const families = item.link
    ?.filter(l => l.$.type === 'boardgamefamily')
    .map(l => l.$.value) || [];
  
  // Extract family IDs (for series grouping)
  const familyIds = item.link
    ?.filter(l => l.$.type === 'boardgamefamily')
    .map(l => l.$.id) || [];
  
  // Extract expansion relationships (base game ID if this is an expansion)
  const expansionLinks = item.link
    ?.filter(l => l.$.type === 'boardgameexpansion') || [];
  
  let baseGameId = null;
  if (expansionLinks.length > 0) {
    baseGameId = expansionLinks[0].$.id || null;
  }
  
  const isExpansion = baseGameId !== null || 
    item.$.type === 'boardgameexpansion' ||
    categories.includes('Expansion for Base-game');

  // Extract stats
  const stats = item.statistics?.[0]?.ratings?.[0];
  const bggRating = parseFloat(stats?.average?.[0]?.$?.value || 0);
  const weight = parseFloat(stats?.averageweight?.[0]?.$?.value || 0);
  
  const ranks = stats?.ranks?.[0]?.rank || [];
  let bggRank = null;
  for (const rank of ranks) {
    if (rank.$.name === 'boardgame' && rank.$.value !== 'Not Ranked') {
      bggRank = parseInt(rank.$.value);
      break;
    }
  }

  // Extract poll data
  let bestPlayerCount = null;
  let communityAge = null;

  const polls = item.poll || [];
  for (const poll of polls) {
    if (poll.$.name === 'suggested_numplayers') {
      let maxBestVotes = 0;
      const results = poll.results || [];
      for (const result of results) {
        const numPlayers = result.$.numplayers;
        const bestResult = result.result?.find(r => r.$.value === 'Best');
        if (bestResult) {
          const votes = parseInt(bestResult.$.numvotes || 0);
          if (votes > maxBestVotes) {
            maxBestVotes = votes;
            bestPlayerCount = parseInt(numPlayers);
          }
        }
      }
    }
    
    if (poll.$.name === 'suggested_playerage') {
      let maxVotes = 0;
      const results = poll.results?.[0]?.result || [];
      for (const result of results) {
        const votes = parseInt(result.$.numvotes || 0);
        if (votes > maxVotes) {
          maxVotes = votes;
          communityAge = parseInt(result.$.value);
        }
      }
    }
  }

  return {
    name,
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
    // Grouping fields
    baseGameId,
    isExpansion,
    familyIds
  };
}

// Extract version data from parsed XML
export function extractVersionData(versionItem) {
  const versionId = versionItem.$?.id || 'default';
  const versionName = versionItem.name?.[0]?.$?.value || null;
  const yearPublished = versionItem.yearpublished?.[0]?.$?.value || null;
  const width = versionItem.width?.[0]?.$?.value;
  const length = versionItem.length?.[0]?.$?.value;
  const depth = versionItem.depth?.[0]?.$?.value;

  const widthNum = parseFloat(width);
  const lengthNum = parseFloat(length);
  const depthNum = parseFloat(depth);
  const hasValidDimensions = widthNum > 0 && lengthNum > 0 && depthNum > 0;

  return {
    versionId,
    name: versionName,
    yearPublished,
    dimensions: hasValidDimensions ? {
      width: widthNum,
      length: lengthNum,
      depth: depthNum,
      missingDimensions: false
    } : {
      width: 0,
      length: 0,
      depth: 0,
      missingDimensions: true
    }
  };
}

