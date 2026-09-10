import { Request, Response } from 'express';
import { facebookService } from '../services/facebook.service';
import { ApiSuccessResponse, ApiErrorResponse } from '../models/responses';

/**
 * GET /api/admin/facebook-sources
 * List all configured Facebook page sources.
 */
export async function listSources(_req: Request, res: Response): Promise<void> {
  try {
    const sources = await facebookService.getSources();

    res.status(200).json({
      success: true,
      data: sources,
    } as ApiSuccessResponse<typeof sources>);
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
 * POST /api/admin/facebook-sources
 * Add a new Facebook page source.
 * Required body: { page_id, page_name, access_token }
 */
export async function addSource(req: Request, res: Response): Promise<void> {
  try {
    const { page_id, page_name, access_token } = req.body;

    // Validate required fields
    const errors: Record<string, string> = {};
    if (!page_id || typeof page_id !== 'string' || page_id.trim() === '') {
      errors.page_id = 'page_id is required';
    }
    if (!page_name || typeof page_name !== 'string' || page_name.trim() === '') {
      errors.page_name = 'page_name is required';
    }
    if (!access_token || typeof access_token !== 'string' || access_token.trim() === '') {
      errors.access_token = 'access_token is required';
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing or invalid required fields',
          details: errors,
        },
      } as ApiErrorResponse);
      return;
    }

    const source = await facebookService.addSource({
      page_id: page_id.trim(),
      page_name: page_name.trim(),
      access_token: access_token.trim(),
    });

    res.status(201).json({
      success: true,
      data: source,
    } as ApiSuccessResponse<typeof source>);
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
 * DELETE /api/admin/facebook-sources/:id
 * Deactivate a Facebook page source.
 */
export async function deactivateSource(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid source ID',
        },
      } as ApiErrorResponse);
      return;
    }

    const deactivated = await facebookService.deactivateSource(id);

    if (!deactivated) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Facebook source not found',
        },
      } as ApiErrorResponse);
      return;
    }

    res.status(200).json({
      success: true,
      data: { message: 'Source deactivated successfully' },
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
