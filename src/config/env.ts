import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'pc_kumba_mbeng',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Facebook
  facebook: {
    appId: process.env.FACEBOOK_APP_ID || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
  },

  // Web Push (VAPID)
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:contact@pckumbambeng.org',
  },

  // File Upload
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxAudioSizeMB: parseInt(process.env.MAX_AUDIO_SIZE_MB || '100', 10),
    maxAttachmentSizeMB: parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '10', 10),
  },
};
