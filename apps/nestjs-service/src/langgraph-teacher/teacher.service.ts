import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';
import { AIMessageChunk } from '@langchain/core/messages';
import { TeacherAgent } from '../agent/langgraph-teacher/teacher.agent';
import { ChatThreadService } from '../chat-thread/chat-thread.service';

/**
 * 判断 chunk 是否为增量消息片段（而非节点结束时写入 state 的完整消息）
 * LangGraph streamMode:"messages" 会对每个节点产生两类输出：
 *   1. AIMessageChunk  — LLM 流式逐 token 输出（我们需要的）
 *   2. AIMessage       — 节点结束时写入 state 的完整消息（会重复全文，需过滤）
 */
function isIncrementalChunk(msg: unknown): msg is AIMessageChunk {
  return msg instanceof AIMessageChunk;
}

/**
 * 将 LangGraph messages 流逐 chunk 推送到 SSE Subject
 * @param stream    LangGraph streamMode:"messages" 返回的异步可迭代对象
 * @param subject   NestJS SSE Subject
 * @param skipNodes 需要跳过的节点名称列表（如 decider 的分类输出）
 */
async function pipeChunksToSse(
  stream: AsyncIterable<unknown>,
  subject: Subject<MessageEvent>,
  skipNodes: string[] = [],
): Promise<void> {
  for await (const chunk of stream) {
    if (!Array.isArray(chunk) || chunk.length < 2) continue;

    const metadata = chunk[1] as { langgraph_node?: string };
    if (skipNodes.includes(metadata?.langgraph_node ?? '')) continue;

    const msg = chunk[0];
    if (
      isIncrementalChunk(msg) &&
      typeof msg.content === 'string' &&
      msg.content &&
      !msg.tool_calls?.length
    ) {
      subject.next({
        data: JSON.stringify({ type: 'chunk', content: msg.content }),
      });
    }
  }
}

/**
 * 智能老师服务
 * 处理 LangGraph Teacher Agent 的 SSE 流式输出和 HITL 交互
 */
@Injectable()
export class TeacherService {
  constructor(
    private readonly teacherAgent: TeacherAgent,
    private readonly chatThreadService: ChatThreadService,
  ) {}

  /**
   * 初始消息流 - 运行 decider 节点后暂停，等待用户确认
   */
  async streamChat(
    userId: number,
    message: string,
    subject: Subject<MessageEvent>,
    threadId: string,
  ): Promise<void> {
    try {
      await this.chatThreadService.touchThread(
        userId,
        threadId,
        'teacher',
        message,
      );

      subject.next({
        data: JSON.stringify({ type: 'start', message: '正在分析题目类型...' }),
      });

      const stream = await this.teacherAgent.startStream(message, threadId);

      await pipeChunksToSse(stream, subject, ['decider']);

      const interruptState =
        await this.teacherAgent.getInterruptState(threadId);

      if (interruptState) {
        subject.next({
          data: JSON.stringify({
            type: 'confirm',
            question: interruptState.confirmQuestion,
            subject: interruptState.subject,
          }),
        });
      } else {
        subject.next({
          data: JSON.stringify({ type: 'end', message: '执行完毕' }),
        });
      }

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

  /**
   * 恢复流 - 用户在前端确认后调用，继续执行被中断的老师节点
   */
  async resumeChat(
    userId: number,
    threadId: string,
    confirmed: boolean,
    subject: Subject<MessageEvent>,
  ): Promise<void> {
    try {
      // 校验归属即可，不改 title（首轮已设置）
      await this.chatThreadService.touchThread(userId, threadId, 'teacher', '');

      if (!confirmed) {
        subject.next({
          data: JSON.stringify({ type: 'start', message: '保安大哥来了...' }),
        });

        const stream = await this.teacherAgent.cancelToSecurity(threadId);
        await pipeChunksToSse(stream, subject, ['decider']);

        subject.next({
          data: JSON.stringify({ type: 'end' }),
        });
        subject.complete();
        return;
      }

      subject.next({
        data: JSON.stringify({ type: 'start', message: '老师开始解答...' }),
      });

      const stream = await this.teacherAgent.resumeStream(threadId);
      await pipeChunksToSse(stream, subject);

      subject.next({
        data: JSON.stringify({ type: 'end', message: '解答完毕' }),
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
