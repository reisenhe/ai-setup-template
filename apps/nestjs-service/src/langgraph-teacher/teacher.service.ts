import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';
import { AIMessageChunk } from '@langchain/core/messages';
import { teacherAgent } from '../agent/langgraph-teacher/teacher.agent';

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
  /**
   * 初始消息流 - 运行 decider 节点后暂停，等待用户确认
   * @param message 用户输入的问题
   * @param subject SSE 响应 Subject
   * @param threadId 会话线程 ID
   */
  async streamChat(
    message: string,
    subject: Subject<MessageEvent>,
    threadId: string,
  ): Promise<void> {
    try {
      subject.next({
        data: JSON.stringify({ type: 'start', message: '正在分析题目类型...' }),
      });

      // 启动图执行，decider 节点分析题目类型
      // 若为非学科问题，图会继续执行 security 节点并在此产生流式输出
      const stream = await teacherAgent.startStream(message, threadId);

      // 过滤 decider 节点输出（"math"/"english"/"other" 分类词），仅转发 security 的文本
      await pipeChunksToSse(stream, subject, ['decider']);

      // 循环结束后检查图是否处于中断状态
      // - 中断：说明是数学/英语题，需要用户确认
      // - 未中断：说明是非学科问题，保安已直接回答完毕
      const interruptState = await teacherAgent.getInterruptState(threadId);

      if (interruptState) {
        // 向前端发送确认事件，触发 HITL 对话框
        subject.next({
          data: JSON.stringify({
            type: 'confirm',
            question: interruptState.confirmQuestion,
            subject: interruptState.subject,
          }),
        });
      } else {
        // 未被中断（理论上不会发生，除非图结构有误）
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
   * @param threadId 会话线程 ID
   * @param confirmed 用户是否确认（true = 继续，false = 取消）
   * @param subject SSE 响应 Subject
   */
  async resumeChat(
    threadId: string,
    confirmed: boolean,
    subject: Subject<MessageEvent>,
  ): Promise<void> {
    try {
      // 用户取消 - 将学科重置为 'other'，让保安大哥来回答
      if (!confirmed) {
        subject.next({
          data: JSON.stringify({ type: 'start', message: '保安大哥来了...' }),
        });

        const stream = await teacherAgent.cancelToSecurity(threadId);
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

      // 恢复图执行，运行 math 或 english 节点
      const stream = await teacherAgent.resumeStream(threadId);
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
