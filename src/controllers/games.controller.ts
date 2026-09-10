import { Request, Response } from 'express';
import {
  wordPuzzleService,
  DAILY_WORD_LENGTH,
  DAILY_MAX_GUESSES,
} from '../services/word-puzzle.service';
import { ApiErrorResponse, ApiSuccessResponse } from '../models/responses';

/** Return the current server calendar date as YYYY-MM-DD. */
function todayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * GET /api/games/word-search
 * Generate and return a new word search puzzle (grid + word list). Public, stateless.
 */
export async function getWordSearch(req: Request, res: Response): Promise<void> {
  try {
    const difficulty = (req.query.difficulty as string) || 'medium';
    const puzzle = await wordPuzzleService.generateWordSearch(difficulty);

    res.status(200).json({
      success: true,
      data: puzzle,
    } as ApiSuccessResponse<typeof puzzle>);
  } catch (error) {
    console.error('[GamesController] getWordSearch error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    } as ApiErrorResponse);
  }
}

/**
 * GET /api/games/daily-word
 * Return today's daily word metadata (length + max guesses). Public, stateless.
 * The answer is never sent; guesses are scored via the guess endpoint.
 */
export async function getDailyWord(_req: Request, res: Response): Promise<void> {
  try {
    const date = todayString();
    const answer = await wordPuzzleService.getDailyAnswer(date);

    if (!answer) {
      res.status(200).json({
        success: true,
        data: null,
      } as ApiSuccessResponse<null>);
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        date,
        length: DAILY_WORD_LENGTH,
        maxGuesses: DAILY_MAX_GUESSES,
      },
    } as ApiSuccessResponse<{ date: string; length: number; maxGuesses: number }>);
  } catch (error) {
    console.error('[GamesController] getDailyWord error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    } as ApiErrorResponse);
  }
}

/**
 * POST /api/games/daily-word/guess
 * Score a single guess against today's answer. Public, stateless — the client
 * tracks its own attempt count and enforces the guess limit.
 * Body: { guess: string }
 * Returns: { feedback: LetterFeedback[], solved: boolean, answer?: string }
 */
export async function submitDailyGuess(req: Request, res: Response): Promise<void> {
  try {
    const date = todayString();
    const answer = await wordPuzzleService.getDailyAnswer(date);

    if (!answer) {
      res.status(404).json({
        success: false,
        error: { code: 'NO_PUZZLE', message: 'No daily puzzle is available today' },
      } as ApiErrorResponse);
      return;
    }

    const guess = String(req.body?.guess ?? '').toUpperCase().trim();
    if (!/^[A-Z]+$/.test(guess) || guess.length !== DAILY_WORD_LENGTH) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_GUESS',
          message: `Guess must be ${DAILY_WORD_LENGTH} alphabetic letters`,
        },
      } as ApiErrorResponse);
      return;
    }

    const feedback = wordPuzzleService.scoreGuess(guess, answer);
    const solved = guess === answer;

    res.status(200).json({
      success: true,
      data: {
        feedback,
        solved,
        // Reveal the answer only when the guess is correct.
        answer: solved ? answer : undefined,
      },
    } as ApiSuccessResponse<{ feedback: typeof feedback; solved: boolean; answer?: string }>);
  } catch (error) {
    console.error('[GamesController] submitDailyGuess error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    } as ApiErrorResponse);
  }
}
