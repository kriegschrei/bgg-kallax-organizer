import {
  getProgressById,
  registerRequest,
} from '../services/progressService.js';

export const getProgressUpdate = (req, res) => {
  const requestId = req.params.requestId?.trim();

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

