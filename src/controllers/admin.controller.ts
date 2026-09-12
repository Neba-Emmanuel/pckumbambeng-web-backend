import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { contentService, validateAttachment } from '../services/content.service';
import { sermonService, validateAudioFile } from '../services/sermon.service';
import { eventService } from '../services/event.service';
import { notificationService } from '../services/notification.service';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  createSermonSchema,
  updateSermonSchema,
  createEventSchema,
  updateEventSchema,
} from '../models/schemas';
import { ApiErrorResponse, ApiSuccessResponse } from '../models/responses';

// ─── Announcements ───────────────────────────────────────────────────────────

/**
 * POST /api/admin/announcements
 * Create announcement with optional file upload (PDF/PNG/JPG ≤10MB).
 */
export async function createAnnouncement(req: Request, res: Response): Promise<void> {
  try {
    const parsed = createAnnouncementSchema.parse(req.body);

    let attachment_path: string | null = null;
    let attachment_type: string | null = null;

    // Handle file upload if present
    if (req.file) {
      attachment_type = validateAttachment(req.file.mimetype, req.file.size);
      attachment_path = req.file.filename;
    }

    const announcement = await contentService.createAnnouncement({
      title: parsed.title,
      body: parsed.body,
      attachment_path,
      attachment_type,
      created_by: req.member!.id,
    });

    // Trigger notification for all members
    notificationService
      .createNotification('announcement', announcement.id, 'New Announcement', parsed.title)
      .catch(() => {
        // Fire-and-forget: don't block response on notification failure
      });

    res.status(201).json({
      success: true,
      data: announcement,
    } as ApiSuccessResponse<typeof announcement>);
  } catch (error: any) {
    console.error('[AdminController] createAnnouncement error:', error);
    if (error instanceof ZodError) {
      const details: Record<string, string> = {};
      for (const issue of error.issues) {
        const field = issue.path.join('.');
        details[field] = issue.message;
      }
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid announcement data',
          details,
        },
      } as ApiErrorResponse);
      return;
    }

    if (error.code === 'INVALID_FILE_TYPE' || error.code === 'FILE_TOO_LARGE') {
      res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      } as ApiErrorResponse);
      return;
    }

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
 * PUT /api/admin/announcements/:id
 * Update an existing announcement.
 */
export async function updateAnnouncement(req: Request, res: Response): Promise<void> {
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

    const parsed = updateAnnouncementSchema.parse(req.body);

    let attachment_path: string | undefined | null = undefined;
    let attachment_type: string | undefined | null = undefined;

    // Handle file upload if present
    if (req.file) {
      attachment_type = validateAttachment(req.file.mimetype, req.file.size);
      attachment_path = req.file.filename;
    }

    const updateData: any = { ...parsed };
    if (attachment_path !== undefined) {
      updateData.attachment_path = attachment_path;
      updateData.attachment_type = attachment_type;
    }

    const announcement = await contentService.updateAnnouncement(id, updateData);

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
  } catch (error: any) {
    if (error instanceof ZodError) {
      const details: Record<string, string> = {};
      for (const issue of error.issues) {
        const field = issue.path.join('.');
        details[field] = issue.message;
      }
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid announcement data',
          details,
        },
      } as ApiErrorResponse);
      return;
    }

    if (error.code === 'INVALID_FILE_TYPE' || error.code === 'FILE_TOO_LARGE') {
      res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      } as ApiErrorResponse);
      return;
    }

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
 * DELETE /api/admin/announcements/:id
 * Delete an announcement.
 */
export async function deleteAnnouncement(req: Request, res: Response): Promise<void> {
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

    const deleted = await contentService.deleteAnnouncement(id);

    if (!deleted) {
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
      data: { message: 'Announcement deleted successfully' },
    } as ApiSuccessResponse<{ message: string }>);
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
 * POST /api/admin/sermons
 * Create sermon with optional audio upload (MP3/WAV ≤100MB).
 */
