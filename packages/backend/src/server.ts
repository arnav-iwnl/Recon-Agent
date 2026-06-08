import './env.js';
import express from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import researchRoutes from './routes/research.js';
import observabilityRoutes from './routes/observability.js';
import { getDb } from './db/connection.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Initialize database on startup
getDb();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Protected routes — require JWT
app.use('/api/research', authMiddleware, researchRoutes);
app.use('/api/obs', authMiddleware, observabilityRoutes);

app.listen(PORT, () => {
  console.log(`🔬 Deep Research API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});
