/**
 * Rate limiting middleware with pluggable storage backends.
 */

export interface RateLimitStore {
  get(key: string): Promise<{ count: number; resetAt: number } | null>;
  set(key: string, value: { count: number; resetAt: number }): Promise<void>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetAt: number }>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        const now = Date.now();
        for (const [key, value] of this.store.entries()) {
          if (now > value.resetAt) {
            this.store.delete(key);
          }
        }
      },
      5 * 60 * 1000,
    );
  }

  async get(key: string) {
    return this.store.get(key) || null;
  }

  async set(key: string, value: { count: number; resetAt: number }) {
    this.store.set(key, value);
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMITS: Record<string, number> = {
  "/api/wrapped/get": 10,
  "/api/wrapped/season/get": 10,
  "/api/wrapped/year/get": 10,
  "/api/report/get": 20,
  "/api/player/search": 30,
  "/api/analytics/track": 100,
  default: 60,
};

export function createRateLimitMiddleware(store: RateLimitStore) {
  return async (c: any, next: () => Promise<void>) => {
    const path = c.req.path;
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0] ||
      c.req.header("x-real-ip") ||
      "unknown";
    const key = `ratelimit:${ip}:${path}`;

    const limit = RATE_LIMITS[path] || RATE_LIMITS.default;
    const now = Date.now();

    const record = await store.get(key);

    if (!record || now > record.resetAt) {
      await store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
      await next();
      return;
    }

    if (record.count >= limit) {
      return c.json(
        { error: "Too many requests. Please try again later." },
        429,
      );
    }

    record.count++;
    await store.set(key, record);
    await next();
  };
}
