import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';
import {
  streamFitnessCoach,
  getNodeOrderByIntent,
  NODE_NAME_MAP,
  NODE_ORDER,
  type FitnessCoachState,
  type UserInfo,
  type UserIntent,
} from '../agent/langgraph';

/**
 * 健身教练精简服务 - SSE 输出，只包含节点进度和最终结果，无 setCallbacks
 */
@Injectable()
export class FitnessCoachLiteService {
  async executeWorkflow(
    message: string,
    subject: Subject<MessageEvent>,
    threadId: string = 'default',
    existingUserInfo?: Partial<UserInfo>,
  ): Promise<void> {
    const emit = (data: Record<string, unknown>) =>
      subject.next({ data: JSON.stringify(data) });

    try {
      emit({
        type: 'init',
        nodes: NODE_ORDER.map((id, index) => ({ id, name: NODE_NAME_MAP[id], index })),
        totalSteps: NODE_ORDER.length,
        threadId,
      });

      const { stream } = streamFitnessCoach(message, threadId, existingUserInfo);

      let currentIntent: UserIntent = 'generate_both';
      let finalState: Partial<FitnessCoachState> = {};

      for await (const event of await stream) {
        for (const [nodeName, updates] of Object.entries(event)) {
          const stateUpdates = updates as Partial<FitnessCoachState>;

          if (stateUpdates.intent) {
            currentIntent = stateUpdates.intent;
          }

          const nodeOrder = getNodeOrderByIntent(currentIntent);
          const nodeIndex = nodeOrder.indexOf(nodeName);

          emit({ type: 'node_end', nodeIndex, totalSteps: nodeOrder.length, nodeName, nodeLabel: NODE_NAME_MAP[nodeName] });

          finalState = { ...finalState, ...stateUpdates };
        }
      }

      if (finalState.needsInput) {
        emit({ type: 'needs_input', missingFields: finalState.missingFields, options: finalState.options, userInfo: finalState.userInfo });
      } else {
        emit({ type: 'result', success: true, userInfo: finalState.userInfo, trainingPlan: finalState.trainingPlan, dietPlan: finalState.dietPlan });
      }

      emit({ type: 'end', message: '工作流执行完毕' });
      subject.complete();
    } catch (error) {
      emit({ type: 'error', message: error instanceof Error ? error.message : '未知错误' });
      emit({ type: 'end', message: '工作流执行失败' });
      subject.complete();
    }
  }
}

