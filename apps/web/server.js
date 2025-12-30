import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = join(__dirname, 'dist');

// Serve static files from dist directory
app.use(express.static(DIST_DIR));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'web-frontend' });
});

// SPA fallback: serve index.html for all non-API routes
// This ensures client-side routing works on direct URL access and refresh
// Handle all HTTP methods (GET, POST, etc.) for SPA routing
app.all('*', (req, res, next) => {
  // Skip API routes (these should be handled by backend services)
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  // Skip health check (already handled above)
  if (req.path === '/health') {
    return next();
  }

  // Skip static assets (they should be served by express.static above)
  // This is a safety check - express.static should handle these first
  if (req.path.startsWith('/assets/') || req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    return res.status(404).send('Static asset not found');
  }

  // Serve index.html for all other routes (SPA routing)
  // This allows React Router to handle client-side routing
  const indexPath = join(DIST_DIR, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send('Build files not found. Please run npm run build first.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Web frontend server running on port ${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Serving static files from: ${DIST_DIR}`);
  // eslint-disable-next-line no-console
  console.log('SPA fallback enabled for client-side routing');
});

