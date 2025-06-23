import express from 'express';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

// Simple health check endpoint (no Devvit dependencies)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mode: 'standalone'
  });
});

// Legacy API endpoints for development/testing
// These will be deprecated in favor of webview messaging
app.get('/api/poem/state', (req, res) => {
  res.status(503).json({
    status: 'error',
    message: 'This endpoint is deprecated. Please use the Devvit webview for full functionality.',
    suggestion: 'Create a post in your test subreddit to access the poem generator.'
  });
});

app.post('/api/poem/vote', (req, res) => {
  res.status(503).json({
    status: 'error',
    message: 'This endpoint is deprecated. Please use the Devvit webview for full functionality.',
    suggestion: 'Create a post in your test subreddit to access the poem generator.'
  });
});

app.post('/api/poem/generate', (req, res) => {
  res.status(503).json({
    status: 'error',
    message: 'This endpoint is deprecated. Please use the Devvit webview for full functionality.',
    suggestion: 'Create a post in your test subreddit to access the poem generator.'
  });
});

app.post('/api/poem/admin/simulate', (req, res) => {
  res.status(503).json({
    status: 'error',
    message: 'This endpoint is deprecated. Please use the Devvit webview for full functionality.',
    suggestion: 'Create a post in your test subreddit to access the poem generator.'
  });
});

app.get('/api/poem/daily/:date?', (req, res) => {
  res.status(503).json({
    status: 'error',
    message: 'This endpoint is deprecated. Please use the Devvit webview for full functionality.',
    suggestion: 'Create a post in your test subreddit to access the poem generator.'
  });
});

// Catch-all for API routes that don't exist
app.use('/api/*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `API endpoint ${req.path} not found`,
    note: 'Most functionality has moved to Devvit webview messaging'
  });
});

// Export the app for Devvit to use
export default app;