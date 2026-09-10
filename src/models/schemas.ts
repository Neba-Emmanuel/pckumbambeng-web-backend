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

export const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  event_date: z.string().datetime(),
  location: z.string().min(1).max(300),
  description: z.string().min(1).max(2000),
});

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
