import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LanggraphCheckpointerService } from '../checkpointer/langgraph-checkpointer.service';

export type AgentType = 'memory' | 'teacher';

function truncateTitle(raw: string): string {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  return trimmed.length > 30 ? trimmed.slice(0, 30) + '…' : trimmed || '新会话';
}

@Injectable()
export class ChatThreadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkpointerService: LanggraphCheckpointerService,
  ) {}

  async list(userId: number, agentType?: AgentType) {
    return this.prisma.chatThread.findMany({
      where: {
        userId,
        ...(agentType ? { agentType } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(userId: number, agentType: AgentType, title?: string) {
    return this.prisma.chatThread.create({
      data: {
        userId,
        agentType,
        title: title?.trim() || '新会话',
      },
    });
  }

  async rename(userId: number, id: string, title: string) {
    await this.ensureOwner(userId, id);
    return this.prisma.chatThread.update({
      where: { id },
      data: { title: title.trim() || '新会话' },
    });
  }

  async remove(userId: number, id: string) {
    await this.ensureOwner(userId, id);
    // 先删 LangGraph checkpoint 数据，再删业务记录
    await this.checkpointerService.deleteThread(id);
    await this.prisma.chatThread.delete({ where: { id } });
    return { id };
  }

  /**
   * 聊天入口调用：校验 threadId 归属；若 title 仍是默认值则用首条消息更新
   */
  async touchThread(
    userId: number,
    threadId: string,
    agentType: AgentType,
    firstMessage: string,
  ) {
    const thread = await this.ensureOwner(userId, threadId);
    if (thread.agentType !== agentType) {
      throw new ForbiddenException('线程类型不匹配');
    }

    if (thread.title === '新会话') {
      await this.prisma.chatThread.update({
        where: { id: threadId },
        data: { title: truncateTitle(firstMessage) },
      });
    } else {
      // 只更新 updatedAt（Prisma @updatedAt 会自动更新）
      await this.prisma.chatThread.update({
        where: { id: threadId },
        data: { title: thread.title },
      });
    }
    return thread;
  }

  /**
   * 获取 thread 最新 state 的消息列表（供前端回显历史）
   */
  async getMessages(userId: number, threadId: string) {
    await this.ensureOwner(userId, threadId);
    const saver = this.checkpointerService.getSaver();
    const tuple = await saver.getTuple({
      configurable: { thread_id: threadId },
    });
    if (!tuple || !tuple.checkpoint) return [];

    const channelValues = tuple.checkpoint.channel_values as Record<
      string,
      unknown
    >;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (channelValues.messages ?? []) as any[];

    return raw
      .filter((m) => {
        const type = m?.getType?.() ?? m?._getType?.();
        return type === 'human' || type === 'ai';
      })
      .map((m) => {
        const type = m?.getType?.() ?? m?._getType?.();
        return {
          role: type === 'human' ? 'user' : 'assistant',
          content:
            typeof m.content === 'string'
              ? m.content
              : JSON.stringify(m.content),
        };
      })
      .filter((m) => m.content);
  }

  /** 校验 thread 归属当前用户，不存在或越权则抛出 */
  private async ensureOwner(userId: number, id: string) {
    const thread = await this.prisma.chatThread.findUnique({ where: { id } });
    if (!thread) throw new NotFoundException('会话不存在');
    if (thread.userId !== userId)
      throw new ForbiddenException('无权访问该会话');
    return thread;
  }
}
