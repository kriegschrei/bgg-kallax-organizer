import axios from 'axios';

// Use backend proxy instead of calling BGG directly
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Helper to parse XML to JSON
const parseXML = (xmlString) => {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
};

// Helper to convert XML node to object
const xmlToObject = (node) => {
  const obj = {};
  
  // Get attributes
  if (node.attributes) {
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i];
      obj[attr.name] = attr.value;
    }
  }
  
  // Get text content if it's a text node
  if (node.childNodes.length === 1 && node.childNodes[0].nodeType === 3) {
    return node.textContent;
  }
  
  // Get child nodes
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 1) { // Element node
      const childName = child.nodeName;
      const childValue = xmlToObject(child);
      
      if (obj[childName]) {
        if (!Array.isArray(obj[childName])) {
          obj[childName] = [obj[childName]];
        }
        obj[childName].push(childValue);
      } else {
        obj[childName] = childValue;
      }
    }
  }
  
  return obj;
};

// Add delay between API calls to respect rate limits
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// New simplified method that calls server-processed endpoint and returns packed cubes
export const fetchPackedCubes = async (username, includePreordered = false, includeExpansions = false, priorities = [], verticalStacking = true, allowAlternateRotation = true, optimizeSpace = false, respectSortOrder = false) => {
  try {
    console.log('📡 Frontend: Fetching packed cubes from server');
    
    const params = new URLSearchParams({
      includePreordered: includePreordered.toString(),
      includeExpansions: includeExpansions.toString(),
      priorities: JSON.stringify(priorities),
      verticalStacking: verticalStacking.toString(),
      allowAlternateRotation: allowAlternateRotation.toString(),
      optimizeSpace: optimizeSpace.toString(),
      respectSortOrder: respectSortOrder.toString(),
    });
    
    const response = await axios.get(`${API_BASE}/games/${username}?${params.toString()}`);
    
    console.log('✅ Frontend: Received', response.data.totalGames, 'games in', response.data.cubes.length, 'cubes');
    return response.data.cubes;
  } catch (error) {
    console.error('❌ Frontend: Error fetching packed cubes');
    console.error('   Error:', error.message);
    throw error;
  }
};

// Old method kept for reference
export const fetchUserCollection = async (username, includePreordered = false, includeExpansions = false) => {
  try {
    const params = new URLSearchParams({
      own: 1,
      stats: 1,
    });
    
    if (includePreordered) {
      params.append('preordered', 1);
    }
    
    console.log('📡 Frontend: Fetching collection for', username);
    console.log('   Include preordered:', includePreordered);
    console.log('   Include expansions:', includeExpansions);
    
    const response = await axios.get(`${API_BASE}/collection/${username}?${params.toString()}`);
    
    console.log('📥 Frontend: Received response');
    console.log('   Status:', response.status);
    console.log('   Data type:', typeof response.data);
    console.log('   Data length:', response.data?.length);
    
    const xml = parseXML(response.data);
    
    // Check if we got a 202 (still processing)
    const errorNode = xml.querySelector('error message');
    if (errorNode) {
      console.error('❌ Frontend: BGG returned error:', errorNode.textContent);
      throw new Error(errorNode.textContent);
    }
    
    const items = xml.querySelectorAll('item');
    console.log('🎲 Frontend: Found items:', items.length);
    
    const games = [];
    
    items.forEach((item, index) => {
      const gameId = item.getAttribute('objectid');
      const subtype = item.getAttribute('subtype');
      
      if (index < 3) {
        console.log(`   Item ${index + 1}:`, { gameId, subtype });
      }
      
      // Skip expansions unless explicitly requested
      if (subtype === 'boardgameexpansion' && !includeExpansions) {
        console.log(`   → Skipping expansion: ${item.querySelector('name')?.textContent}`);
        return;
      }
      
      const name = item.querySelector('name')?.textContent;
      const yearPublished = item.querySelector('yearpublished')?.textContent;
      
      // Get stats
      const stats = item.querySelector('stats');
      const rating = stats?.querySelector('rating');
      const ranks = rating?.querySelectorAll('rank');
      let bggRank = null;
      
      if (ranks) {
        ranks.forEach(rank => {
          if (rank.getAttribute('name') === 'boardgame') {
            const rankValue = rank.getAttribute('value');
            bggRank = rankValue !== 'Not Ranked' ? parseInt(rankValue) : null;
          }
        });
      }
      
      const userRating = rating?.querySelector('average')?.getAttribute('value');
      
      games.push({
        id: gameId,
        name,
        yearPublished: yearPublished ? parseInt(yearPublished) : null,
        bggRank,
        userRating: userRating ? parseFloat(userRating) : null,
      });
    });
    
    console.log('✅ Frontend: Returning', games.length, 'games');
    console.log('   First game:', games[0]?.name);
    
    return games;
  } catch (error) {
    console.error('❌ Frontend: Error fetching collection');
    console.error('   Error:', error.message);
    console.error('   Response:', error.response?.data);
    throw error;
  }
};