export async function createSermon(req: Request, res: Response): Promise<void> {
  try {
    const body = { ...req.body };

    const parsed = createSermonSchema.parse(body);

    let audio_path: string | null = null;

    // Handle audio file upload if present
    if (req.file) {
      validateAudioFile(req.file.mimetype, req.file.size);
      audio_path = req.file.filename;
    }

    const sermon = await sermonService.createSermon({
      title: parsed.title,
      speaker: parsed.speaker,
      sermon_date: parsed.sermon_date,
      content_type: parsed.content_type,
      text_content: (body.text_content as string) || null,
      audio_path,
      created_by: req.member!.id,
    });

    // Announce the new sermon via anonymous push (fire-and-forget)
    notificationService
      .createNotification('sermon', sermon.id, 'New Sermon', parsed.title)
      .catch(() => {
        // Don't block the response on notification failure
      });

    res.status(201).json({
      success: true,
      data: sermon,
    } as ApiSuccessResponse<typeof sermon>);
  } catch (error: any) {
    console.error('[AdminController] createSermon error:', error);
    if (error instanceof ZodError) {
      const details: Record<string, string> = {};
      for (const issue of error.issues) {
        const field = issue.path.join('.');
        details[field] = issue.message;
      }
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid sermon data',
          details,
        },
      } as ApiErrorResponse);
      return;
    }

    if (error.code === 'INVALID_FILE_TYPE' || error.code === 'FILE_TOO_LARGE') {
      res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      } as ApiErrorResponse);
      return;
    }

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
 * PUT /api/admin/sermons/:id
 * Update an existing sermon.
 */
export async function updateSermon(req: Request, res: Response): Promise<void> {
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

    const body = { ...req.body };

    const parsed = updateSermonSchema.parse(body);

    let audio_path: string | undefined = undefined;

    // Handle audio file upload if present
    if (req.file) {
      validateAudioFile(req.file.mimetype, req.file.size);
      audio_path = req.file.filename;
    }

    const updateData: any = { ...parsed };
    if (audio_path !== undefined) {
      updateData.audio_path = audio_path;
    }

    const sermon = await sermonService.updateSermon(id, updateData);

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
  } catch (error: any) {
    if (error instanceof ZodError) {
      const details: Record<string, string> = {};
      for (const issue of error.issues) {
        const field = issue.path.join('.');
        details[field] = issue.message;
      }
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid sermon data',
          details,
        },
      } as ApiErrorResponse);
      return;
    }

    if (error.code === 'INVALID_FILE_TYPE' || error.code === 'FILE_TOO_LARGE') {
      res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      } as ApiErrorResponse);
      return;
    }

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
 * DELETE /api/admin/sermons/:id
 * Delete a sermon. Purchase records are retained for members who bought it.
 */
export async function deleteSermon(req: Request, res: Response): Promise<void> {
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

    const deleted = await sermonService.deleteSermon(id);

    if (!deleted) {
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
      data: { message: 'Sermon deleted successfully. Purchase records have been retained.' },
    } as ApiSuccessResponse<{ message: string }>);
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
 * POST /api/admin/events
 * Create a new event.
 */
export async function createEvent(req: Request, res: Response): Promise<void> {
  try {
    const parsed = createEventSchema.parse(req.body);

    const event = await eventService.createEvent({
      title: parsed.title,
      event_date: parsed.event_date,
      detail_page_status: parsed.detail_page_status,
      detail_page_path: parsed.detail_page_path,
      location: parsed.location,
      description: parsed.description,
      created_by: req.member!.id,
    });

    // Trigger notification for all members
    notificationService
      .createNotification('event', event.id, 'New Event', parsed.title)
      .catch(() => {
        // Fire-and-forget: don't block response on notification failure
      });

    res.status(201).json({
      success: true,
      data: event,
    } as ApiSuccessResponse<typeof event>);
  } catch (error: any) {
    console.error('[AdminController] createEvent error:', error);
    if (error instanceof ZodError) {
      const details: Record<string, string> = {};
      for (const issue of error.issues) {
        const field = issue.path.join('.');
        details[field] = issue.message;
      }
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid event data',
          details,
        },
      } as ApiErrorResponse);
      return;
    }

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
 * PUT /api/admin/events/:id
 * Update an existing event.
 */
export async function updateEvent(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid event ID',
        },
      } as ApiErrorResponse);
      return;
    }

    const parsed = updateEventSchema.parse(req.body);

    const event = await eventService.updateEvent(id, parsed);

    if (!event) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Event not found',
        },
      } as ApiErrorResponse);
      return;
    }

    res.status(200).json({
      success: true,
      data: event,
    } as ApiSuccessResponse<typeof event>);
  } catch (error: any) {
    if (error instanceof ZodError) {
      const details: Record<string, string> = {};
      for (const issue of error.issues) {
        const field = issue.path.join('.');
        details[field] = issue.message;
      }
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid event data',
          details,
        },
      } as ApiErrorResponse);
      return;
    }

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
 * DELETE /api/admin/events/:id
 * Delete an event.
 */
export async function deleteEvent(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid event ID',
        },
      } as ApiErrorResponse);
      return;
    }

    const deleted = await eventService.deleteEvent(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Event not found',
        },
      } as ApiErrorResponse);
      return;
    }

    res.status(200).json({
      success: true,
      data: { message: 'Event deleted successfully' },
    } as ApiSuccessResponse<{ message: string }>);
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
