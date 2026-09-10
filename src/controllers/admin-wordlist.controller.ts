import { Request, Response } from 'express';
import { wordPuzzleService } from '../services/word-puzzle.service';
import { WordCategory } from '../models/types';
import { ApiSuccessResponse, ApiErrorResponse } from '../models/responses';

/**
 * GET /api/admin/word-list
 * List custom words added to the word list (optional enrichment).
 */
export async function listWords(_req: Request, res: Response): Promise<void> {
  try {
    const words = await wordPuzzleService.listCustomWords();
    res.status(200).json({
      success: true,
      data: words,
    } as ApiSuccessResponse<typeof words>);
  } catch (error) {
    console.error('[AdminWordListController] listWords error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    } as ApiErrorResponse);
  }
}

/**
 * POST /api/admin/word-list
 * Add a Bible-themed word to the word list.
 * Body: { word: string, category: 'name'|'place'|'book'|'theme' }
 */
export async function addWord(req: Request, res: Response): Promise<void> {
  try {
    if (!req.member) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      } as ApiErrorResponse);
      return;
    }

    const word = String(req.body?.word ?? '');
    const category = req.body?.category as WordCategory;

    const entry = await wordPuzzleService.addWord(word, category, req.member.id);

    res.status(201).json({
      success: true,
      data: entry,
    } as ApiSuccessResponse<typeof entry>);
  } catch (error: any) {
    const knownCodes: Record<string, number> = {
      INVALID_WORD: 400,
      INVALID_CATEGORY: 400,
      DUPLICATE_WORD: 409,
    };
    if (error?.code && knownCodes[error.code]) {
      res.status(knownCodes[error.code]).json({
        success: false,
        error: { code: error.code, message: error.message },
      } as ApiErrorResponse);
      return;
    }

    console.error('[AdminWordListController] addWord error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    } as ApiErrorResponse);
  }
}

/**
 * DELETE /api/admin/word-list/:id
 * Remove a custom word from the word list (bundled words are protected).
 */
export async function removeWord(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid word ID' },
      } as ApiErrorResponse);
      return;
    }

    const removed = await wordPuzzleService.removeWord(id);
    if (!removed) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Custom word not found (bundled words cannot be removed)',
        },
      } as ApiErrorResponse);
      return;
    }

    res.status(200).json({
      success: true,
      data: { message: 'Word removed' },
    } as ApiSuccessResponse<{ message: string }>);
  } catch (error) {
    console.error('[AdminWordListController] removeWord error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    } as ApiErrorResponse);
  }
}
