import axios from 'axios';

// Use backend proxy instead of calling BGG directly
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance with extended timeout for long-running requests (2 minutes)
const apiClient = axios.create({
  timeout: 120000, // 2 minutes
  headers: {
    'Connection': 'keep-alive',
  }
});

// New simplified method that calls server-processed endpoint and returns packed cubes
// Supports SSE progress updates via onProgress callback
export const fetchPackedCubes = async (
  username,
  options = {},
  onProgress = null,
  extraParams = {}
) => {
  const {
    requestId: providedRequestId,
    overrides: providedOverrides,
    skipVersionCheck = false,
    ...additionalParams
  } = extraParams || {};

  const {
    includeStatuses = [],
    excludeStatuses = [],
    includeExpansions = false,
    priorities = [],
    verticalStacking = true,
    lockRotation = false,
    optimizeSpace = false,
    respectSortOrder = false,
    fitOversized = false,
    groupExpansions = false,
    groupSeries = false,
  } = options || {};

  const requestId = providedRequestId || `${username}-${Date.now()}`;
  const overridesPayload = {
    excludedGames: Array.isArray(providedOverrides?.excludedGames)
      ? providedOverrides.excludedGames
      : [],
    orientationOverrides: Array.isArray(providedOverrides?.orientationOverrides)
      ? providedOverrides.orientationOverrides
      : [],
    dimensionOverrides: Array.isArray(providedOverrides?.dimensionOverrides)
      ? providedOverrides.dimensionOverrides
      : [],
  };
  let eventSource = null;
  
  try {
    console.log('📡 Frontend: Fetching packed cubes from server');
    console.log('   Include statuses:', includeStatuses);
    console.log('   Exclude statuses:', excludeStatuses);
    
    // Set up SSE connection for progress updates if callback provided
    if (onProgress) {
      eventSource = new EventSource(`${API_BASE}/games/${username}/progress?requestId=${requestId}`);
      
      eventSource.onmessage = (event) => {
        try {
          // Skip keep-alive pings (they start with ':')
          if (event.data.startsWith(':')) {
            return;
          }
          const data = JSON.parse(event.data);
          if (onProgress) {
            onProgress(data);
          }
          console.log('📊 Progress:', data.message, data);
        } catch (e) {
          // Ignore parse errors for keep-alive messages
        }
      };
      
      eventSource.onerror = (error) => {
        console.warn('SSE connection error:', error);
        // Don't close - let it reconnect automatically
      };
    }
    
    const payload = {
      includeStatuses,
      excludeStatuses,
      includeExpansions,
      priorities,
      verticalStacking,
      lockRotation,
      optimizeSpace,
      respectSortOrder,
      fitOversized,
      groupExpansions,
      groupSeries,
      requestId,
      skipVersionCheck,
      overrides: overridesPayload,
      ...additionalParams,
    };
    
    const response = await apiClient.post(`${API_BASE}/games/${username}`, payload);
    
    // Close SSE connection
    if (eventSource) {
      eventSource.close();
    }
    
    if (response.data?.status === 'missing_versions') {
      console.log('⚠️ Frontend: Missing versions detected for', response.data.games?.length || 0, 'games');
    } else {
      console.log('✅ Frontend: Received', response.data.totalGames, 'games in', response.data.cubes?.length || 0, 'cubes');
    }
    return response.data;
  } catch (error) {
    // Close SSE connection on error
    if (eventSource) {
      eventSource.close();
    }
    
    console.error('❌ Frontend: Error fetching packed cubes');
    console.error('   Error:', error.message);
    throw error;
  }
};