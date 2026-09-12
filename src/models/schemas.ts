import { z } from 'zod';

// Auth schemas (administrator login only)

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Content schemas

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
});

export const createSermonSchema = z.object({
  title: z.string().min(1),
  speaker: z.string().min(1),
  sermon_date: z.string().date(),
  content_type: z.enum(['audio', 'text']),
});

const eventPageFields = {
  detail_page_status: z.enum(['off', 'not_started', 'draft', 'published']),
  detail_page_path: z.string().regex(/^\/events\/(?!archive$)[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use an event page path such as /events/cultural-harvest-2026').max(240).nullable(),
};

export const createEventSchema = z.object({
  detail_page_status: eventPageFields.detail_page_status.default('off'),
  detail_page_path: eventPageFields.detail_page_path.default(null),
  title: z.string().min(1).max(200),
  event_date: z.string().datetime(),
  location: z.string().min(1).max(300),
  description: z.string().min(1).max(2000),
}).refine(data => data.detail_page_status !== 'published' || !!data.detail_page_path, { message: 'A published page needs its event page path', path: ['detail_page_path'] });

// Update schemas (partial versions for PUT operations)

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).optional(),
});

export const updateSermonSchema = z.object({
  title: z.string().min(1).optional(),
  speaker: z.string().min(1).optional(),
  sermon_date: z.string().date().optional(),
  content_type: z.enum(['audio', 'text']).optional(),
  text_content: z.string().optional().nullable(),
});

export const updateEventSchema = z.object({
  detail_page_status: eventPageFields.detail_page_status.optional(),
  detail_page_path: eventPageFields.detail_page_path.optional(),
  title: z.string().min(1).max(200).optional(),
  event_date: z.string().datetime().optional(),
  location: z.string().min(1).max(300).optional(),
  description: z.string().min(1).max(2000).optional(),
});

// Inferred types for request bodies

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type CreateSermonInput = z.infer<typeof createSermonSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type UpdateSermonInput = z.infer<typeof updateSermonSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
