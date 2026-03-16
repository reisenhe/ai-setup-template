import { z } from 'zod';
import { createLLM } from './shared/llm';
import type { FitnessCoachState, TrainingPlan, UserInfo } from './shared/types';

/**
 * 训练动作的 Zod schema
 */
const ExerciseSchema = z.object({
  name: z.string().describe('动作名称'),
  sets: z.number().describe('组数'),
  reps: z.string().describe('每组次数或时长'),
  restSeconds: z.number().describe('组间休息时间（秒）'),
});

/**
 * 训练日的 Zod schema
 */
const TrainingDaySchema = z.object({
  focus: z.string().describe('当日训练重点（如：胸部和肱三头肌）'),
  exercises: z.array(ExerciseSchema).describe('训练动作列表'),
});

/**
 * 周训练计划的 Zod schema
 */
const TrainingPlanSchema = z.object({
  monday: TrainingDaySchema.describe('周一训练'),
  tuesday: TrainingDaySchema.describe('周二训练'),
  wednesday: TrainingDaySchema.describe('周三训练'),
  thursday: TrainingDaySchema.describe('周四训练'),
  friday: TrainingDaySchema.describe('周五训练'),
});

/**
 * TrainingPlanAgent - 根据用户信息生成或调整周训练计划
 */
export class TrainingPlanAgent {
  private llm;

  constructor() {
    this.llm = createLLM().withStructuredOutput(TrainingPlanSchema);
  }

  /**
   * 根据用户信息生成或调整训练计划
   * 这是 LangGraph 的节点函数
   */
  async generate(
    state: FitnessCoachState,
  ): Promise<Partial<FitnessCoachState>> {
    const { userInfo, message, trainingPlan: existingPlan } = state;

    // 如果有现有计划且用户有调整需求，执行调整
    if (existingPlan && message) {
      const trainingPlan = await this.adjustPlan(userInfo, existingPlan, message);
      return { trainingPlan };
    }

    // 否则生成新计划
    const trainingPlan = await this.generatePlan(userInfo);
    return { trainingPlan };
  }

  /**
   * 根据用户请求调整现有训练计划
   */
  private async adjustPlan(
    userInfo: UserInfo,
    existingPlan: TrainingPlan,
    userRequest: string,
  ): Promise<TrainingPlan> {
    const systemPrompt = `你是一位专业的健身教练。用户已有一份周训练计划，现在需要根据用户的要求进行调整。

用户资料：
- 性别：${userInfo.gender === 'male' ? '男' : '女'}
- 年龄段：${userInfo.ageRange}
- 目标：${userInfo.trainingGoal === 'muscle_gain' ? '增肌' : '减脂'}

当前训练计划：
${JSON.stringify(existingPlan, null, 2)}

用户的调整要求：
${userRequest}

请根据用户的要求调整训练计划。注意：
1. 只修改需要调整的部分，尽量保持其他部分不变
2. 如果用户要求某天休息，将该天的 focus 设为"休息日"，exercises 设为空数组
3. 如果用户要求增加训练日（如周末），合理安排训练内容
4. 保持训练计划的整体平衡性

输出完整的调整后的周训练计划。`;

    const result = await this.llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请根据我的要求调整训练计划。' },
    ]);

    return result as TrainingPlan;
  }

  /**
   * 使用 LLM 生成周训练计划
   */
  private async generatePlan(userInfo: UserInfo): Promise<TrainingPlan> {
    const goalDescription =
      userInfo.trainingGoal === 'muscle_gain'
        ? '通过渐进超负荷增加肌肉量，专注于肌肥大次数范围（8-12次）'
        : '以减脂为目标，结合力量训练和高次数训练，在燃烧卡路里的同时保持肌肉';

    const systemPrompt = `你是一位专业的健身教练，正在制定个性化的周训练计划。

用户资料：
- 性别：${userInfo.gender === 'male' ? '男' : '女'}
- 年龄段：${userInfo.ageRange}
- 目标：${userInfo.trainingGoal === 'muscle_gain' ? '增肌' : '减脂'}

训练理念：
- 目标重点：${goalDescription}
- 考虑适合年龄的动作选择和恢复时间
- 包含适当的热身动作
- 全周合理分配各肌群训练
- 周末（周六/周日）为休息日

生成详细的5天（周一至周五）训练计划，包含：
- 每天专注于特定肌群
- 每天4-6个动作
- 根据目标设定适当的组数、次数和休息时间
- 动作名称请用中文`;

    const result = await this.llm.invoke([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: '请生成我的周训练计划。',
      },
    ]);

    return result as TrainingPlan;
  }
}

// 导出单例实例
export const trainingPlanAgent = new TrainingPlanAgent();
