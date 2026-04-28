import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { CacheHit } from '../redis/redis.constants';

export interface RequestContextStore {
  /** 缓存命中状态，多次打点取"最坏优先"：ERROR > MISS > BYPASS > HIT */
  cacheHit?: CacheHit;
  /** 当前登录用户 id（由 JwtStrategy 写入） */
  userId?: number;
  /** 请求开始时间戳 */
  startedAt: number;
}

const PRIORITY: Record<CacheHit, number> = {
  ERROR: 4,
  MISS: 3,
  BYPASS: 2,
  HIT: 1,
};

/**
 * 基于 AsyncLocalStorage 的请求上下文
 * - 中间件为每个请求建立一个 store
 * - 业务层（RedisService / JwtStrategy 等）可在任意位置写入 cacheHit / userId
 * - 中间件在请求结束时读取并一起打印
 */
@Injectable()
export class RequestContextService {
  private readonly als = new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.als.run(store, callback);
  }

  getStore(): RequestContextStore | undefined {
    return this.als.getStore();
  }

  markCacheHit(hit: CacheHit) {
    const store = this.als.getStore();
    if (!store) return;
    const current = store.cacheHit;
    if (!current || PRIORITY[hit] > PRIORITY[current]) {
      store.cacheHit = hit;
    }
  }

  setUserId(userId: number) {
    const store = this.als.getStore();
    if (store) store.userId = userId;
  }
}
