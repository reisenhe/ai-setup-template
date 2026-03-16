/**
 * LangGraph 健身教练多 Agent 系统
 *
 * 本模块导出健身教练工作流和相关类型。
 */

// 主图和调用函数
export {
  fitnessCoachGraph,
  streamFitnessCoach,
  NODE_NAME_MAP,
  NODE_ORDER,
  getNodeOrderByIntent,
} from './fitness-coach.graph';

// 流式回调类型
export type { StreamCallbacks } from './fitness-coach.graph';

// 单独的 Agent（用于高级用法）
export { fitnessCoachAgent } from './fitness-coach.agent';
export { trainingPlanAgent } from './training-plan.agent';
export { dietPlanAgent } from './diet-plan.agent';

// 类型
export type {
  UserInfo,
  UserIntent,
  TrainingPlan,
  TrainingDay,
  Exercise,
  DietPlan,
  Meal,
  Macros,
  UserInputOptions,
  FitnessCoachState,
  FitnessCoachOutput,
} from './shared/types';

// 共享工具
export { createLLM } from './shared/llm';
