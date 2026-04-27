import { Injectable } from '@nestjs/common';
import { createAgent, ReactAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { LanggraphCheckpointerService } from '../../checkpointer/langgraph-checkpointer.service';

/**
 * MemoryChatAgent - 使用 LangGraph PostgresSaver 实现持久化短期记忆
 * 通过 thread_id 管理不同会话的上下文，下次访问可继续历史对话
 */
@Injectable()
export class MemoryChatAgent {
  private agent!: ReactAgent;

  private defaultSystemPrompt = `你是一个有帮助的 AI 助手，具备记忆能力。
    你会自称 Cortana
`;

  constructor(
    private readonly checkpointerService: LanggraphCheckpointerService,
  ) {}

  /**
   * 懒加载 agent —— 依赖 checkpointerService.onModuleInit 完成后再创建
   */
  private getAgent(): ReactAgent {
    if (!this.agent) {
      const llm = new ChatOpenAI({
        model: 'qwen-plus',
        apiKey: process.env.DASHSCOPE_API_KEY,
        streaming: true,
        configuration: {
          baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        },
      });

      this.agent = createAgent({
        model: llm,
        tools: [],
        systemPrompt: this.defaultSystemPrompt,
        checkpointer: this.checkpointerService.getSaver(),
      });
    }
    return this.agent;
  }

  /**
   * 创建流式响应 - 使用 thread_id 管理会话记忆
   * @param message 用户消息
   * @param threadId 会话线程 ID（LangGraph 自动管理不同 thread 的记忆）
   * @returns 消息流，格式为 [AIMessageChunk, metadata] tuple
   */
  async createStream(message: string, threadId: string = 'default') {
    const config = {
      configurable: {
        thread_id: threadId,
      },
    };

    return this.getAgent().stream(
      { messages: [new HumanMessage(message)] },
      { ...config, streamMode: 'messages' },
    );
  }
}
