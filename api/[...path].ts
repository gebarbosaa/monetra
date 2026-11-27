import { app } from '../packages/backend/src/app';

// Express remains the single API router. Vercel owns the request lifecycle;
// the app module detects VERCEL=1 and does not bind a persistent HTTP listener.
export default app;
