import { Router, RequestHandler } from 'express';
import { handleUpload } from '@vercel/blob/client';
import { head } from '@vercel/blob';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const router = Router();
const audioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav'];
const attachmentTypes = ['application/pdf', 'image/png', 'image/jpeg'];

router.post('/blob', async (req, res) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.BLOB_PUBLIC_BASE_URL) {
    res.status(503).json({ error: 'File storage is not configured. Connect a Vercel Blob store.' });
    return;
  }
  try {
    const result = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async pathname => {
        const user = jwt.verify(req.cookies?.token || '', env.jwt.secret) as jwt.JwtPayload;
        if (user.role !== 'administrator') throw new Error('Administrator access required');
        if (!/^(sermons|announcements)\/[a-f0-9-]{36}\.[a-z0-9]+$/.test(pathname)) throw new Error('Invalid upload path');
        const audio = pathname.startsWith('sermons/');
        return {
          allowedContentTypes: audio ? audioTypes : attachmentTypes,
          maximumSizeInBytes: (audio ? env.upload.maxAudioSizeMB : env.upload.maxAttachmentSizeMB) * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      // The SDK verifies Blob callback signatures; callbacks have no admin cookie.
      onUploadCompleted: async () => {},
    });
    res.json(result);
  } catch {
    res.status(400).json({ error: 'Upload authorization failed. Sign in as an administrator and try again.' });
  }
});

// Run only after admin authentication. Verify saved URLs against this store
// and check actual object metadata rather than trusting browser MIME/size.
export function resolveBlobUpload(field: 'audio' | 'attachment'): RequestHandler {
  return async (req, res, next) => {
    const value = req.body?.[`${field}_url`];
    if (value === undefined) { next(); return; }
    try {
      const base = new URL(process.env.BLOB_PUBLIC_BASE_URL || '');
      const url = new URL(value);
      const prefix = field === 'audio' ? '/sermons/' : '/announcements/';
      if (url.protocol !== 'https:' || url.origin !== base.origin || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(prefix)) throw new Error('Invalid file URL');
      const metadata = await head(url.href);
      const allowed = field === 'audio' ? audioTypes : attachmentTypes;
      const max = (field === 'audio' ? env.upload.maxAudioSizeMB : env.upload.maxAttachmentSizeMB) * 1024 * 1024;
      if (!allowed.includes(metadata.contentType) || metadata.size > max) throw new Error('Invalid file');
      // Existing controllers persist filename and validate mimetype/size.
      req.file = { filename: url.href, mimetype: metadata.contentType === 'audio/mp3' ? 'audio/mpeg' : metadata.contentType, size: metadata.size } as Express.Multer.File;
      next();
    } catch {
      res.status(400).json({ success: false, error: { code: 'INVALID_FILE', message: 'The uploaded file could not be verified. Check storage configuration or upload it again.' } });
    }
  };
}

export default router;
