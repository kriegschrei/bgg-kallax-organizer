import axios from 'axios';
import { gzip } from 'pako';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  'Content-Encoding': 'gzip',
};
const PROGRESS_POLL_INTERVAL_MS = 3000;

const apiClient = axios.create({
  timeout: 120000, // 2 minutes
});

const generateRequestId = (username) => `${username}-${Date.now()}`;

const compressJsonPayload = (payload) => {
  const payloadString = JSON.stringify(payload);
  const encoder = new TextEncoder();
  return gzip(encoder.encode(payloadString));
};

const logRequestStart = (payload) => {
  console.log('📡 Frontend: Fetching packed cubes from server');
  console.log('   Username:', payload.username);
  console.log('   Stacking:', payload.stacking);
  console.log('   Flags:', {
    lockRotation: payload.lockRotation ?? false,
    optimizeSpace: payload.optimizeSpace ?? false,
    respectSortOrder: payload.respectSortOrder ?? false,
    fitOversized: payload.fitOversized ?? false,
    groupExpansions: payload.groupExpansions ?? false,
    groupSeries: payload.groupSeries ?? false,
    includeExpansions: payload.includeExpansions ?? false,
    bypassVersionWarning: payload.bypassVersionWarning ?? false,
  });
};

const logSuccess = (response) => {
  console.log('✅ Frontend: Request completed successfully');
  if (response?.status === 'missing_versions') {
    console.log('⚠️ Frontend: Missing versions detected in response payload');
  }
};

const logRequestError = (error) => {
  console.error('❌ Frontend: Error fetching packed cubes');
  console.error('   Error:', error?.message || 'Unknown error');
};

const startProgressPolling = (requestId, onProgress) => {
  if (!onProgress) {
    return null;
  }

  let isPolling = true;
  let pending = false;

  const poll = async () => {
    if (pending || !isPolling) {
      return;
    }

    pending = true;
    try {
      const { data } = await apiClient.post(`${API_BASE}/games/progress`, { requestId });
      if (isPolling) {
        onProgress(data);
      }
    } catch (error) {
      if (isPolling) {
        console.warn('⚠️ Progress polling error:', error?.message || error);
      }
    } finally {
      pending = false;
    }
  };

  void poll();
  const intervalId = setInterval(poll, PROGRESS_POLL_INTERVAL_MS);

  return () => {
    isPolling = false;
    clearInterval(intervalId);
  };
};

export const fetchPackedCubes = async (requestPayload, { onProgress } = {}) => {
  if (!requestPayload?.username) {
    throw new Error('fetchPackedCubes requires a username in the payload.');
  }

  const requestId = generateRequestId(requestPayload.username);
  const headers = {
    ...REQUEST_HEADERS,
    'X-Request-Id': requestId,
  };

  logRequestStart(requestPayload);

  const compressedPayload = compressJsonPayload(requestPayload);
  const stopPolling = startProgressPolling(requestId, onProgress);

  try {
    const response = await apiClient.post(`${API_BASE}/games`, compressedPayload, {
      headers,
    });
    logSuccess(response.data);
    return { data: response.data, requestId };
  } catch (error) {
    logRequestError(error);
    throw error;
  } finally {
    if (stopPolling) {
      stopPolling();
    }
  }
};