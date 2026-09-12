/**
 * In-memory rate limiter (fixed window per key).
 *
 * Suitable for a single Worker/instance deployment. For multi-instance
 * deployments, back this with Cloudflare KV or a shared store — the
 * interface is intentionally small to make that swap trivial.
 */

const buckets = new Map();

function createLimiter({ windowMs = 60_000, max = 100, message = "Too many requests, please try again later." }) {
  const sweep = () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.resetAt > windowMs) buckets.delete(key);
      else break;
    }
  };

  // Periodic cleanup, unref'd so it never holds the process open.
  const timer = setInterval(sweep, Math.max(windowMs, 10_000));
  if (timer.unref) timer.unref();

  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      return res.status(429).json({ error: message });
    }

    next();
  };
}

/** Brute-force protection for authentication endpoints. */
export const authLimiter = createLimiter({
  windowMs: 10 * 60_000,
  max: 20,
  message: "Too many authentication attempts. Please try again in a few minutes.",
});

/** General API limiter. */
export const apiLimiter = createLimiter({
  windowMs: 60_000,
  max: 300,
  message: "Rate limit exceeded. Please slow down.",
});
