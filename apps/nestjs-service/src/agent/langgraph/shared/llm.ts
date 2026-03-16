import { ChatOpenAI } from '@langchain/openai';

/**
 * 创建共享的 ChatOpenAI 实例，配置 DashScope API
 */
export const createLLM = () =>
  new ChatOpenAI({
    model: 'qwen-plus',
    apiKey: process.env.DASHSCOPE_API_KEY,
    streaming: true,
    configuration: {
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    },
  });
