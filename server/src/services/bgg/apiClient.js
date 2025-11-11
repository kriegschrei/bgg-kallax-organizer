import axios from 'axios';

const DEFAULT_MAX_RETRIES = 5;
const BASE_DELAY_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const computeRetryDelay = (retryCount, response) => {
  const retryAfter = response?.headers?.['retry-after'];

  if (!retryAfter) {
    return BASE_DELAY_MS * Math.pow(2, Math.max(retryCount - 1, 0));
  }

  const retryAfterNum = Number.parseInt(retryAfter, 10);
  if (!Number.isNaN(retryAfterNum)) {
    return retryAfterNum * 1000;
  }

  const retryDate = new Date(retryAfter);
  if (!Number.isNaN(retryDate.getTime())) {
    return Math.max(retryDate.getTime() - Date.now(), 1000);
  }

  return BASE_DELAY_MS;
};

export const bggApiRequest = async (url, config = {}, maxRetries = DEFAULT_MAX_RETRIES) => {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await axios.get(url, config);
    } catch (error) {
      const status = error.response?.status;

      if (status === 429 || status === 500 || status === 503) {
        attempt += 1;
        const delay = computeRetryDelay(attempt, error.response);
        console.warn(
          `⚠️  BGG request failed with status ${status}. Retrying ${attempt}/${maxRetries} after ${(delay / 1000).toFixed(
            1,
          )}s...`,
        );
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Rate limit exceeded after ${maxRetries} retries for ${url}`);
};


