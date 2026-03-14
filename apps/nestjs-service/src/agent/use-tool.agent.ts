import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, BaseMessage, ToolMessage, AIMessage } from '@langchain/core/messages';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { timeTools } from '../tools/time.tools';

/**
 * UseToolAgent - 支持工具调用的 ChatAgent
 * 使用 bindTools 绑定工具，处理工具调用循环
 */
export class UseToolAgent {
  private llm: ChatOpenAI;
  private llmWithTools: ReturnType<ChatOpenAI['bindTools']>;
  private defaultSystemPrompt = `你是一个有帮助的 AI 助手。
你可以使用以下时间工具来回答与时间、日期相关的问题：
- get_current_time: 获取当前日期和时间
- get_weekday: 查询指定日期是星期几
- get_date_diff: 计算两个日期之间的间隔
- add_to_date: 对日期进行加减计算

当用户询问时间相关问题时，请使用这些工具获取准确信息后再回答。`;

  constructor() {
    this.llm = new ChatOpenAI({
      model: 'qwen-plus',
      apiKey: process.env.DASHSCOPE_API_KEY,
      streaming: true,
      configuration: {
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      },
    });

    // 绑定时间工具
    this.llmWithTools = this.llm.bindTools(timeTools);
  }

  /**
   * 构建消息数组
   */
  private buildMessages(message: string, systemPrompt?: string): BaseMessage[] {
    return [
      new SystemMessage(systemPrompt ?? this.defaultSystemPrompt),
      new HumanMessage(message),
    ];
  }

  /**
   * 执行工具调用并返回工具消息
   */
  private async executeToolCalls(aiMessage: AIMessage): Promise<ToolMessage[]> {
    const toolMessages: ToolMessage[] = [];

    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      for (const toolCall of aiMessage.tool_calls) {
        // 查找对应的工具
        const tool = timeTools.find(t => t.name === toolCall.name);
        if (tool) {
          // 执行工具
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (tool as any).invoke(toolCall.args);
          toolMessages.push(
            new ToolMessage({
              content: typeof result === 'string' ? result : JSON.stringify(result),
              tool_call_id: toolCall.id!,
            })
          );
        }
      }
    }

    return toolMessages;
  }

  /**
   * 创建流式响应 - 支持多轮工具调用循环
   * @param message 用户消息
   * @param systemPrompt 系统提示词
   */
  async createStream(message: string, systemPrompt?: string): Promise<IterableReadableStream<AIMessage>> {
    const messages = this.buildMessages(message, systemPrompt);

    // 工具调用循环，直到 LLM 不再请求工具
    let response = await this.llmWithTools.invoke(messages);
    
    while (response.tool_calls && response.tool_calls.length > 0) {
      // 将 AI 响应添加到消息历史
      messages.push(response);

      // 执行所有工具调用
      const toolMessages = await this.executeToolCalls(response);
      messages.push(...toolMessages);

      // 再次调用 LLM，检查是否还需要更多工具
      response = await this.llmWithTools.invoke(messages);
    }

    // 没有更多工具调用，返回最终流式响应
    return this.llmWithTools.stream(messages);
  }
}

// 导出单例实例
export const useToolAgent = new UseToolAgent();
