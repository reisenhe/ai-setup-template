import { z } from 'zod';
import { createLLM } from './shared/llm';
import type { DietPlan, FitnessCoachState, UserInfo } from './shared/types';

/**
 * 宏量营养素的 Zod schema
 */
const MacrosSchema = z.object({
  protein: z.number().describe('蛋白质（克）'),
  carbs: z.number().describe('碳水化合物（克）'),
  fat: z.number().describe('脂肪（克）'),
});

/**
 * 单餐的 Zod schema
 */
const MealSchema = z.object({
  foods: z.array(z.string()).describe('这餐的食物列表'),
  calories: z.number().describe('总卡路里'),
  macros: MacrosSchema.describe('宏量营养素分解'),
});

/**
 * 每日饮食计划的 Zod schema
 */
const DietPlanSchema = z.object({
  breakfast: MealSchema.describe('早餐'),
  lunch: MealSchema.describe('午餐'),
  dinner: MealSchema.describe('晚餐'),
});

/**
 * DietPlanAgent - 根据用户信息生成或调整每日饮食计划
 */
export class DietPlanAgent {
  private llm;

  constructor() {
    this.llm = createLLM().withStructuredOutput(DietPlanSchema);
  }

  /**
   * 根据用户信息生成或调整饮食计划
   * 这是 LangGraph 的节点函数
   */
  async generate(
    state: FitnessCoachState,
  ): Promise<Partial<FitnessCoachState>> {
    const { userInfo, message, dietPlan: existingPlan } = state;

    // 如果有现有计划且用户有调整需求，执行调整
    if (existingPlan && message) {
      const dietPlan = await this.adjustPlan(userInfo, existingPlan, message);
      return { dietPlan };
    }

    // 否则生成新计划
    const dietPlan = await this.generatePlan(userInfo);
    return { dietPlan };
  }

  /**
   * 根据用户请求调整现有饮食计划
   */
  private async adjustPlan(
    userInfo: UserInfo,
    existingPlan: DietPlan,
    userRequest: string,
  ): Promise<DietPlan> {
    const systemPrompt = `你是一位专业的营养师。用户已有一份每日饮食计划，现在需要根据用户的要求进行调整。

用户资料：
- 性别：${userInfo.gender === 'male' ? '男' : '女'}
- 年龄段：${userInfo.ageRange}
- 目标：${userInfo.trainingGoal === 'muscle_gain' ? '增肌' : '减脂'}

当前饮食计划：
${JSON.stringify(existingPlan, null, 2)}

用户的调整要求：
${userRequest}

请根据用户的要求调整饮食计划。注意：
1. 只修改需要调整的部分，尽量保持其他部分不变
2. 如果用户提到过敏或不能吃的食物，替换为合适的替代品
3. 如果用户要求增加/减少某类食物，进行相应调整
4. 保持营养均衡，确保宏量营养素合理分配
5. 重新计算调整后的卡路里和宏量营养素

输出完整的调整后的每日饮食计划。`;

    const result = await this.llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请根据我的要求调整饮食计划。' },
    ]);

    return result as DietPlan;
  }

  /**
   * 使用 LLM 生成每日饮食计划
   */
  private async generatePlan(userInfo: UserInfo): Promise<DietPlan> {
    const goalNutrition =
      userInfo.trainingGoal === 'muscle_gain'
        ? '热量盈余，高蛋白（每公斤体重1.6-2.2克），适量碳水提供能量，健康脂肪'
        : '热量缺口，同时保持高蛋白以维持肌肉，适量碳水，较低脂肪摄入';

    const systemPrompt = `你是一位专业的营养师，正在制定个性化的每日饮食计划。

用户资料：
- 性别：${userInfo.gender === 'male' ? '男' : '女'}
- 年龄段：${userInfo.ageRange}
- 目标：${userInfo.trainingGoal === 'muscle_gain' ? '增肌' : '减脂'}

营养理念：
- 目标重点：${goalNutrition}
- 考虑适合年龄的热量需求
- 包含多种营养密集的食物
- 各餐均衡分配宏量营养素
- 实用且易于准备的餐食

生成详细的每日饮食计划，包含：
- 三餐：早餐、午餐、晚餐
- 每餐3-5种食物
- 每餐的预估卡路里
- 宏量营养素分解（蛋白质、碳水化合物、脂肪，单位为克）
- 食物名称请用中文`;

    const result = await this.llm.invoke([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: '请生成我的每日饮食计划。',
      },
    ]);

    return result as DietPlan;
  }
}

// 导出单例实例
export const dietPlanAgent = new DietPlanAgent();
