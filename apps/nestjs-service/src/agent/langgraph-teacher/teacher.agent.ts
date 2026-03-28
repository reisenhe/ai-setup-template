import { StateGraph, END, MemorySaver, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { calcTools } from '../../tools/calc.tools';

// ============================================================
// MCP Tools 懒加载 + 缓存
// ============================================================

let mcpToolsCache: StructuredToolInterface[] | null = null;
let mcpAdapterClient: MultiServerMCPClient | null = null;

/**
 * 获取 MCP 提供的 LangChain Tools（单例懒加载）
 * MCP 服务器视为外部独立服务，通过 SSE 协议连接
 */
async function getMcpTools(): Promise<StructuredToolInterface[]> {
  if (mcpToolsCache) {
    return mcpToolsCache;
  }

  const mcpServerUrl =
    process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';

  mcpAdapterClient = new MultiServerMCPClient({
    // 将 MCP 服务器视为远程独立服务，通过 SSE 传输连接
    'school-profiles': {
      transport: 'sse',
      url: mcpServerUrl,
    },
  });

  mcpToolsCache = await mcpAdapterClient.getTools();
  console.log(
    '[MCP Adapter] Loaded tools:',
    mcpToolsCache.map((t) => t.name),
  );

  return mcpToolsCache;
}

/**
 * 统一的工具调用执行函数，屏蔽不同工具间的类型差异
 */
async function invokeTool(
  tools: StructuredToolInterface[],
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return `Tool "${name}" not found`;
  const invoke = tool.invoke.bind(tool) as (
    input: Record<string, unknown>,
  ) => Promise<unknown>;
  const result = await invoke(args);
  return typeof result === 'string' ? result : JSON.stringify(result);
}

// ============================================================
// 状态定义
// ============================================================

const TeacherState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  subject: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),
  confirmQuestion: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),
});

type TeacherStateType = typeof TeacherState.State;

// ============================================================
// LLM 实例
// ============================================================

function createLLM(streaming = true) {
  return new ChatOpenAI({
    model: 'qwen-plus',
    apiKey: process.env.DASHSCOPE_API_KEY,
    streaming,
    configuration: {
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    },
  });
}

// ============================================================
// 节点：决策者 - 判断题目类型并生成确认问句
// ============================================================

async function deciderNode(
  state: TeacherStateType,
): Promise<Partial<TeacherStateType>> {
  const llm = createLLM(false);

  const lastMessage = state.messages[state.messages.length - 1];
  const userQuestion = lastMessage?.content ?? '';

  const classifyPrompt = `你是一个学科分类助手。请判断以下问题属于哪个学科：
- 如果是数学相关（加减乘除、几何、代数等），或者询问对象是 “陈严谨、老陈、数学老师”→ 回复: math
- 如果是英语相关（词汇、语法、翻译、写作等），或者询问对象是 “王潇洒、潇洒哥 / Mr.W、英语老师”、→ 回复: english
- 其他学科或无法判断 → 回复: other

只回复一个单词: math / english / other

用户问题: "${userQuestion}"`;

  const response = await llm.invoke([new HumanMessage(classifyPrompt)]);
  const subjectRaw = (response.content as string).trim().toLowerCase();
  const subject = ['math', 'english'].includes(subjectRaw)
    ? subjectRaw
    : 'other';

  // 生成确认问句
  const subjectLabel =
    subject === 'math'
      ? '数学老师'
      : subject === 'english'
        ? '英语老师'
        : '其他学科的老师';
  const confirmQuestion = `你要找【${subjectLabel}】吗？`;

  return {
    subject,
    confirmQuestion,
  };
}

// ============================================================
// 节点：数学老师 - 带计算工具 + MCP 背景查询工具
// ============================================================

