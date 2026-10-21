import { createHmac } from 'node:crypto';
import { ApiError } from '../utils/errors.js';

// A shared PostgreSQL counter prevents API replicas from each granting a fresh quota.
// IP identifiers are HMACed; request bodies and account emails never enter these keys.
export function requestLimit(pool, { scope, limit, seconds, secret, perUser = false }) {
  return async (req, res, next) => {
    try {
      const subject = perUser ? req.user.id : req.ip;
      const key = `${scope}:${createHmac('sha256', secret).update(subject ?? 'unknown').digest('hex')}`;
      const { rows: [row] } = await pool.query(`INSERT INTO request_limits(bucket_key,window_start,expires_at,hits)
        SELECT $1,floor(extract(epoch FROM clock_timestamp())/$2)::bigint,
          to_timestamp((floor(extract(epoch FROM clock_timestamp())/$2)+1)*$2),1
        ON CONFLICT(bucket_key,window_start) DO UPDATE SET hits=LEAST(request_limits.hits+1,1000000)
        RETURNING hits,GREATEST(1,ceil(extract(epoch FROM expires_at-clock_timestamp())))::int AS retry_after`, [key, seconds]);
      // Bounded maintenance, including expired buckets from former API instances.
      await pool.query(`DELETE FROM request_limits WHERE (bucket_key,window_start) IN
        (SELECT bucket_key,window_start FROM request_limits WHERE expires_at<now() ORDER BY expires_at LIMIT 100)`);
      if (row.hits > limit) {
        res.set('Retry-After', String(row.retry_after));
        return next(new ApiError(429, 'RATE_LIMITED', 'Too many requests; please try again later'));
      }
      next();
    } catch (error) { next(error); }
  };
}
