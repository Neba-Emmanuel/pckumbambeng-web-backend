import { Request, Response } from 'express';
import { facebookService } from '../services/facebook.service';
import { ApiErrorResponse, ApiSuccessResponse } from '../models/responses';

/**
 * GET /api/facebook/feed
 * Return the aggregated Facebook feed grouped by source page.
 * Returns 10 most recent posts per source, ordered newest first.
 */
export async function getFeed(_req: Request, res: Response): Promise<void> {
  try {
    const feed = await facebookService.getFeed();

    res.status(200).json({
      success: true,
      data: feed,
    } as ApiSuccessResponse<typeof feed>);
  } catch (error: any) {
    console.error('[FacebookController] Error fetching feed:', error.message || error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching the Facebook feed',
      },
    } as ApiErrorResponse);
  }
}
