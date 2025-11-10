import axios from 'axios';
import { gzip } from 'pako';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  timeout: 120000, // 2 minutes
  headers: {
    'Connection': 'keep-alive',
  },
});

const DEFAULT_OPTIONS = {
  includeStatuses: [],
  excludeStatuses: [],
  includeExpansions: false,
  priorities: [],
  verticalStacking: true,
  lockRotation: false,
  optimizeSpace: false,
  respectSortOrder: false,
  fitOversized: false,
  groupExpansions: false,
  groupSeries: false,
};

const REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  'Content-Encoding': 'gzip',
};

const generateRequestId = (username, providedId) =>
  providedId || `${username}-${Date.now()}`;

const normalizeOptions = (options = {}) => ({
  ...DEFAULT_OPTIONS,
  ...options,
});

const sanitizeOverrides = (overrides = {}) => ({
  excludedGames: Array.isArray(overrides.excludedGames) ? overrides.excludedGames : [],
  orientationOverrides: Array.isArray(overrides.orientationOverrides)
    ? overrides.orientationOverrides
    : [],
  dimensionOverrides: Array.isArray(overrides.dimensionOverrides)
    ? overrides.dimensionOverrides
    : [],
});

const normalizeRequestMeta = (username, extraParams = {}) => {
  const {
    requestId: providedRequestId,
    overrides: providedOverrides,
    skipVersionCheck = false,
    ...additionalParams
  } = extraParams;

  return {
    requestId: generateRequestId(username, providedRequestId),
    overridesPayload: sanitizeOverrides(providedOverrides),
    skipVersionCheck,
    additionalParams,
  };
};

const createProgressEventSource = (username, requestId, onProgress) => {
  const eventSource = new EventSource(
    `${API_BASE}/games/${username}/progress?requestId=${requestId}`
  );

  eventSource.onmessage = (event) => {
    try {
      if (event.data.startsWith(':')) {
        return;
      }
      const data = JSON.parse(event.data);
      onProgress?.(data);
      console.log('📊 Progress:', data.message, data);
    } catch {
      // Ignore keep-alive parse errors
    }
  };

  eventSource.onerror = (error) => {
    console.warn('SSE connection error:', error);
  };

  return eventSource;
};

const buildRequestPayload = (options, meta) => ({
  ...options,
  requestId: meta.requestId,
  skipVersionCheck: meta.skipVersionCheck,
  overrides: meta.overridesPayload,
  ...meta.additionalParams,
});

const compressJsonPayload = (payload) => {
  const payloadString = JSON.stringify(payload);
  const encoder = new TextEncoder();
  return gzip(encoder.encode(payloadString));
};

const logRequestStart = (options) => {
  console.log('📡 Frontend: Fetching packed cubes from server');
  console.log('   Include statuses:', options.includeStatuses);
  console.log('   Exclude statuses:', options.excludeStatuses);
};

const logSuccess = (response) => {
  if (response?.status === 'missing_versions') {
    console.log(
      '⚠️ Frontend: Missing versions detected for',
      response.games?.length || 0,
      'games'
    );
    return;
  }

  console.log(
    '✅ Frontend: Received',
    response?.totalGames,
    'games in',
    response?.cubes?.length || 0,
    'cubes'
  );
};

const logRequestError = (error) => {
  console.error('❌ Frontend: Error fetching packed cubes');
  console.error('   Error:', error.message);
};

export const fetchPackedCubes = async (
  username,
  options = {},
  onProgress = null,
  extraParams = {}
) => {
  const normalizedOptions = normalizeOptions(options);
  const meta = normalizeRequestMeta(username, extraParams);

  logRequestStart(normalizedOptions);

  let eventSource = null;

  try {
    if (onProgress) {
      eventSource = createProgressEventSource(username, meta.requestId, onProgress);
    }

    const payload = buildRequestPayload(normalizedOptions, meta);
    const compressedPayload = compressJsonPayload(payload);

    const response = await apiClient.post(
      `${API_BASE}/games/${username}`,
      compressedPayload,
      { headers: REQUEST_HEADERS }
    );

    logSuccess(response.data);
    return response.data;
  } catch (error) {
    logRequestError(error);
    throw error;
  } finally {
    if (eventSource) {
      eventSource.close();
    }
  }
};