import { Injectable } from '@nestjs/common';
import { StateGraph, END, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { calcTools } from '../../tools/calc.tools';
import { LanggraphCheckpointerService } from '../../checkpointer/langgraph-checkpointer.service';

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
- 如果是数学相关（加减乘除、几何、代数等）→ 回复: math
- 如果是英语相关（词汇、语法、翻译、写作等）→ 回复: english
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
      ? '数学题'
      : subject === 'english'
        ? '英语题'
        : '其他学科的题';
  const confirmQuestion = `这是【${subjectLabel}】吗？`;

  return {
    subject,
    confirmQuestion,
  };
}

// ============================================================
// 节点：数学老师 - 带计算工具
// ============================================================

async function mathNode(
  state: TeacherStateType,
): Promise<Partial<TeacherStateType>> {
  const llm = createLLM(true);
  const llmWithTools = llm.bindTools(calcTools);

  const systemPrompt = `你是一位严谨的数学老师。
- 解题时条理清晰，逐步讲解
- 需要计算时，必须使用 calculate 工具确保精确结果
- 指导学生理解解题思路，不仅给出答案
- 风格：专业、耐心、鼓励`;

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    ...state.messages,
  ];

  // 工具调用循环
  let response = await llmWithTools.invoke(messages);
  messages.push(response);

  while (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      const matchedTool = calcTools.find((t) => t.name === toolCall.name);
      if (matchedTool) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (matchedTool as any).invoke(toolCall.args);
        messages.push(
          new ToolMessage({
            content:
              typeof result === 'string' ? result : JSON.stringify(result),
            tool_call_id: toolCall.id!,
          }),
        );
      }
    }
    response = await llmWithTools.invoke(messages);
    messages.push(response);
  }

  return {
    messages: [new AIMessage(response.content as string)],
  };
}

// ============================================================
// 节点：英语老师 - 附带西海岸黑人口癖
// ============================================================

async function englishNode(
  state: TeacherStateType,
): Promise<Partial<TeacherStateType>> {
  const llm = createLLM(true);

  const systemPrompt = `You are an English teacher with a West Coast Black American vibe. 
- You're knowledgeable and helpful, but you sprinkle in authentic West Coast Black slang naturally
- Use phrases like: "no cap", "bussin", "lowkey", "finna", "on god", "bruh", "it's giving", "fr fr", "deadass", "slay", "bet", "periodt", "that's fire", "no 🧢"
- Keep it real but educational — you still explain grammar, vocabulary, and usage clearly
- Example tone: "Bruh, this sentence structure is lowkey fire, no cap. Let me break it down for you fr fr..."
- Always answer in Chinese mixed with the slang for clarity`;

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    ...state.messages,
  ];

  const response = await llm.invoke(messages);

  return {
    messages: [new AIMessage(response.content as string)],
  };
}

// ============================================================
// 节点：热情的学校保安 - 东北大哥语气，直接回答非学科问题
// ============================================================

async function securityNode(
  state: TeacherStateType,
): Promise<Partial<TeacherStateType>> {
  const llm = createLLM(true);

  const systemPrompt = `你是学校门口热情的东北保安大哥，人称"老李"。
性格特点：
- 说话带浓浓东北口音和方言，常用"哎妈呀"、"老铁"、"整"、"咋整"、"贼"、"嗯哪"、"行嗷"、"咋滴"、"可不咋地"、"那旮沓"等词
- 极其热情，把每个学生当自家孩子看
- 虽然不是老师，但啥都知道点，乐于帮忙
- 如果问题超出你的知识范围，就热情地说让他们去找老师
- 回答要简短接地气，带点幽默感
示例风格："哎妈呀老铁，这问题整的！你说的这个嘛，老李跟你唠唠……行嗷，记住了没？有啥不懂的再来找老李！"`;

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    ...state.messages,
  ];

  const response = await llm.invoke(messages);

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
// TeacherAgent - 对外暴露的 API 类（基于 DI 的 Postgres checkpointer）
// ============================================================

@Injectable()
export class TeacherAgent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private compiledApp!: any;

  constructor(
    private readonly checkpointerService: LanggraphCheckpointerService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getApp(): any {
    if (!this.compiledApp) {
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

      this.compiledApp = workflow.compile({
        checkpointer: this.checkpointerService.getSaver(),
        interruptBefore: ['math', 'english'], // 仅数学和英语需要用户确认，保安直接回答
      });
    }
    return this.compiledApp;
  }

  /**
   * 开始新的对话流 - 运行 decider，然后暂停等待确认
   */
  async startStream(message: string, threadId: string) {
    const config = { configurable: { thread_id: threadId } };

    return this.getApp().stream(
      { messages: [new HumanMessage(message)] },
      { ...config, streamMode: 'messages' },
    );
  }

  /**
   * 恢复被中断的图执行（用户确认后）
   */
  async resumeStream(threadId: string) {
    const config = { configurable: { thread_id: threadId } };

    return this.getApp().stream(null, { ...config, streamMode: 'messages' });
  }

  /**
   * 取消当前中断，将学科重置为 'other' 并路由到保安节点回答
   */
  async cancelToSecurity(threadId: string) {
    const config = { configurable: { thread_id: threadId } };

    await this.getApp().updateState(config, { subject: 'other' }, 'decider');

    return this.getApp().stream(null, { ...config, streamMode: 'messages' });
  }

  /**
   * 获取当前中断状态（subject 和 confirmQuestion）
   */
  async getInterruptState(
    threadId: string,
  ): Promise<{ subject: string; confirmQuestion: string } | null> {
    const config = { configurable: { thread_id: threadId } };
    const state = await this.getApp().getState(config);

    if (state.next && state.next.length > 0) {
      return {
        subject: state.values.subject as string,
        confirmQuestion: state.values.confirmQuestion as string,
      };
    }

    return null;
  }

  /**
   * 获取线程的完整状态（包含所有历史消息），用于前端回显
   */
  async getState(threadId: string) {
    const config = { configurable: { thread_id: threadId } };
    return this.getApp().getState(config);
  }
}
