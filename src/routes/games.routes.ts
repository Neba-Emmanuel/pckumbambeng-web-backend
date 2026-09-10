import { Router } from 'express';
import * as gamesController from '../controllers/games.controller';

const router = Router();

// Games are public and stateless — no authentication, no per-user tracking.

// GET /api/games/word-search - Generate a new word search puzzle
router.get('/word-search', gamesController.getWordSearch);

// GET /api/games/daily-word - Get today's daily word metadata (length, max guesses)
router.get('/daily-word', gamesController.getDailyWord);

// POST /api/games/daily-word/guess - Score a single guess against today's word
router.post('/daily-word/guess', gamesController.submitDailyGuess);

export default router;
