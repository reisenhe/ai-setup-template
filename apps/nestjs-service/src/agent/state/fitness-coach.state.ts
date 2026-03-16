import { Annotation } from '@langchain/langgraph';
import type {
  UserInfo,
  UserIntent,
  UserInputOptions,
  TrainingPlan,
  DietPlan,
} from '../langgraph/shared/types';

/**
 * 健身教练工作流的 LangGraph 状态注解
 *
 * 定义了工作流中各节点共享的状态结构，包括：
 * - message: 用户输入的原始消息
 * - userInfo: 解析后的用户信息（性别、年龄段、训练目标）
 * - intent: 用户意图（首次生成/调整训练/调整饮食）
 * - needsInput: 是否需要用户补充信息
 * - trainingPlan/dietPlan: 生成的计划
 */
export const FitnessCoachStateAnnotation = Annotation.Root({
  // 用户输入消息
  message: Annotation<string>,

  // 解析后的用户信息
  userInfo: Annotation<UserInfo>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  // 用户意图（由 coach agent 决策）
  intent: Annotation<UserIntent>({
    reducer: (_, next) => next,
    default: () => 'collect_info',
  }),

  // 是否需要用户输入
  needsInput: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),

  // 需要用户输入的缺失字段
  missingFields: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // 缺失字段的可选项
  options: Annotation<UserInputOptions | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // 生成的训练计划
  trainingPlan: Annotation<TrainingPlan | null>({
    reducer: (prev, next) => next ?? prev, // 保留之前的计划，除非有新的
    default: () => null,
  }),

  // 生成的饮食计划
  dietPlan: Annotation<DietPlan | null>({
    reducer: (prev, next) => next ?? prev, // 保留之前的计划，除非有新的
    default: () => null,
  }),
});

/**
 * 健身教练状态类型（从 Annotation 推导）
 */
export type FitnessCoachState = typeof FitnessCoachStateAnnotation.State;
