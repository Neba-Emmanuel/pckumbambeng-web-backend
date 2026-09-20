import { Router } from 'express';
import { z, ZodError } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import { preacherService } from '../services/preacher.service';
import { resolveBlobUpload } from './uploads.routes';

export const preacherSchema = z.object({ name: z.string().trim().min(1).max(100), kind: z.enum(['pastor', 'guest']), remove_image: z.boolean().optional() });
const router = Router();
router.use(authMiddleware, adminMiddleware);
router.get('/', async (_req, res) => {
  try { res.json({ success: true, data: await preacherService.list() }); }
  catch { res.status(500).json({ success: false, error: { message: 'Unable to load preachers.' } }); }
});
router.post('/', resolveBlobUpload('preacher_image'), async (req, res) => {
  try {
    const data = preacherSchema.parse(req.body);
    const preacher = await preacherService.create({ name: data.name, kind: data.kind, image_url: res.locals.preacherImage || null });
    res.status(201).json({ success: true, data: preacher });
  } catch (error: any) {
    const conflict = error.code === 'ER_DUP_ENTRY';
    res.status(error instanceof ZodError ? 400 : conflict ? 409 : 500).json({ success: false, error: { message: conflict ? 'A preacher with this name already exists. Select their saved profile.' : error instanceof ZodError ? 'Enter a name (up to 100 characters) and a valid preacher type.' : 'Unable to save preacher.' } });
  }
});
router.put('/:id', resolveBlobUpload('preacher_image'), async (req, res) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const data = preacherSchema.parse(req.body);
    const preacher = await preacherService.update(id, { name: data.name, kind: data.kind, image_url: res.locals.preacherImage ?? (data.remove_image ? null : undefined) });
    if (!preacher) { res.status(404).json({ success: false, error: { message: 'Preacher not found.' } }); return; }
    res.json({ success: true, data: preacher });
  } catch (error: any) {
    const conflict = error.code === 'ER_DUP_ENTRY';
    res.status(error instanceof ZodError ? 400 : conflict ? 409 : 500).json({ success: false, error: { message: conflict ? 'A preacher with this name already exists.' : error instanceof ZodError ? 'Enter a valid preacher profile.' : 'Unable to update preacher.' } });
  }
});
export default router;
