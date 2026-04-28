import { Logger } from '@nestjs/common';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type {
  Checkpoint,
  CheckpointMetadata,
  CheckpointTuple,
  ChannelVersions,
  PendingWrite,
} from '@langchain/langgraph-checkpoint';
import type { RunnableConfig } from '@langchain/core/runnables';
import type pg from 'pg';
import { RedisService } from '../redis/redis.service';
import { RequestContextService } from '../common/request-context.service';
import { CKPT_TTL_SECONDS, RedisKeys } from '../redis/redis.constants';

/**
 * RedisPostgresHybridCheckpointer
 *
 * PostgreSQL 仍然是 source of truth，Redis 作为旁路缓存：
 *  - getTuple: 先读 Redis（latest 指针 → tuple），未命中回源 PG 并回填 Redis
 *  - put:      先写 PG，再写 Redis（SETEX tuple + SETEX latest 指针，TTL=1h）
 *  - putWrites:写 PG 后失效对应 tuple 与 latest 指针
 *  - deleteThread: 走父类删 PG，再 SCAN 删该 thread 所有缓存键
 *
 * REDIS_ENABLED=false 或 ioredis 未初始化时，所有分支等价于纯 PostgresSaver，
 * 并在请求上下文中打点 cacheHit=BYPASS。
 */
interface SerializedEntry {
  type: string;
  /** base64 后的 Uint8Array */
  data: string;
}

interface CachedTuple {
  v: 1;
  config: RunnableConfig;
  parentConfig?: RunnableConfig | null;
  checkpoint: SerializedEntry;
  metadata: SerializedEntry;
  pendingWrites?: Array<[string, string, SerializedEntry]>;
}

export class RedisPostgresHybridCheckpointer extends PostgresSaver {
  private readonly hybridLogger = new Logger('HybridCheckpointer');
  private readonly keyPrefix: string;

  constructor(
    pool: pg.Pool,
    private readonly redis: RedisService,
    private readonly ctx: RequestContextService,
  ) {
    super(pool);
    this.keyPrefix = process.env.REDIS_KEY_PREFIX ?? 'ai-setup:';
  }

