// src/lib/rateLimit.ts
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit'; // Import Ratelimit from Upstash

// Initialize Redis client using environment variables
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Create a new ratelimiter instance
// 5 requests from the same IP per 5 seconds
export const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, '5s'), // 5 requests per 5 seconds
  analytics: true, // Optional: Enable analytics
  timeout: 2000, // Optional: Timeout for Redis calls
});