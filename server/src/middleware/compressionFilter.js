import compression from 'compression';

export const compressionFilter = (req, res) => {
  if (req.path?.includes('/progress')) {
    return false;
  }

  if (req.headers.accept?.includes('text/event-stream')) {
    return false;
  }

  return compression.filter(req, res);
};

