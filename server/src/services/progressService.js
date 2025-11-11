const progressState = new Map();
const activeRequests = new Set();

export const registerRequest = (requestId) => {
  if (requestId) {
    activeRequests.add(requestId);
  }
};

export const sendProgressUpdate = (requestId, message, data = {}) => {
  if (!requestId) {
    return;
  }

  const payload = {
    requestId,
    message,
    ...data,
    timestamp: Date.now(),
  };

  progressState.set(requestId, payload);
};

export const getProgressById = (requestId) => {
  if (!requestId) {
    return null;
  }
  return progressState.get(requestId) ?? null;
};

export const clearProgress = (requestId) => {
  progressState.delete(requestId);
  activeRequests.delete(requestId);
};

export const scheduleProgressCleanup = (requestId, delayMs = 5000) => {
  if (!requestId) {
    return;
  }
  setTimeout(() => {
    clearProgress(requestId);
  }, delayMs);
};

export const isRequestRegistered = (requestId) => activeRequests.has(requestId);

