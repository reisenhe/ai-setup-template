import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import pg from 'pg';
import { RedisService } from '../redis/redis.service';
import { RequestContextService } from '../common/request-context.service';
import { RedisPostgresHybridCheckpointer } from './redis-postgres-hybrid-checkpointer';

/**
 * LangGraph Checkpointer 全局单例
 * - 底层使用 RedisPostgresHybridCheckpointer：Postgres 为 source of truth，Redis 旁路缓存
 * - REDIS_ENABLED=false 时退化为纯 PostgresSaver 行为
 * - 为所有 Agent（memory-chat / teacher）提供统一的 checkpointer 实例
 */
@Injectable()
export class LanggraphCheckpointerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(LanggraphCheckpointerService.name);
  private pool!: pg.Pool;
  private saver!: RedisPostgresHybridCheckpointer;

  constructor(
    private readonly redis: RedisService,
    private readonly ctx: RequestContextService,
  ) {}

  async onModuleInit(): Promise<void> {
    const connString = process.env.DATABASE_URL;
    if (!connString) {
      throw new Error('DATABASE_URL 未配置，无法初始化 LangGraph Checkpointer');
    }

    this.pool = new pg.Pool({ connectionString: connString });
    this.saver = new RedisPostgresHybridCheckpointer(
      this.pool,
      this.redis,
      this.ctx,
    );
    await this.saver.setup();
    this.logger.log(
      `LangGraph hybrid checkpointer ready (redis enabled=${this.redis.isEnabled()})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.saver) {
      try {
        await this.saver.end();
      } catch {
        /* ignore */
      }
    }
    if (this.pool) {
      await this.pool.end().catch(() => undefined);
    }
  }

  /** 获取底层 saver 实例，用于 workflow.compile({ checkpointer }) 等 */
  getSaver(): PostgresSaver {
    return this.saver;
  }

  /** 删除指定 thread 的所有 checkpoint 数据（PG + Redis 缓存） */
  async deleteThread(threadId: string): Promise<void> {
    await this.saver.deleteThread(threadId);
  }
}
