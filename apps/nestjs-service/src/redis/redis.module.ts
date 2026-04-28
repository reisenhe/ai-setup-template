import { Global, Logger, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';
import { CommonModule } from '../common/common.module';

/**
 * 全局 Redis 模块
 * - 根据 REDIS_ENABLED 决定是否创建 ioredis 实例
 * - REDIS_ENABLED=false 时 REDIS_CLIENT 注入 null，RedisService 走旁路
 */
@Global()
@Module({
  imports: [CommonModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis | null => {
        const logger = new Logger('RedisClient');
        const enabled =
          (process.env.REDIS_ENABLED ?? 'true').toLowerCase() !== 'false';
        if (!enabled) {
          logger.warn('REDIS_ENABLED=false, skip creating ioredis client');
          return null;
        }

        const host = process.env.REDIS_HOST ?? '127.0.0.1';
        const port = Number(process.env.REDIS_PORT ?? 6379);
        const password = process.env.REDIS_PASSWORD || undefined;
        const db = Number(process.env.REDIS_DB ?? 0);
        const keyPrefix = process.env.REDIS_KEY_PREFIX ?? 'ai-setup:';

        const client = new Redis({
          host,
          port,
          password,
          db,
          keyPrefix,
          lazyConnect: false,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
        });

        client.on('error', (err) => {
          logger.error(`Redis error: ${err.message}`);
        });
        return client;
      },
    },
    RedisService,
  ],
  exports: [RedisService, REDIS_CLIENT],
})
export class RedisModule {}
