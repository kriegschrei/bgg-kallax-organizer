import { writeFile } from 'fs/promises';
import crypto from 'crypto';

import { normalizeUsername } from '../utils/gameUtils.js';
import { validateGamesPayload } from '../validation/gamesValidator.js';
import {
  registerRequest,
  sendProgressUpdate,
  scheduleProgressCleanup,
} from '../services/progressService.js';
import { processGamesRequest } from '../services/gamesService.js';
import { generateRequestToken } from '../services/tokenService.js';
import {
  GAMES_REQUEST_JSON,
  GAMES_RESPONSE_JSON,
} from '../services/configService.js';

const logGamesRequest = async (payload) => {
  if (!GAMES_REQUEST_JSON) {
    return;
  }

  try {
    await writeFile(
      GAMES_REQUEST_JSON,
      JSON.stringify(payload, null, 2),
      'utf8',
    );
  } catch (logError) {
    console.error(
      `⚠️ Failed to write games request JSON to "${GAMES_REQUEST_JSON}":`,
      logError,
    );
  }
};

const logGamesResponse = async (payload) => {
  if (!GAMES_RESPONSE_JSON) {
    return;
  }

  try {
    await writeFile(
      GAMES_RESPONSE_JSON,
      JSON.stringify(payload, null, 2),
      'utf8',
    );
  } catch (logError) {
    console.error(
      `⚠️ Failed to write games response JSON to "${GAMES_RESPONSE_JSON}":`,
      logError,
    );
  }
};

const ensureUsernameString = (value) => {
  if (typeof value === 'number') {
    return value.toString();
  }
  return value;
};

export const handleGamesRequest = async (req, res) => {
  const payload = req.body ?? {};
  await logGamesRequest(payload);
  const { valid, errors } = validateGamesPayload(payload);

  if (!valid) {
    return res.status(400).json({ errors });
  }

  const usernameInput = ensureUsernameString(payload.username);
  const normalizedInput =
    typeof usernameInput === 'string' ? usernameInput.trim() : usernameInput;
  const username = normalizeUsername(normalizedInput);

  // Generate server-side GUID
  const requestId = crypto.randomUUID();
  const token = generateRequestToken(requestId);
  const progressUrl = `/api/progress/${requestId}`;

  const normalizedPayload = { ...payload, username };

  registerRequest(requestId);

  // Process asynchronously (don't await)
  processGamesRequest({
    payload: { ...payload, username },
    username,
    requestId,
    onProgress: sendProgressUpdate,
  })
    .then((result) => {
      if (result?.status === 'missing_versions') {
        sendProgressUpdate(requestId, 'Missing versions detected', {
          ...result,
          status: 'missing_versions',
        });
        logGamesResponse(result);
        scheduleProgressCleanup(requestId);
        return;
      }

      sendProgressUpdate(requestId, 'Complete', {
        ...result,
        status: 'complete',
      });
      logGamesResponse(result);
      scheduleProgressCleanup(requestId);
    })
    .catch((error) => {
      console.error('❌ Error processing games:', error.message);
      console.error('   Stack trace:', error.stack);
      sendProgressUpdate(requestId, `Error: ${error.message}`, {
        error: true,
        message: error.message,
        status: 'error',
      });
      scheduleProgressCleanup(requestId);
    });

  // Return 202 Accepted immediately
  return res.status(202)
    .set('Retry-After', '1') // Suggest 1 second delay before first poll
    .json({
      requestId,
      token,
      progressUrl,
      message: 'Request accepted and processing started',
    });
};

