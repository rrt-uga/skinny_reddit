import { RedisClient } from '@devvit/redis';

declare global {
  namespace Express {
    interface Request {
      context: {
        redis: RedisClient;
        userId: string;
      };
    }
  }
}

export {};