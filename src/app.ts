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
