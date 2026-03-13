import { Controller, Post, Body, Sse, Query, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { chatAgent } from '../agent/chat.agent';

/**
 * SSE 聊天控制器
 * 提供流式聊天接口
 */
@Controller('chat')
export class ChatController {
  /**
   * SSE 流式聊天接口
   * GET /chat/stream?message=xxx
   */
  @Sse('stream')
  streamChat(@Query('message') message: string): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    // 异步处理流式响应
    this.handleStreamChat(message, subject);

    return subject.asObservable();
  }

  /**
   * POST 方式的 SSE 流式聊天接口
   * POST /chat/stream
   */
  @Post('stream')
  @Sse()
  streamChatPost(@Body() body: { message: string; systemPrompt?: string }): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    this.handleStreamChat(body.message, subject, body.systemPrompt);

    return subject.asObservable();
  }

  /**
   * 处理流式聊天的核心逻辑
   */
  private async handleStreamChat(
    message: string,
    subject: Subject<MessageEvent>,
    systemPrompt?: string,
  ): Promise<void> {
    try {
      // 发送开始事件
      subject.next({
        data: JSON.stringify({ type: 'start', message: '开始生成响应...' }),
      });

      // 创建流式响应
      const stream = await chatAgent.createStream(message, systemPrompt);

      // 处理流式输出
      for await (const chunk of stream) {
        // 最后一个 chunk 不包含 choices，但包含 usage 信息
        if (chunk.choices && chunk.choices.length > 0) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            subject.next({
              data: JSON.stringify({ type: 'chunk', content }),
            });
          }
        }
      }

      // 发送完成事件
      subject.next({
        data: JSON.stringify({ type: 'end', message: '响应完成' }),
      });

      // 关闭流
      subject.complete();
    } catch (error) {
      // 发送错误事件
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
