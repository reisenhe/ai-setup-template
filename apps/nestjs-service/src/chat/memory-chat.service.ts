import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';
import { MemoryChatAgent } from '../agent/langchain/memory-chat.agent';
import { ChatThreadService } from '../chat-thread/chat-thread.service';

/**
 * 记忆聊天服务 - 支持短期上下文记忆的流式聊天
 * 同一个 threadId 内的对话会保持上下文记忆
 */
@Injectable()
export class MemoryChatService {
  constructor(
    private readonly memoryChatAgent: MemoryChatAgent,
    private readonly chatThreadService: ChatThreadService,
  ) {}

  /**
   * 流式聊天 - 支持会话记忆
   * @param userId 当前登录用户
   * @param message 用户消息
   * @param subject SSE 响应主题
   * @param threadId 会话线程 ID（用于区分不同会话）
   */
  async streamChat(
    userId: number,
    message: string,
    subject: Subject<MessageEvent>,
    threadId: string,
  ): Promise<void> {
    try {
      // 校验 threadId 归属，并顺带在首条用户消息时更新 title / updatedAt
      await this.chatThreadService.touchThread(
        userId,
        threadId,
        'memory',
        message,
      );

      subject.next({
        data: JSON.stringify({ type: 'start', message: '开始生成响应...' }),
      });

      const stream = await this.memoryChatAgent.createStream(message, threadId);

      for await (const chunk of stream) {
        if (Array.isArray(chunk) && chunk.length >= 1) {
          const messageChunk = chunk[0];
          if (
            messageChunk &&
            typeof messageChunk.content === 'string' &&
            messageChunk.content
          ) {
            subject.next({
              data: JSON.stringify({
                type: 'chunk',
                content: messageChunk.content,
              }),
            });
          }
        }
      }

      subject.next({
        data: JSON.stringify({ type: 'end', message: '响应完成' }),
      });
      subject.complete();
    } catch (error) {
      subject.next({
        data: JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : '未知错误',
        }),
      });
      subject.complete();
    }
  }
}
