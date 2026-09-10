import axios from 'axios';
import { pool } from '../config/database';
import { FacebookPageSource, FacebookPostCache } from '../models/types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

const FACEBOOK_GRAPH_API_BASE = 'https://graph.facebook.com';
const MAX_POST_LENGTH = 300;
const STALENESS_HOURS = 72;
const POSTS_PER_SOURCE = 10;

export interface FacebookFeedSource {
  page_name: string;
  status: 'available' | 'unavailable';
  posts: FacebookPostCache[];
}

export interface FacebookFeedResult {
  sources: FacebookFeedSource[];
}

export interface AddSourceData {
  page_id: string;
  page_name: string;
  access_token: string;
}

/**
 * Truncate a post message to MAX_POST_LENGTH characters.
 * Appends "..." if the original exceeds the limit.
 */
function truncateMessage(message: string): string {
  if (message.length <= MAX_POST_LENGTH) {
    return message;
  }
  return message.substring(0, MAX_POST_LENGTH) + '...';
}

export class FacebookService {
  /**
   * Fetch posts from Facebook Graph API for active sources.
   * For each active facebook_page_source (or a specific sourceId):
   * - Calls Facebook Graph API: GET /{page_id}/posts?fields=message,created_time&limit=20
   * - Filters to posts that have a 'message' field (text-only, exclude media-only)
   * - Truncates message to 300 chars, appends "..." if exceeded
   * - Upserts into facebook_post_cache (uses fb_post_id as unique key, updates fetched_at)
   */
  async fetchPosts(sourceId?: number): Promise<void> {
    let sources: FacebookPageSource[];

    if (sourceId) {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM facebook_page_sources WHERE id = ? AND is_active = TRUE',
        [sourceId]
      );
      sources = rows as FacebookPageSource[];
    } else {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM facebook_page_sources WHERE is_active = TRUE'
      );
      sources = rows as FacebookPageSource[];
    }

    for (const source of sources) {
      try {
        const response = await axios.get(
          `${FACEBOOK_GRAPH_API_BASE}/${source.page_id}/posts`,
          {
            params: {
              fields: 'message,created_time',
              limit: 20,
              access_token: source.access_token,
            },
            timeout: 10000,
          }
        );

        const posts = response.data?.data;
        if (!Array.isArray(posts)) {
          console.error(
            `[FacebookService] Unexpected response format for source ${source.page_name} (${source.page_id})`
          );
          continue;
        }

        // Filter to text-only posts (must have a 'message' field)
        const textPosts = posts.filter(
          (post: any) => post.message && typeof post.message === 'string'
        );

        // Upsert each post into the cache
        for (const post of textPosts) {
          const fbPostId = post.id;
          const content = truncateMessage(post.message);
          const postedAt = new Date(post.created_time);

          await pool.query<ResultSetHeader>(
            `INSERT INTO facebook_post_cache (source_id, fb_post_id, content, posted_at, fetched_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE content = VALUES(content), fetched_at = NOW()`,
            [source.id, fbPostId, content, postedAt]
          );
        }
      } catch (error: any) {
        // Log error and continue with other sources — graceful degradation
        console.error(
          `[FacebookService] Failed to fetch posts for source ${source.page_name} (${source.page_id}):`,
          error.message || error
        );
      }
    }
  }

  /**
   * Get aggregated Facebook feed grouped by source.
   * Returns 10 most recent posts per source.
   * Checks staleness: if all posts for a source have fetched_at > 72 hours old,
   * marks that source as "unavailable".
   */
  async getFeed(): Promise<FacebookFeedResult> {
    // Get all active sources
    const [sourceRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM facebook_page_sources WHERE is_active = TRUE'
    );
    const sources = sourceRows as FacebookPageSource[];

    const result: FacebookFeedSource[] = [];
    const stalenessThreshold = new Date(
      Date.now() - STALENESS_HOURS * 60 * 60 * 1000
    );

    for (const source of sources) {
      // Get 10 most recent posts for this source
      const [postRows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM facebook_post_cache
         WHERE source_id = ?
         ORDER BY posted_at DESC
         LIMIT ?`,
        [source.id, POSTS_PER_SOURCE]
      );
      const posts = postRows as FacebookPostCache[];

      // Check staleness: if no posts or all posts have fetched_at older than 72 hours
      let status: 'available' | 'unavailable' = 'available';
      if (posts.length === 0) {
        status = 'unavailable';
      } else {
        const allStale = posts.every(
          (post) => new Date(post.fetched_at) < stalenessThreshold
        );
        if (allStale) {
          status = 'unavailable';
        }
      }

      result.push({
        page_name: source.page_name,
        status,
        posts,
      });
    }

    return { sources: result };
  }

  /**
   * List all facebook_page_sources (for admin).
   */
  async getSources(): Promise<FacebookPageSource[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM facebook_page_sources ORDER BY created_at DESC'
    );
    return rows as FacebookPageSource[];
  }

  /**
   * Add a new Facebook page source.
   */
  async addSource(data: AddSourceData): Promise<FacebookPageSource> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO facebook_page_sources (page_id, page_name, access_token, is_active, created_at)
       VALUES (?, ?, ?, TRUE, NOW())`,
      [data.page_id, data.page_name, data.access_token]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM facebook_page_sources WHERE id = ?',
      [result.insertId]
    );

    return rows[0] as FacebookPageSource;
  }

  /**
   * Deactivate a Facebook page source (set is_active = false).
   * Returns true if deactivated, false if source not found.
   */
  async deactivateSource(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE facebook_page_sources SET is_active = FALSE WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }
}

export const facebookService = new FacebookService();
