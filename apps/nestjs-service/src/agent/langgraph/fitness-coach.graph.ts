import { END, START, StateGraph, MemorySaver } from '@langchain/langgraph';
import { fitnessCoachAgent } from './fitness-coach.agent';
import { trainingPlanAgent } from './training-plan.agent';
import { dietPlanAgent } from './diet-plan.agent';
import {
  FitnessCoachStateAnnotation,
  type FitnessCoachState,
} from './shared/types';
import {
  emitNodeStart,
  setStreamCallbacks,
} from './shared/stream-utils';

// 重新导出供外部使用
export { NODE_NAME_MAP, NODE_ORDER, getNodeOrderByIntent } from './shared/stream-utils';
export type { StreamCallbacks } from './shared/stream-utils';

/**
 * MemorySaver 实例 - 用于保存会话状态
 * 通过 thread_id 区分不同会话，实现 HITL（Human-in-the-Loop）模式
 */
const checkpointer = new MemorySaver();

/**
 * 检查用户信息后的路由
 * 根据 intent 决定下一步：
 * - collect_info: 需要更多信息 → END
 * - adjust_training: 只调整训练计划 → generateTrainingPlan
 * - adjust_diet: 只调整饮食计划 → generateDietPlan
 * - generate_both / adjust_both: 生成两个计划 → generateTrainingPlan
 */
const routeAfterCheck = (
  state: FitnessCoachState,
): 'generateTrainingPlan' | 'generateDietPlan' | typeof END => {
  if (state.needsInput) {
    return END;
  }
  
  switch (state.intent) {
    case 'adjust_diet':
      return 'generateDietPlan';
    case 'adjust_training':
    case 'adjust_both':
    case 'generate_both':
    default:
      return 'generateTrainingPlan';
  }
};

/**
 * 训练计划完成后的路由
 * - adjust_training: 只需调整训练 → END
 * - 其他: 继续生成饮食计划 → generateDietPlan
 */
const routeAfterTraining = (
  state: FitnessCoachState,
): 'generateDietPlan' | typeof END => {
  if (state.intent === 'adjust_training') {
    return END;
  }
  return 'generateDietPlan';
};

/**
 * 饮食计划完成后的路由
 * - adjust_diet: 只需调整饮食 → END
 * - 其他: 继续合并结果 → combineResults
 */
const routeAfterDiet = (
  state: FitnessCoachState,
): 'combineResults' | typeof END => {
  if (state.intent === 'adjust_diet') {
    return END;
  }
  return 'combineResults';
};

/**
 * 合并训练和饮食计划结果
 */
const combineResults = (
  state: FitnessCoachState,
): Partial<FitnessCoachState> => {
  // 结果已经在状态中（从并行执行）
  return {};
};

/**
 * 构建健身教练工作流图
 *
 * Coach Agent 作为决策者，根据用户意图动态路由：
 *
 * 意图类型：
 * - collect_info: 用户信息不完整，需要收集
 * - generate_both: 首次生成，需要训练和饮食计划
 * - adjust_training: 只调整训练计划（如"周三休息"、"周末训练"）
 * - adjust_diet: 只调整饮食计划（如"牛奶过敏"、"多吃鱼肉"）
 * - adjust_both: 同时调整训练和饮食计划
 *
 * 工作流程：
 * 1. START → checkUserInfo: 分析用户意图，检查信息是否完整
 * 2. checkUserInfo → 条件路由:
 *    - collect_info (needsInput=true) → END: 返回选项给前端
 *    - adjust_diet → generateDietPlan: 只调整饮食
 *    - 其他 → generateTrainingPlan: 生成/调整训练计划
 * 3. generateTrainingPlan → 条件路由:
 *    - adjust_training → END: 只需调整训练，完成
 *    - 其他 → generateDietPlan: 继续处理饮食计划
 * 4. generateDietPlan → 条件路由:
 *    - adjust_diet → END: 只需调整饮食，完成
 *    - 其他 → combineResults: 合并结果
 * 5. combineResults → END: 返回完整计划
 *
 * 图结构:
 * ```
 *                         ┌─────────────────┐
 *                         │      START      │
 *                         └────────┬────────┘
 *                                  │
 *                                  ▼
 *                         ┌─────────────────┐
 *                         │  checkUserInfo  │
 *                         │  (分析意图)      │
 *                         └────────┬────────┘
 *                                  │
 *         ┌────────────────────────┼────────────────────────┐
 *         │                        │                        │
 *         ▼ needsInput             ▼ adjust_diet            ▼ 其他
 *    ┌─────────┐          ┌─────────────────┐      ┌─────────────────────┐
 *    │   END   │          │ generateDietPlan│      │generateTrainingPlan │
 *    │(返回选项)│          └────────┬────────┘      └──────────┬──────────┘
 *    └─────────┘                   │                         │
 *                                  │ adjust_diet             │ adjust_training
 *                                  ▼                         ▼
 *                             ┌─────────┐              ┌─────────┐
 *                             │   END   │              │   END   │
 *                             └─────────┘              └─────────┘
 *                                  │ 其他                    │ 其他
 *                                  ▼                         ▼
 *                         ┌─────────────────┐      ┌─────────────────┐
 *                         │ combineResults  │◄─────│ generateDietPlan│
 *                         └────────┬────────┘      └─────────────────┘
 *                                  │
 *                                  ▼
 *                         ┌─────────────────┐
 *                         │      END        │
 *                         │  (返回完整计划)  │
 *                         └─────────────────┘
 * ```
 */
