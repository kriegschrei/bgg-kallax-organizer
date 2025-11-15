import {
  getProgressById,
  registerRequest,
} from '../services/progressService.js';
import { validateToken } from '../services/tokenService.js';

export const getProgressUpdate = (req, res) => {
  const requestId = req.params.requestId?.trim();
  
  // Get token from header or query parameter
  const token = req.get('x-request-token') || req.query.token;

  if (!requestId) {
    return res.status(400).json({
      errors: [
        {
          field: 'requestId',
          message: 'Request ID is required.',
          received: req.params.requestId,
          expected: 'A non-empty request identifier in the URL path.',
        },
      ],
    });
  }

  if (!token) {
    return res.status(401).json({
      errors: [
        {
          field: 'token',
          message: 'Request token is required.',
          received: null,
          expected: 'A valid token in X-Request-Token header or token query parameter.',
        },
      ],
    });
  }

  // Validate token
  const validation = validateToken(requestId, token);
  if (!validation.valid) {
    return res.status(401).json({
      errors: [
        {
          field: 'token',
          message: `Token validation failed: ${validation.reason}`,
        },
      ],
    });
  }

  registerRequest(requestId);

  const progress = getProgressById(requestId);

  return res.json(
    progress ?? {
      requestId,
      status: 'pending',
      message: null,
      timestamp: Date.now(),
    },
  );
};

