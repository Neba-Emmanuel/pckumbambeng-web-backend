import uploadsRoutes from './routes/uploads.routes';
import { facebookService } from './services/facebook.service';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { corsOptions, env } from './config';
import authRoutes from './routes/auth.routes';
import contentRoutes from './routes/content.routes';
import adminFacebookRoutes from './routes/admin-facebook.routes';
import adminRoutes from './routes/admin.routes';
import facebookRoutes from './routes/facebook.routes';
import notificationRoutes from './routes/notification.routes';
import gamesRoutes from './routes/games.routes';
import adminWordListRoutes from './routes/admin-wordlist.routes';

import contactRoutes from './routes/contact.routes';

const app = express();
if (process.env.VERCEL) app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors(corsOptions));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parsing
app.use(cookieParser());

// Static file serving for uploads
app.use('/uploads', express.static(path.resolve(env.upload.dir)));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Optional external scheduler. Embeds do not need Facebook polling.
app.get('/api/cron/facebook', async (req, res) => {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ success: false }); return;
  }
  try { await facebookService.fetchPosts(); res.json({ success: true }); }
  catch { res.status(500).json({ success: false }); }
});
app.use('/api/uploads', uploadsRoutes);

// Never CDN-cache authenticated or database-backed API responses.
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', contentRoutes);
app.use('/api/admin/facebook-sources', adminFacebookRoutes);
app.use('/api/admin/word-list', adminWordListRoutes);
app.use('/api', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/games', gamesRoutes);

export default app;
