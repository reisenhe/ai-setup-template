import type { FitnessCoachState, UserIntent } from './types';

/**
 * 流式事件回调接口
 */
export interface StreamCallbacks {
  /** 节点开始执行时回调 */
  onNodeStart?: (nodeName: string, nodeIndex: number, totalNodes: number) => void;
  /** 节点执行完成时回调 */
  onNodeEnd?: (nodeName: string, nodeIndex: number, totalNodes: number, updates: Partial<FitnessCoachState>) => void;
  /** 发生错误时回调 */
  onError?: (error: Error) => void;
}

/**
 * 节点名称到中文名称的映射
 */
export const NODE_NAME_MAP: Record<string, string> = {
  checkUserInfo: '分析用户意图',
  generateTrainingPlan: '生成/调整训练计划',
  generateDietPlan: '生成/调整饮食计划',
  combineResults: '合并结果',
};

/**
 * 节点执行顺序（用于索引）- 完整流程
 */
export const NODE_ORDER = ['checkUserInfo', 'generateTrainingPlan', 'generateDietPlan', 'combineResults'] as const;

/**
 * 根据意图动态计算节点顺序
 */
export const getNodeOrderByIntent = (intent: UserIntent): string[] => {
  switch (intent) {
    case 'collect_info':
      return ['checkUserInfo'];
    case 'adjust_training':
      return ['checkUserInfo', 'generateTrainingPlan'];
    case 'adjust_diet':
      return ['checkUserInfo', 'generateDietPlan'];
    case 'adjust_both':
    case 'generate_both':
    default:
      return ['checkUserInfo', 'generateTrainingPlan', 'generateDietPlan', 'combineResults'];
  }
};

/**
 * 当前流式回调的临时存储
 * 注意：这是一个简化方案，在高并发场景下需要更复杂的实现
 */
let currentStreamCallbacks: StreamCallbacks | null = null;

/**
 * 设置当前流式回调
 */
export function setStreamCallbacks(callbacks: StreamCallbacks | null): void {
  currentStreamCallbacks = callbacks;
}

/**
 * 获取当前流式回调
 */
export function getStreamCallbacks(): StreamCallbacks | null {
  return currentStreamCallbacks;
}

/**
 * 触发节点开始事件并记录日志
 * 在 graph 节点执行前调用，用于通知前端并记录日志
 *
 * @param nodeName 节点名称
 * @param state 当前状态（用于获取 intent）
 * @param logMessage 可选的自定义日志消息
 */
export function emitNodeStart(
  nodeName: string,
  state: Pick<FitnessCoachState, 'intent'>,
  logMessage?: string,
): void {
  const intent = state.intent || 'generate_both';
  const nodeOrder = getNodeOrderByIntent(intent);
  const nodeIndex = nodeOrder.indexOf(nodeName);
  const totalNodes = nodeOrder.length;

  // 触发回调通知前端
  currentStreamCallbacks?.onNodeStart?.(nodeName, nodeIndex, totalNodes);

  // 记录日志
  const label = NODE_NAME_MAP[nodeName] || nodeName;
  console.log(`[${label}] ${logMessage || 'Starting...'}`);
}
