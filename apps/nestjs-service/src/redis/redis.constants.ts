/**
 * Redis 相关的常量与 Key 工厂
 * 集中管理所有 key 模式，避免散落的裸字符串
 */

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * 缓存命中状态
 * - HIT:    命中 Redis
 * - MISS:   未命中，回源 DB/上游
 * - BYPASS: Redis 未启用或本请求不涉及 Redis
 * - ERROR:  Redis 异常，已降级处理
 */
export type CacheHit = 'HIT' | 'MISS' | 'BYPASS' | 'ERROR';

export const RedisKeys = {
  /** 用户信息缓存 */
  user: (userId: number | string) => `user:${userId}`,
  /** LangGraph checkpoint 单条：{threadId}:{ns}:{checkpointId} */
  ckpt: (threadId: string, ns: string, checkpointId: string) =>
    `ckpt:${threadId}:${ns}:${checkpointId}`,
  /** LangGraph checkpoint 最新指针：存 checkpointId 字符串 */
  ckptLatest: (threadId: string, ns: string) => `ckpt:${threadId}:${ns}:latest`,
  /** 按 threadId 的 SCAN 通配符（不含全局 keyPrefix） */
  ckptThreadPattern: (threadId: string) => `ckpt:${threadId}:*`,
};

/** LangGraph checkpoint 缓存 TTL：1 小时 */
export const CKPT_TTL_SECONDS = 60 * 60;
