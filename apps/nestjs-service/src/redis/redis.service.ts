import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RequestContextService } from '../common/request-context.service';

/**
 * RedisService
 * - 封装 ioredis 实例，提供常用方法
 * - 支持 REDIS_ENABLED=false 完全旁路
 * - 所有读写自动在请求上下文中打点 HIT / MISS / BYPASS / ERROR
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly enabled: boolean;

  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis | null,
    private readonly requestContext: RequestContextService,
  ) {
    this.enabled = !!client;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async onModuleInit() {
    if (!this.enabled || !this.client) {
      this.logger.warn(
        'Redis 未启用 (REDIS_ENABLED=false)，所有缓存操作将被旁路',
      );
      return;
    }
    try {
      const pong = await this.client.ping();
      const host = process.env.REDIS_HOST ?? '127.0.0.1';
      const port = process.env.REDIS_PORT ?? '6379';
      this.logger.log(`connected to ${host}:${port} (${pong})`);
    } catch (err) {
      this.logger.error(
        `Redis ping 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
    }
  }

  /** 直接访问原始客户端（仅在必要时使用） */
  getClient(): Redis | null {
    return this.client;
  }

  /** PING */
  async ping(): Promise<string> {
    if (!this.client) return 'DISABLED';
    return this.client.ping();
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) {
      this.requestContext.markCacheHit('BYPASS');
      return null;
    }
    try {
      const val = await this.client.get(key);
      this.requestContext.markCacheHit(val ? 'HIT' : 'MISS');
      return val;
    } catch (err) {
      this.requestContext.markCacheHit('ERROR');
      this.logger.warn(
        `GET ${key} 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.setex(key, ttlSeconds, value);
    } catch (err) {
      this.requestContext.markCacheHit('ERROR');
      this.logger.warn(
        `SETEX ${key} 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.warn(
        `DEL ${key} 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.client) {
      this.requestContext.markCacheHit('BYPASS');
      return [];
    }
    try {
      const list = await this.client.lrange(key, start, stop);
      this.requestContext.markCacheHit(list.length > 0 ? 'HIT' : 'MISS');
      return list;
    } catch (err) {
      this.requestContext.markCacheHit('ERROR');
      this.logger.warn(
        `LRANGE ${key} 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  async lpush(key: string, ...values: string[]): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.lpush(key, ...values);
    } catch (err) {
      this.logger.warn(
        `LPUSH ${key} 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.ltrim(key, start, stop);
    } catch (err) {
      this.logger.warn(
        `LTRIM ${key} 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.expire(key, ttlSeconds);
    } catch (err) {
      this.logger.warn(
        `EXPIRE ${key} 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