export const fetchGameDetails = async (gameIds) => {
  try {
    // Reduce batch size to avoid memory issues with large XML responses
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < gameIds.length; i += batchSize) {
      batches.push(gameIds.slice(i, i + batchSize));
    }
    
    const allDetails = [];
    console.log(`📦 Frontend: Processing ${gameIds.length} games in ${batches.length} batches`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`   Batch ${batchIndex + 1}/${batches.length}: ${batch.length} games`);
      
      const params = new URLSearchParams({
        id: batch.join(','),
        stats: 1,
        versions: 1,
      });
      
      const response = await axios.get(`${API_BASE}/thing?${params.toString()}`);
      
      console.log(`   ✓ Received ${(response.data.length / 1024).toFixed(1)}KB`);
      
      const xml = parseXML(response.data);
      
      if (!xml || xml.querySelector('parsererror')) {
        console.error('   ❌ XML parsing error');
        continue;
      }
      const items = xml.querySelectorAll('items > item');
      
      items.forEach(item => {
        const gameId = item.getAttribute('id');
        
        // Get names
        const primaryName = item.querySelector('name[type="primary"]')?.getAttribute('value');
        
        // Get basic info
        const minPlayers = parseInt(item.querySelector('minplayers')?.getAttribute('value') || 1);
        const maxPlayers = parseInt(item.querySelector('maxplayers')?.getAttribute('value') || 1);
        const minPlaytime = parseInt(item.querySelector('minplaytime')?.getAttribute('value') || 0);
        const maxPlaytime = parseInt(item.querySelector('maxplaytime')?.getAttribute('value') || 0);
        const age = parseInt(item.querySelector('minage')?.getAttribute('value') || 0);
        
        // Get categories and families
        const categories = [];
        const families = [];
        
        item.querySelectorAll('link[type="boardgamecategory"]').forEach(link => {
          categories.push(link.getAttribute('value'));
        });
        
        item.querySelectorAll('link[type="boardgamefamily"]').forEach(link => {
          families.push(link.getAttribute('value'));
        });
        
        // Get stats
        const stats = item.querySelector('statistics > ratings');
        const bggRating = parseFloat(stats?.querySelector('average')?.getAttribute('value') || 0);
        const weight = parseFloat(stats?.querySelector('averageweight')?.getAttribute('value') || 0);
        
        const ranks = stats?.querySelectorAll('ranks > rank');
        let bggRank = null;
        if (ranks) {
          ranks.forEach(rank => {
            if (rank.getAttribute('name') === 'boardgame') {
              const rankValue = rank.getAttribute('value');
              bggRank = rankValue !== 'Not Ranked' ? parseInt(rankValue) : null;
            }
          });
        }
        
        // Get community polls for best player count and community age
        let bestPlayerCount = null;
        let communityAge = null;
        
        const polls = item.querySelectorAll('poll');
        polls.forEach(poll => {
          const pollName = poll.getAttribute('name');
          
          if (pollName === 'suggested_numplayers') {
            // Find the player count with highest "Best" votes
            let maxBestVotes = 0;
            const results = poll.querySelectorAll('results');
            results.forEach(result => {
              const numPlayers = result.getAttribute('numplayers');
              const bestResult = result.querySelector('result[value="Best"]');
              if (bestResult) {
                const votes = parseInt(bestResult.getAttribute('numvotes') || 0);
                if (votes > maxBestVotes) {
                  maxBestVotes = votes;
                  // Handle "X+" format
                  bestPlayerCount = numPlayers.includes('+') 
                    ? parseInt(numPlayers) 
                    : parseInt(numPlayers);
                }
              }
            });
          }
          
          if (pollName === 'suggested_playerage') {
            // Find the age with highest votes
            let maxVotes = 0;
            const results = poll.querySelectorAll('result');
            results.forEach(result => {
              const age = result.getAttribute('value');
              const votes = parseInt(result.getAttribute('numvotes') || 0);
              if (votes > maxVotes) {
                maxVotes = votes;
                // Parse age like "8+", "12+", etc.
                communityAge = parseInt(age);
              }
            });
          }
        });
        
        // Get dimensions from versions
        const dimensions = extractDimensions(item);
        
        allDetails.push({
          id: gameId,
          name: primaryName,
          minPlayers,
          maxPlayers,
          minPlaytime,
          maxPlaytime,
          age,
          categories,
          families,
          bggRating,
          weight,
          bggRank,
          bestPlayerCount,
          communityAge,
          dimensions,
        });
      });
      
      // Add delay between batches to respect rate limits
      if (batchIndex < batches.length - 1) {
        console.log(`   ⏳ Waiting 1s before next batch...`);
        await delay(1000);
      }
    }
    
    console.log(`✅ Frontend: Processed ${allDetails.length} games total`);
    return allDetails;
  } catch (error) {
    console.error('❌ Frontend: Error fetching game details');
    console.error('   Error:', error.message);
    throw error;
  }
};

