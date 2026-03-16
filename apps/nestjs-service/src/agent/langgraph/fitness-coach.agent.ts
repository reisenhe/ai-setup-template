import { z } from 'zod';
import { createLLM } from './shared/llm';
import type { FitnessCoachState, UserInfo, UserInputOptions, UserIntent } from './shared/types';

/**
 * 用于从 LLM 响应中解析用户信息的 Zod schema
 */
const UserInfoSchema = z.object({
  gender: z.enum(['male', 'female']).nullable().describe('用户性别'),
  ageRange: z
    .enum(['18-25', '26-35', '36-45', '46-55', '55+'])
    .nullable()
    .describe('用户年龄段'),
  trainingGoal: z
    .enum(['muscle_gain', 'fat_loss'])
    .nullable()
    .describe('训练目标：增肌或减脂'),
});

/**
 * 用于分析用户意图的 Zod schema
 */
const IntentSchema = z.object({
  intent: z
    .enum(['adjust_training', 'adjust_diet', 'adjust_both', 'other'])
    .describe('用户意图类型'),
  reason: z.string().describe('判断理由'),
});

/**
 * 用户可选择的选项
 */
const AVAILABLE_OPTIONS: UserInputOptions = {
  gender: ['male', 'female'],
  ageRange: ['18-25', '26-35', '36-45', '46-55', '55+'],
  trainingGoal: ['muscle_gain', 'fat_loss'],
};

/**
 * FitnessCoachAgent - 协调器 Agent，作为决策者
 * 1. 检查用户信息完整性
 * 2. 分析用户意图（首次生成 / 调整训练 / 调整饮食）
 * 3. 决定下一步执行哪个节点
 */
export class FitnessCoachAgent {
  private llm;
  private intentLlm;

  constructor() {
    this.llm = createLLM().withStructuredOutput(UserInfoSchema);
    this.intentLlm = createLLM().withStructuredOutput(IntentSchema);
  }

  /**
   * 检查用户信息完整性并分析意图
   * 这是 LangGraph 的主要决策节点
   */
  async checkUserInfo(
    state: FitnessCoachState,
  ): Promise<Partial<FitnessCoachState>> {
    const { message, userInfo: existingInfo, trainingPlan, dietPlan } = state;

    // 如果消息不为空，尝试从消息中提取用户信息
    let extractedInfo: UserInfo = {};
    if (message && message.trim()) {
      extractedInfo = await this.extractUserInfo(message);
    }

    // 与现有信息合并（只合并非 undefined 的字段）
    const mergedInfo: UserInfo = {
      gender: extractedInfo.gender ?? existingInfo?.gender,
      ageRange: extractedInfo.ageRange ?? existingInfo?.ageRange,
      trainingGoal: extractedInfo.trainingGoal ?? existingInfo?.trainingGoal,
    };

    // 检查缺失字段
    const missingFields: string[] = [];
    if (!mergedInfo.gender) missingFields.push('gender');
    if (!mergedInfo.ageRange) missingFields.push('ageRange');
    if (!mergedInfo.trainingGoal) missingFields.push('trainingGoal');

    // 如果有缺失字段，需要收集信息
    if (missingFields.length > 0) {
      return {
        userInfo: mergedInfo,
        intent: 'collect_info',
        needsInput: true,
        missingFields,
        options: AVAILABLE_OPTIONS,
      };
    }

    // 用户信息完整，分析意图
    const intent = await this.analyzeIntent(message, trainingPlan, dietPlan);

    return {
      userInfo: mergedInfo,
      intent,
      needsInput: false,
      missingFields: [],
      options: null,
    };
  }

  /**
   * 分析用户意图：是首次生成还是调整已有计划
   */
  private async analyzeIntent(
    message: string,
    trainingPlan: FitnessCoachState['trainingPlan'],
    dietPlan: FitnessCoachState['dietPlan'],
  ): Promise<UserIntent> {
    // 如果没有已有计划，则是首次生成
    if (!trainingPlan && !dietPlan) {
      return 'generate_both';
    }

    // 如果消息为空，也是首次生成
    if (!message || !message.trim()) {
      return 'generate_both';
    }

    // 使用 LLM 分析用户意图
    const systemPrompt = `你是一个健身计划助手。用户已经有了训练计划和饮食计划。
现在用户发来了新消息，请分析用户的意图：

- adjust_training: 用户想调整训练计划
  例如："我想周三休息"、"周末也想训练"、"增加腿部训练"、"减少有氧运动"
  
- adjust_diet: 用户想调整饮食计划
  例如："我对牛奶过敏"、"我想吃更多鱼肉"、"我是素食者"、"减少碳水"
  
- adjust_both: 用户想同时调整两个计划
  例如："我想增加训练强度，同时吃更多蛋白质"
  
- other: 用户的意图不是调整计划（可能是询问或其他）

请根据用户消息判断意图。`;

    try {
      const result = await this.intentLlm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ]);

      console.log('Intent analysis:', result);

      // 映射到 UserIntent 类型
      switch (result.intent) {
        case 'adjust_training':
          return 'adjust_training';
        case 'adjust_diet':
          return 'adjust_diet';
        case 'adjust_both':
          return 'adjust_both';
        default:
          // 如果是 other 或无法识别，默认重新生成两个计划
          return 'generate_both';
      }
    } catch (error) {
      console.error('Intent analysis failed:', error);
      // 失败时默认生成两个计划
      return 'generate_both';
    }
  }

  /**
   * 使用 LLM 从消息中提取用户信息
   */
  private async extractUserInfo(message: string): Promise<UserInfo> {
    const systemPrompt = `你是一个健身教练助手。
从用户的消息中提取用户信息。
需要提取的信息：
- 性别：男(male) 或 女(female)
- 年龄段：18-25、26-35、36-45、46-55 或 55+
- 训练目标：muscle_gain（增肌/增加肌肉/变壮）或 fat_loss（减脂/减肥/瘦身）

如果任何信息未提及或不明确，请返回 null。
只提取明确说明或强烈暗示的信息。`;

    try {
      const result = await this.llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ]);

      return {
        gender: result.gender ?? undefined,
        ageRange: result.ageRange ?? undefined,
        trainingGoal: result.trainingGoal ?? undefined,
      };
    } catch {
      // 解析失败时返回空对象
      return {};
    }
  }
}

// 导出单例实例
export const fitnessCoachAgent = new FitnessCoachAgent();