async function mathNode(
  state: TeacherStateType,
): Promise<Partial<TeacherStateType>> {
  const llm = createLLM(true);

  // 从 MCP 服务器获取工具列表（懒加载，首次调用后缓存）
  const mcpTools = await getMcpTools();
  const allTools = [...calcTools, ...mcpTools];
  const llmWithTools = llm.bindTools(allTools);

  // 精简的基础系统提示：只说明角色身份和工具用途
  // 角色的详细背景由 LLM 按需调用 get_character_info 工具获取
  const systemPrompt = `你是这所学校的数学老师，你的角色ID是 "math"。

你拥有以下工具，请按需调用：
- get_character_info(character="math", field=...): 查询你的角色背景（可选字段: basicInfo / background / personality / relationships / dailyLife / secrets）
- get_character_relationship(character1="math", character2=...): 查询你与其他角色的关系
- calculate(expression=...): 进行精确数学计算

【使用指引】
- 首次回答时，建议先调用 get_character_info 获取 personality 字段，了解你的性格和教学风格
- 解题过程中需要计算时，使用 calculate 确保结果精确
- 被问到与其他人关系时，调用 get_character_relationship 查询
- 始终以符合角色性格的方式回答`;

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    ...state.messages,
  ];

  // 工具调用循环（支持 calcTools + MCP Tools 混合调用）
  let response = await llmWithTools.invoke(messages);
  messages.push(response);

  while (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      const content = await invokeTool(
        allTools,
        toolCall.name,
        toolCall.args as Record<string, unknown>,
      );
      messages.push(new ToolMessage({ content, tool_call_id: toolCall.id! }));
    }
    response = await llmWithTools.invoke(messages);
    messages.push(response);
  }

  return {
    messages: [new AIMessage(response.content as string)],
  };
}

// ============================================================
// 节点：英语老师 - 带 MCP 背景查询工具
// ============================================================

async function englishNode(
  state: TeacherStateType,
): Promise<Partial<TeacherStateType>> {
  const llm = createLLM(true);

  const mcpTools = await getMcpTools();
  const llmWithTools = llm.bindTools(mcpTools);

  const systemPrompt = `You are an English teacher at this school. Your character ID is "english".

You have the following tools available:
- get_character_info(character="english", field=...): Retrieve your character background (fields: basicInfo / background / personality / relationships / dailyLife / secrets)
- get_character_relationship(character1="english", character2=...): Look up your relationship with other characters

【Usage Guidelines】
- On first response, call get_character_info with field="personality" to know your vibe and teaching style
- The "secrets" field contains your slang dictionary — use it to maintain authentic West Coast Black slang
- When asked about relationships, call get_character_relationship
- Always stay in character

- 用中文回复大部分的对话内容
`;

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    ...state.messages,
  ];

  // 工具调用循环
  let response = await llmWithTools.invoke(messages);
  messages.push(response);

  while (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      const content = await invokeTool(
        mcpTools,
        toolCall.name,
        toolCall.args as Record<string, unknown>,
      );
      messages.push(new ToolMessage({ content, tool_call_id: toolCall.id! }));
    }
    response = await llmWithTools.invoke(messages);
    messages.push(response);
  }

  return {
    messages: [new AIMessage(response.content as string)],
  };
}

// ============================================================
// 节点：热情的学校保安 - 带 MCP 背景查询工具
// ============================================================

