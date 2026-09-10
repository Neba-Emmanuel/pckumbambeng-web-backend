import { pool } from '../config/database';
import { WordListEntry } from '../models/types';
import { RowDataPacket } from 'mysql2';
import crypto from 'crypto';

// ─── Configuration ───────────────────────────────────────────────────────────

/** Length of the daily word (Wordle-style). */
export const DAILY_WORD_LENGTH = 5;

/** Maximum guesses allowed per day for the daily word puzzle (client-enforced). */
export const DAILY_MAX_GUESSES = 6;

/** Word search grid dimensions and word count per difficulty. */
const WORD_SEARCH_CONFIG: Record<
  string,
  { size: number; wordCount: number; maxWordLen: number }
> = {
  easy: { size: 8, wordCount: 5, maxWordLen: 7 },
  medium: { size: 10, wordCount: 7, maxWordLen: 9 },
  hard: { size: 12, wordCount: 9, maxWordLen: 11 },
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ─── Types ───────────────────────────────────────────────────────────────────

export type LetterFeedback = 'correct' | 'present' | 'absent';

export interface WordSearchPuzzle {
  size: number;
  grid: string[][];
  words: string[];
  difficulty: string;
}

// Placement directions for word search: [rowDelta, colDelta]
const DIRECTIONS = [
  [0, 1], // horizontal →
  [1, 0], // vertical ↓
  [1, 1], // diagonal ↘
  [1, -1], // diagonal ↙
];

export class WordPuzzleService {
  // ─── Word list access ──────────────────────────────────────────────────────

  /** Fetch all words in the word list (uppercase, alphabetic). */
  private async getAllWords(): Promise<WordListEntry[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM word_list_entry ORDER BY word ASC'
    );
    return rows as WordListEntry[];
  }

  /** Fetch words of an exact length, sorted deterministically. */
  private async getWordsByLength(length: number): Promise<string[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT word FROM word_list_entry WHERE CHAR_LENGTH(word) = ? ORDER BY word ASC',
      [length]
    );
    return (rows as { word: string }[]).map((r) => r.word);
  }

  // ─── Word search generation ──────────────────────────────────────────────────

  /**
   * Generate a new word search puzzle by selecting words from the word list
   * and placing them in a grid among random filler letters.
   *
   * The solution key (placements) is intentionally NOT returned.
   */
  async generateWordSearch(difficulty: string = 'medium'): Promise<WordSearchPuzzle> {
    const config = WORD_SEARCH_CONFIG[difficulty] ?? WORD_SEARCH_CONFIG.medium;
    const all = await this.getAllWords();

    const candidates = all
      .map((w) => w.word)
      .filter((w) => w.length <= Math.min(config.maxWordLen, config.size));

    const chosen = this.pickRandom(candidates, config.wordCount);

    let grid: (string | null)[][] = [];
    let placed: string[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      grid = this.emptyGrid(config.size);
      placed = [];
      for (const word of chosen) {
        if (this.placeWord(grid, word)) {
          placed.push(word);
        }
      }
      if (placed.length === chosen.length) break;
    }

    const filled: string[][] = grid.map((row) =>
      row.map((cell) => cell ?? this.randomLetter())
    );

    return {
      size: config.size,
      grid: filled,
      words: placed.sort(),
      difficulty: difficulty in WORD_SEARCH_CONFIG ? difficulty : 'medium',
    };
  }

  // ─── Daily word puzzle (stateless) ───────────────────────────────────────────

  /**
   * Deterministically select the daily answer word for a given date.
   * The same date yields the same word for all visitors.
   */
  async getDailyAnswer(date: string): Promise<string | null> {
    const words = await this.getWordsByLength(DAILY_WORD_LENGTH);
    if (words.length === 0) return null;

    const hash = crypto.createHash('sha256').update(date).digest();
    const index = hash.readUInt32BE(0) % words.length;
    return words[index];
  }

  /**
   * Two-pass Wordle scoring: first mark exact-position matches as "correct",
   * then mark remaining letters present elsewhere as "present" respecting
   * letter multiplicity; all others "absent".
   */
  scoreGuess(guess: string, answer: string): LetterFeedback[] {
    const g = guess.toUpperCase();
    const a = answer.toUpperCase();
    const feedback: LetterFeedback[] = new Array(g.length).fill('absent');

    const remaining: Record<string, number> = {};
    for (let i = 0; i < a.length; i++) {
      if (g[i] === a[i]) {
        feedback[i] = 'correct';
      } else {
        remaining[a[i]] = (remaining[a[i]] ?? 0) + 1;
      }
    }

    for (let i = 0; i < g.length; i++) {
      if (feedback[i] === 'correct') continue;
      const c = g[i];
      if (remaining[c] > 0) {
        feedback[i] = 'present';
        remaining[c] -= 1;
      }
    }

    return feedback;
  }

  // ─── Admin word-list management (optional enrichment) ─────────────────────────

  /** List custom words added by administrators (is_custom = TRUE). */
  async listCustomWords(): Promise<WordListEntry[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM word_list_entry WHERE is_custom = TRUE ORDER BY word ASC'
    );
    return rows as WordListEntry[];
  }

  /**
   * Add a Bible-themed word to the word list. Validates alphabetic + length.
   * Throws with a `code` for known validation / conflict errors.
   */
  async addWord(
    rawWord: string,
    category: import('../models/types').WordCategory,
    addedBy: number
  ): Promise<WordListEntry> {
    const word = (rawWord || '').toUpperCase().trim();

    if (!/^[A-Z]+$/.test(word)) {
      const err: any = new Error('Word must contain only letters');
      err.code = 'INVALID_WORD';
      throw err;
    }
    if (word.length < 3 || word.length > 12) {
      const err: any = new Error('Word must be between 3 and 12 letters');
      err.code = 'INVALID_WORD';
      throw err;
    }

    try {
      const [result] = await pool.query<import('mysql2').ResultSetHeader>(
        `INSERT INTO word_list_entry (word, category, is_custom, added_by)
         VALUES (?, ?, TRUE, ?)`,
        [word, category, addedBy]
      );
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM word_list_entry WHERE id = ?',
        [result.insertId]
      );
      return rows[0] as WordListEntry;
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') {
        const err: any = new Error('Word already exists in the list');
        err.code = 'DUPLICATE_WORD';
        throw err;
      }
      throw e;
    }
  }

  /** Remove a custom word by id (bundled seed words are protected). */
  async removeWord(id: number): Promise<boolean> {
    const [result] = await pool.query<import('mysql2').ResultSetHeader>(
      'DELETE FROM word_list_entry WHERE id = ? AND is_custom = TRUE',
      [id]
    );
    return result.affectedRows > 0;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private emptyGrid(size: number): (string | null)[][] {
    return Array.from({ length: size }, () =>
      Array.from({ length: size }, () => null as string | null)
    );
  }

  private placeWord(grid: (string | null)[][], word: string): boolean {
    const size = grid.length;
    const attempts = 60;
    for (let i = 0; i < attempts; i++) {
      const [dr, dc] = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);

      const endRow = row + dr * (word.length - 1);
      const endCol = col + dc * (word.length - 1);
      if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;

      let ok = true;
      for (let k = 0; k < word.length; k++) {
        const r = row + dr * k;
        const c = col + dc * k;
        const cell = grid[r][c];
        if (cell !== null && cell !== word[k]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      for (let k = 0; k < word.length; k++) {
        grid[row + dr * k][col + dc * k] = word[k];
      }
      return true;
    }
    return false;
  }

  private randomLetter(): string {
    return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }

  private pickRandom<T>(arr: T[], count: number): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(count, copy.length));
  }
}

export const wordPuzzleService = new WordPuzzleService();
