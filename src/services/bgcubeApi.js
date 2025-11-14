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

const startProgressPolling = (requestId, token, onProgress, resolve, reject) => {
  let isPolling = true;
  let pending = false;

  const poll = async () => {
    if (pending || !isPolling) {
      return;
    }

    pending = true;
    try {
      // Send token in header (preferred)
      const { data } = await apiClient.get(`${API_BASE}/progress/${requestId}`, {
        headers: {
          'X-Request-Token': token,
        },
      });
      
      if (isPolling) {
        // Check if processing is complete (has result data, not just progress)
        if (data?.cubes || data?.status === 'missing_versions' || data?.error) {
          isPolling = false;
          if (onProgress) {
            onProgress(data);
          }
          if (resolve) {
            resolve(data);
          }
          return;
        }
        
        if (data?.message && onProgress) {
          onProgress(data);
        }
      }
    } catch (error) {
      if (isPolling) {
        console.warn('⚠️ Progress polling error:', error?.message || error);
        // If 401, token expired or invalid - stop polling
        if (error?.response?.status === 401) {
          isPolling = false;
          const errorMsg = 'Request token expired or invalid';
          if (reject) {
            reject(new Error(errorMsg));
          }
          return;
        }
      }
    } finally {
      pending = false;
    }
  };

  // Poll immediately to catch early progress updates
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

  logRequestStart(requestPayload);

  const compressedPayload = compressJsonPayload(requestPayload);

  try {
    const response = await apiClient.post(`${API_BASE}/games`, compressedPayload, {
      headers: REQUEST_HEADERS,
    });

    // Handle 202 Accepted response
    if (response.status === 202) {
      const { requestId, token, progressUrl } = response.data;
      
      if (!requestId || !token) {
        throw new Error('Invalid response: missing requestId or token');
      }

      console.log('📡 Frontend: Request accepted, polling for progress');
      console.log('   Request ID:', requestId);
      console.log('   Progress URL:', progressUrl);

      // Wait for completion by polling
      return new Promise((resolve, reject) => {
        let pollingStopFn = null;
        
        // Timeout after 5 minutes
        const timeoutId = setTimeout(() => {
          if (pollingStopFn) pollingStopFn();
          reject(new Error('Request timeout: processing took too long'));
        }, 5 * 60 * 1000);

        pollingStopFn = startProgressPolling(
          requestId,
          token,
          onProgress,
          (result) => {
            clearTimeout(timeoutId);
            if (pollingStopFn) pollingStopFn();
            logSuccess(result);
            resolve({ data: result, requestId });
          },
          (error) => {
            clearTimeout(timeoutId);
            if (pollingStopFn) pollingStopFn();
            reject(error);
          }
        );
      });
    }

    // Legacy 200 response (shouldn't happen with new flow)
    logSuccess(response.data);
    return { data: response.data, requestId: response.data.requestId };
  } catch (error) {
    logRequestError(error);
    throw error;
  }
};