async function securityNode(
  state: TeacherStateType,
): Promise<Partial<TeacherStateType>> {
  const llm = createLLM(true);

  const mcpTools = await getMcpTools();
  const llmWithTools = llm.bindTools(mcpTools);

  const systemPrompt = `你是这所学校门口的保安，你的角色ID是 "security"。

你拥有以下工具，请按需调用：
- get_character_info(character="security", field=...): 查询你的角色背景（可选字段: basicInfo / background / personality / relationships / dailyLife / secrets）
- get_character_relationship(character1="security", character2=...): 查询你与其他角色的关系

【使用指引】
- 首次回答时，建议先调用 get_character_info 获取 personality 字段，了解你的性格、东北方言词汇等
- 被问到与其他人关系时，调用 get_character_relationship 查询
- 始终以符合角色性格（热情东北大哥）的方式回答`;

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    ...state.messages,
  ];

  // 工具调用循环
  let response = await llmWithTools.invoke(messages);
  messages.push(response);

  while (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      const content = await invokeTool(
        mcpTools,
        toolCall.name,
        toolCall.args as Record<string, unknown>,
      );
      messages.push(new ToolMessage({ content, tool_call_id: toolCall.id! }));
    }
    response = await llmWithTools.invoke(messages);
    messages.push(response);
  }

  return {
    messages: [new AIMessage(response.content as string)],
  };
}

// ============================================================
// 条件路由：根据 subject 决定走哪个节点
// ============================================================

function routeBySubject(state: TeacherStateType): string {
  if (state.subject === 'math') return 'math';
  if (state.subject === 'english') return 'english';
  return 'security'; // 非学科问题走保安节点（不在 interruptBefore 列表，直接执行）
}

// ============================================================
// 构建图
// ============================================================

const memory = new MemorySaver();

const workflow = new StateGraph(TeacherState)
  .addNode('decider', deciderNode)
  .addNode('math', mathNode)
  .addNode('english', englishNode)
  .addNode('security', securityNode)
  .addEdge('__start__', 'decider')
  .addConditionalEdges('decider', routeBySubject, {
    math: 'math',
    english: 'english',
    security: 'security',
  })
  .addEdge('math', END)
  .addEdge('english', END)
  .addEdge('security', END);

const compiledApp = workflow.compile({
  checkpointer: memory,
  interruptBefore: ['math', 'english'], // 仅数学和英语需要用户确认，保安直接回答
});

// ============================================================
// TeacherAgent - 对外暴露的 API 类
// ============================================================

export class TeacherAgent {
  /**
   * 开始新的对话流 - 运行 decider，然后暂停等待确认
   * @param message 用户消息
   * @param threadId 会话 ID
   */
  async startStream(message: string, threadId: string) {
    const config = { configurable: { thread_id: threadId } };

    return compiledApp.stream(
      { messages: [new HumanMessage(message)] },
      { ...config, streamMode: 'messages' },
    );
  }

  /**
   * 恢复被中断的图执行（用户确认后）
   * @param threadId 会话 ID
   */
  async resumeStream(threadId: string) {
    const config = { configurable: { thread_id: threadId } };

    return compiledApp.stream(
      null, // null 表示从中断点恢复，不追加新消息
      { ...config, streamMode: 'messages' },
    );
  }

  /**
   * 取消当前中断，将学科重置为 'other' 并路由到保安节点回答
   * @param threadId 会话 ID
   */
  async cancelToSecurity(threadId: string) {
    const config = { configurable: { thread_id: threadId } };

    // 以 decider 节点身份更新状态，将 subject 改为 'other'
    // 这会使条件路由重新评估并将 next 指向 security 节点
    await compiledApp.updateState(config, { subject: 'other' }, 'decider');

    return compiledApp.stream(null, { ...config, streamMode: 'messages' });
  }

  /**
   * 获取当前中断状态（subject 和 confirmQuestion）
   * @param threadId 会话 ID
   * @returns 如果图处于中断状态则返回状态值，否则返回 null
   */
  async getInterruptState(
    threadId: string,
  ): Promise<{ subject: string; confirmQuestion: string } | null> {
    const config = { configurable: { thread_id: threadId } };
    const state = await compiledApp.getState(config);

    // state.next 包含下一个待执行的节点列表，非空则说明图被中断了
    if (state.next && state.next.length > 0) {
      return {
        subject: state.values.subject as string,
        confirmQuestion: state.values.confirmQuestion as string,
      };
    }

    return null;
  }
}

// 导出单例
export const teacherAgent = new TeacherAgent();
