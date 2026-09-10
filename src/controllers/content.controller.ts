import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { contentService } from '../services/content.service';
import { sermonService } from '../services/sermon.service';
import { eventService } from '../services/event.service';
import { ApiErrorResponse, ApiSuccessResponse } from '../models/responses';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

// ─── Announcements ───────────────────────────────────────────────────────────

/**
 * GET /api/announcements
 * List announcements with pagination.
 */
export async function listAnnouncements(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const result = await contentService.listAnnouncements(page);

    res.status(200).json({
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      },
    } as ApiSuccessResponse<typeof result.items>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    } as ApiErrorResponse);
  }
}

/**
 * GET /api/announcements/:id
 * Get a single announcement by ID.
 */
export async function getAnnouncement(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid announcement ID',
        },
      } as ApiErrorResponse);
      return;
    }

    const announcement = await contentService.getAnnouncementById(id);
    if (!announcement) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Announcement not found',
        },
      } as ApiErrorResponse);
      return;
    }

    res.status(200).json({
      success: true,
      data: announcement,
    } as ApiSuccessResponse<typeof announcement>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    } as ApiErrorResponse);
  }
}

// ─── Sermons ─────────────────────────────────────────────────────────────────

/**
 * GET /api/sermons
 * List sermons with pagination.
 */
export async function listSermons(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const result = await sermonService.listSermons(page);

    res.status(200).json({
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      },
    } as ApiSuccessResponse<typeof result.items>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    } as ApiErrorResponse);
  }
}

/**
 * GET /api/sermons/:id
 * Get a single sermon with access check.
 */
export async function getSermon(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid sermon ID',
        },
      } as ApiErrorResponse);
      return;
    }

    const sermon = await sermonService.getSermonById(id);

    if (!sermon) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Sermon not found',
        },
      } as ApiErrorResponse);
      return;
    }

    res.status(200).json({
      success: true,
      data: sermon,
    } as ApiSuccessResponse<typeof sermon>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    } as ApiErrorResponse);
  }
}

/**
 * GET /api/sermons/:id/stream
 * Stream sermon audio if member has access.
 */
export async function streamSermon(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid sermon ID',
        },
      } as ApiErrorResponse);
      return;
    }

    const sermon = await sermonService.getSermonById(id);

    if (!sermon) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Sermon not found',
        },
      } as ApiErrorResponse);
      return;
    }

    if (!sermon.audio_path) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No audio file available for this sermon',
        },
      } as ApiErrorResponse);
      return;
    }

    const filePath = path.resolve(env.upload.dir, sermon.audio_path);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Audio file not found on server',
        },
      } as ApiErrorResponse);
      return;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'audio/mpeg',
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    } as ApiErrorResponse);
  }
}

// ─── Events ──────────────────────────────────────────────────────────────────

/**
 * GET /api/events
 * List events for a given month. Defaults to current year/month.
 */
export async function listEvents(req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const year = parseInt(req.query.year as string) || now.getFullYear();
    const month = parseInt(req.query.month as string) || now.getMonth() + 1;

    if (month < 1 || month > 12) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Month must be between 1 and 12',
        },
      } as ApiErrorResponse);
      return;
    }

    const events = await eventService.listEvents(year, month);

    res.status(200).json({
      success: true,
      data: events,
    } as ApiSuccessResponse<typeof events>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    } as ApiErrorResponse);
  }
}

/**
 * GET /api/events/archive
 * List past events with pagination.
 */
export async function listPastEvents(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const result = await eventService.listPastEvents(page);

    res.status(200).json({
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      },
    } as ApiSuccessResponse<typeof result.items>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    } as ApiErrorResponse);
  }
}


