import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

/**
 * LangGraph Postgres Checkpointer 全局单例
 * - 启动时根据 DATABASE_URL 创建 PostgresSaver 并调用 setup()（幂等建表/迁移）
 * - 为所有 Agent（memory-chat / teacher 等）提供统一的 checkpointer 实例
 */
@Injectable()
export class LanggraphCheckpointerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(LanggraphCheckpointerService.name);
  private saver!: PostgresSaver;

  async onModuleInit(): Promise<void> {
    const connString = process.env.DATABASE_URL;
    if (!connString) {
      throw new Error(
        'DATABASE_URL 未配置，无法初始化 LangGraph PostgresSaver',
      );
    }

    this.saver = PostgresSaver.fromConnString(connString);
    await this.saver.setup();
    this.logger.log('LangGraph PostgresSaver 已完成初始化');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.saver) {
      await this.saver.end();
    }
  }

  /** 获取底层 PostgresSaver 实例，用于 workflow.compile({ checkpointer }) 等 */
  getSaver(): PostgresSaver {
    return this.saver;
  }

  /** 删除指定 thread 的所有 checkpoint 数据 */
  async deleteThread(threadId: string): Promise<void> {
    await this.saver.deleteThread(threadId);
  }
}