const extractDimensions = (itemNode) => {
  try {
    const versions = itemNode.querySelectorAll('versions > item');
    
    if (!versions || versions.length === 0) {
      return {
        length: 13,
        width: 13,
        depth: 2,
        missingDimensions: true,
      };
    }
    
    // Limit to first 20 versions to avoid excessive processing
    const versionLimit = Math.min(versions.length, 20);
    const versionArray = [];
    
    for (let i = 0; i < versionLimit; i++) {
      const v = versions[i];
      const yearPublished = v.querySelector('yearpublished')?.getAttribute('value');
      const language = v.querySelector('link[type="language"]')?.getAttribute('value');
      const width = v.querySelector('width')?.getAttribute('value');
      const length = v.querySelector('length')?.getAttribute('value');
      const depth = v.querySelector('depth')?.getAttribute('value');
      
      versionArray.push({
        year: yearPublished ? parseInt(yearPublished) : 0,
        language,
        width: width ? parseFloat(width) : null,
        length: length ? parseFloat(length) : null,
        depth: depth ? parseFloat(depth) : null,
      });
    }
    
    // Sort by year descending
    versionArray.sort((a, b) => b.year - a.year);
    
    // First try to find English version with dimensions
    let selectedVersion = versionArray.find(v => 
      v.language === 'English' && v.width && v.length && v.depth
    );
    
    // If not found, try any version with dimensions (newest first)
    if (!selectedVersion) {
      selectedVersion = versionArray.find(v => v.width && v.length && v.depth);
    }
    
    // If still not found, use default
    if (!selectedVersion || !selectedVersion.width) {
      return {
        length: 13,
        width: 13,
        depth: 2,
        missingDimensions: true,
      };
    }
    
    return {
      length: selectedVersion.length,
      width: selectedVersion.width,
      depth: selectedVersion.depth,
      missingDimensions: false,
    };
  } catch (error) {
    console.error('Error extracting dimensions:', error);
    return {
      length: 13,
      width: 13,
      depth: 2,
      missingDimensions: true,
    };
  }
};