const buildGraph = () => {
  const workflow = new StateGraph(FitnessCoachStateAnnotation)
    // ========== 添加节点 ==========

    // 节点1: 分析用户意图和检查信息完整性
    .addNode('checkUserInfo', (state) => {
      emitNodeStart('checkUserInfo', state);
      return fitnessCoachAgent.checkUserInfo(state);
    })

    // 节点2: 生成/调整训练计划
    .addNode('generateTrainingPlan', (state) => {
      emitNodeStart('generateTrainingPlan', state);
      return trainingPlanAgent.generate(state);
    })

    // 节点3: 生成/调整饮食计划
    .addNode('generateDietPlan', (state) => {
      emitNodeStart('generateDietPlan', state);
      return dietPlanAgent.generate(state);
    })

    // 节点4: 合并结果
    .addNode('combineResults', (state) => {
      emitNodeStart('combineResults', state);
      return combineResults(state);
    })

    // ========== 定义边 ==========

    // 入口边：从 START 进入 checkUserInfo
    .addEdge(START, 'checkUserInfo')

    // 条件边1：根据 checkUserInfo 结果决定下一步
    // - needsInput=true → END (HITL: 等待用户补充信息)
    // - adjust_diet → generateDietPlan (只调整饮食计划)
    // - 其他 → generateTrainingPlan (生成/调整训练计划)
    .addConditionalEdges('checkUserInfo', routeAfterCheck, [
      'generateTrainingPlan',
      'generateDietPlan',
      END,
    ])

    // 条件边2：训练计划完成后
    // - adjust_training → END (只需调整训练)
    // - 其他 → generateDietPlan
    .addConditionalEdges('generateTrainingPlan', routeAfterTraining, [
      'generateDietPlan',
      END,
    ])

    // 条件边3：饮食计划完成后
    // - adjust_diet → END (只需调整饮食)
    // - 其他 → combineResults
    .addConditionalEdges('generateDietPlan', routeAfterDiet, [
      'combineResults',
      END,
    ])

    // 最终边：合并结果 → 结束
    .addEdge('combineResults', END);

  // 编译时传入 checkpointer，启用状态持久化
  return workflow.compile({ checkpointer });
};

// 编译后的图实例
export const fitnessCoachGraph = buildGraph();

/**
 * 流式调用健身教练图 - 返回 stream 供调用方迭代
 * @param message 用户消息
 * @param threadId 会话线程 ID
 * @param existingUserInfo 已有的用户信息
 * @returns 返回 stream 和设置/清理回调的函数
 */
export const streamFitnessCoach = (
  message: string,
  threadId: string = 'default',
  existingUserInfo?: Partial<FitnessCoachState['userInfo']>,
) => {
  const config = {
    configurable: {
      thread_id: threadId,
    },
  };

  // 返回 stream 供外部迭代
  const stream = fitnessCoachGraph.stream(
    {
      message,
      userInfo: existingUserInfo ?? {},
    },
    {
      ...config,
      streamMode: 'updates' as const,
    },
  );

  return {
    stream,
    setCallbacks: setStreamCallbacks,
  };
};