  // ==================== getTuple ====================
  override async getTuple(
    config: RunnableConfig,
  ): Promise<CheckpointTuple | undefined> {
    const client = this.redis.getClient();
    const configurable = (config.configurable ?? {}) as Record<string, unknown>;
    const threadId = configurable.thread_id as string | undefined;
    const ns = ((configurable.checkpoint_ns as string | undefined) ??
      '') as string;
    let checkpointId = configurable.checkpoint_id as string | undefined;

    if (!client || !threadId) {
      this.ctx.markCacheHit('BYPASS');
      return super.getTuple(config);
    }

    // 1) 尝试从 Redis 命中
    try {
      if (!checkpointId) {
        const latest = await client.get(RedisKeys.ckptLatest(threadId, ns));
        if (latest) checkpointId = latest;
      }
      if (checkpointId) {
        const raw = await client.get(
          RedisKeys.ckpt(threadId, ns, checkpointId),
        );
        if (raw) {
          const cached = JSON.parse(raw) as CachedTuple;
          const tuple = await this.decodeTuple(cached);
          this.ctx.markCacheHit('HIT');
          return tuple;
        }
      }
    } catch (err) {
      this.ctx.markCacheHit('ERROR');
      this.hybridLogger.warn(
        `getTuple Redis 读取失败: ${err instanceof Error ? err.message : String(err)}`,
      );
      // 读错则退回 PG
    }

    // 2) 未命中 → 回源 PG
    this.ctx.markCacheHit('MISS');
    const tuple = await super.getTuple(config);

    // 3) 回填 Redis
    if (tuple) {
      try {
        await this.writeTupleToRedis(tuple);
      } catch (err) {
        this.ctx.markCacheHit('ERROR');
        this.hybridLogger.warn(
          `getTuple 回填 Redis 失败: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return tuple;
  }

  // ==================== put ====================
  override async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    newVersions: ChannelVersions,
  ): Promise<RunnableConfig> {
    const result = await super.put(config, checkpoint, metadata, newVersions);
    const client = this.redis.getClient();
    if (!client) return result;

    try {
      const configurable = (result.configurable ?? {}) as Record<
        string,
        unknown
      >;
      const threadId = configurable.thread_id as string | undefined;
      const ns = ((configurable.checkpoint_ns as string | undefined) ??
        '') as string;
      const checkpointId = configurable.checkpoint_id as string | undefined;
      if (!threadId || !checkpointId) return result;

      const cached = await this.encodeTuple({
        config: result,
        checkpoint,
        metadata,
        parentConfig: config,
      });
      const payload = JSON.stringify(cached);
      await client
        .multi()
        .setex(
          RedisKeys.ckpt(threadId, ns, checkpointId),
          CKPT_TTL_SECONDS,
          payload,
        )
        .setex(
          RedisKeys.ckptLatest(threadId, ns),
          CKPT_TTL_SECONDS,
          checkpointId,
        )
        .exec();
    } catch (err) {
      this.ctx.markCacheHit('ERROR');
      this.hybridLogger.warn(
        `put 回填 Redis 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return result;
  }

  // ==================== putWrites ====================
  override async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    await super.putWrites(config, writes, taskId);
    const client = this.redis.getClient();
    if (!client) return;

    const configurable = (config.configurable ?? {}) as Record<string, unknown>;
    const threadId = configurable.thread_id as string | undefined;
    const ns = ((configurable.checkpoint_ns as string | undefined) ??
      '') as string;
    const checkpointId = configurable.checkpoint_id as string | undefined;
    if (!threadId) return;

    try {
      const keys = [RedisKeys.ckptLatest(threadId, ns)];
      if (checkpointId) keys.push(RedisKeys.ckpt(threadId, ns, checkpointId));
      await client.del(...keys);
    } catch (err) {
      this.ctx.markCacheHit('ERROR');
      this.hybridLogger.warn(
        `putWrites 失效 Redis 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ==================== deleteThread ====================
  override async deleteThread(threadId: string): Promise<void> {
    await super.deleteThread(threadId);
    const client = this.redis.getClient();
    if (!client) return;

    try {
      // ioredis 会在命令内部自动补 keyPrefix，但 SCAN 的 match 返回的是完整 key（含前缀），
      // 因此 SCAN 要传完整前缀，DEL 时再把前缀剥掉交还给 ioredis。
      const scanPattern =
        this.keyPrefix + RedisKeys.ckptThreadPattern(threadId);
      const stream = client.scanStream({ match: scanPattern, count: 100 });
      for await (const batch of stream as unknown as AsyncIterable<string[]>) {
        if (!batch || batch.length === 0) continue;
        const stripped = batch.map((k) =>
          k.startsWith(this.keyPrefix) ? k.slice(this.keyPrefix.length) : k,
        );
        await client.del(...stripped);
      }
    } catch (err) {
      this.hybridLogger.warn(
        `deleteThread 清理 Redis 失败 (${threadId}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ==================== 私有编解码 ====================
  private async writeTupleToRedis(tuple: CheckpointTuple): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;
    const configurable = (tuple.config.configurable ?? {}) as Record<
      string,
      unknown
    >;
    const threadId = configurable.thread_id as string | undefined;
    const ns = ((configurable.checkpoint_ns as string | undefined) ??
      '') as string;
    const checkpointId =
      (configurable.checkpoint_id as string | undefined) ?? tuple.checkpoint.id;
    if (!threadId || !checkpointId) return;

    const cached = await this.encodeTuple(tuple);
    const payload = JSON.stringify(cached);
    await client
      .multi()
      .setex(
        RedisKeys.ckpt(threadId, ns, checkpointId),
        CKPT_TTL_SECONDS,
        payload,
      )
      .setex(RedisKeys.ckptLatest(threadId, ns), CKPT_TTL_SECONDS, checkpointId)
      .exec();
  }

  private async encode(value: unknown): Promise<SerializedEntry> {
    const [type, data] = await this.serde.dumpsTyped(value);
    return { type, data: Buffer.from(data).toString('base64') };
  }

  private async decode<T>(entry: SerializedEntry): Promise<T> {
    const bin = new Uint8Array(Buffer.from(entry.data, 'base64'));
    return (await this.serde.loadsTyped(entry.type, bin)) as T;
  }

  private async encodeTuple(tuple: CheckpointTuple): Promise<CachedTuple> {
    const pendingWrites = tuple.pendingWrites
      ? await Promise.all(
          tuple.pendingWrites.map(async ([tid, channel, value]) => {
            const enc = await this.encode(value);
            return [tid, channel, enc] as [string, string, SerializedEntry];
          }),
        )
      : undefined;
    return {
      v: 1,
      config: tuple.config,
      parentConfig: tuple.parentConfig ?? null,
      checkpoint: await this.encode(tuple.checkpoint),
      metadata: await this.encode(tuple.metadata ?? {}),
      pendingWrites,
    };
  }

  private async decodeTuple(cached: CachedTuple): Promise<CheckpointTuple> {
    if (cached.v !== 1) {
      throw new Error(`unsupported cache version: ${String(cached.v)}`);
    }
    const checkpoint = await this.decode<Checkpoint>(cached.checkpoint);
    const metadata = await this.decode<CheckpointMetadata>(cached.metadata);
    const pendingWrites = cached.pendingWrites
      ? await Promise.all(
          cached.pendingWrites.map(async ([tid, channel, entry]) => {
            const value = await this.decode(entry);
            return [tid, channel, value] as [string, string, unknown];
          }),
        )
      : undefined;
    return {
      config: cached.config,
      parentConfig: cached.parentConfig ?? undefined,
      checkpoint,
      metadata,
      pendingWrites,
    };
  }
}
