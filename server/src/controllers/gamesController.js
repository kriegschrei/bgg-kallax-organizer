import { normalizeUsername } from '../utils/gameUtils.js';
import { validateGamesPayload } from '../validation/gamesValidator.js';
import {
  registerRequest,
  sendProgressUpdate,
  scheduleProgressCleanup,
} from '../services/progressService.js';
import { processGamesRequest } from '../services/gamesService.js';

const ensureUsernameString = (value) => {
  if (typeof value === 'number') {
    return value.toString();
  }
  return value;
};

export const handleGamesRequest = async (req, res) => {
  const payload = req.body ?? {};
  const { valid, errors } = validateGamesPayload(payload);

  if (!valid) {
    return res.status(400).json({ errors });
  }

  const usernameInput = ensureUsernameString(payload.username);
  const normalizedInput =
    typeof usernameInput === 'string' ? usernameInput.trim() : usernameInput;
  const username = normalizeUsername(normalizedInput);

  const requestId =
    req.get('x-request-id')?.toString() || `${username}-${Date.now()}`;

  registerRequest(requestId);

  try {
    const result = await processGamesRequest({
      payload: { ...payload, username },
      username,
      requestId,
      onProgress: sendProgressUpdate,
    });

    if (result?.status === 'missing_versions') {
      scheduleProgressCleanup(requestId);
      return res.json(result);
    }

    scheduleProgressCleanup(requestId);
    return res.json(result);
  } catch (error) {
    console.error('❌ Error processing games:', error.message);
    console.error('   Stack trace:', error.stack);
    sendProgressUpdate(requestId, `Error: ${error.message}`, {
      error: true,
      message: error.message,
    });
    scheduleProgressCleanup(requestId);
    return res.status(500).json({ error: error.message });
  }
};

