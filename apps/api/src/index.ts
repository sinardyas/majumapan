import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import routes from './routes';
import { runSessionCleanup } from './jobs/sessionCleanup';

const app = new Hono();

// Session cleanup scheduler - run every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

function startCleanupScheduler() {
  // Run immediately on startup
  runSessionCleanup();
  
  // Then run every 5 minutes
  setInterval(() => {
    runSessionCleanup();
  }, CLEANUP_INTERVAL);
  
  console.log('[Scheduler] Session cleanup scheduler started');
}

// Start cleanup scheduler in production or when explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') {
  startCleanupScheduler();
}

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: ['http://localhost:4001', 'http://localhost:4002', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
}));

// API routes
app.route('/api/v1', routes);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'POS System API',
    version: '1.0.0',
    documentation: '/api/v1',
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ success: false, error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    { success: false, error: 'Internal server error' },
    500
  );
});

// Server configuration
const port = parseInt(process.env.API_PORT || '4000', 10);
const host = process.env.API_HOST || '0.0.0.0';

console.log(`Server starting on http://${host}:${port}`);

// Bun native server export
export default {
  port,
  hostname: host,
  fetch: app.fetch,
};
