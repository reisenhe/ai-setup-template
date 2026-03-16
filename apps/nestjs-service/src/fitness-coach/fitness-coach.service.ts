import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';
import {
  streamFitnessCoach,
  NODE_NAME_MAP,
  NODE_ORDER,
  getNodeOrderByIntent,
  type FitnessCoachState,
  type UserInfo,
  type UserIntent,
  type StreamCallbacks,
} from '../agent/langgraph';

/**
 * SSE 事件类型
 */
export type FitnessCoachEventType =
  | 'init'           // 初始化，发送节点列表
  | 'node_start'     // 节点开始执行
  | 'node_end'       // 节点执行完成
  | 'intent_update'  // 意图更新，节点列表可能变化
  | 'log'            // 日志信息
  | 'needs_input'    // 需要用户输入
  | 'result'         // 最终结果
  | 'error'          // 错误
  | 'end';           // 结束

/**
 * 健身教练服务 - 处理 LangGraph 健身教练工作流的业务逻辑
 */
@Injectable()
export class FitnessCoachService {
  /**
   * 发送 SSE 事件的辅助方法
   */
  private sendEvent(
    subject: Subject<MessageEvent>,
    type: FitnessCoachEventType,
    data: Record<string, unknown>,
  ): void {
    subject.next({
      data: JSON.stringify({ type, ...data }),
    });
  }

  /**
   * 执行健身教练工作流（使用真实的 LangGraph 流式输出）
   * @param message 用户消息
   * @param subject SSE 主题
   * @param threadId 会话线程 ID，用于维护会话记忆
   * @param existingUserInfo 已有的用户信息（可选）
   */
  async executeWorkflow(
    message: string,
    subject: Subject<MessageEvent>,
    threadId: string = 'default',
    existingUserInfo?: Partial<UserInfo>,
  ): Promise<void> {
    try {
      // 1. 发送初始化事件，包含节点列表（前端自行管理状态）
      this.sendEvent(subject, 'init', {
        nodes: NODE_ORDER.map((id, index) => ({
          id,
          name: NODE_NAME_MAP[id],
          index,
        })),
        totalSteps: NODE_ORDER.length,
        threadId,
      });

      // 2. 发送日志
      this.sendEvent(subject, 'log', {
        message: `会话 ID: ${threadId}`,
        timestamp: new Date().toISOString(),
      });

      if (message) {
        this.sendEvent(subject, 'log', {
          message: `收到用户消息: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
          timestamp: new Date().toISOString(),
        });
      } else {
        this.sendEvent(subject, 'log', {
          message: '继续上次会话，使用已保存的用户信息',
          timestamp: new Date().toISOString(),
        });
      }

      // 3. 创建流式回调
      let currentTotalNodes: number = NODE_ORDER.length;
      let currentIntent: UserIntent = 'generate_both';
      let finalState: Partial<FitnessCoachState> = {};
      
      const callbacks: StreamCallbacks = {
        onNodeStart: (nodeName, nodeIndex, totalNodes) => {
          // 如果节点总数变化（意图确定后），更新前端
          if (totalNodes !== currentTotalNodes) {
            currentTotalNodes = totalNodes;
            this.sendEvent(subject, 'intent_update', {
              totalSteps: totalNodes,
            });
          }
          
          this.sendEvent(subject, 'node_start', {
            nodeIndex,
            totalSteps: totalNodes,
            nodeName,
            nodeLabel: NODE_NAME_MAP[nodeName],
          });
          this.sendEvent(subject, 'log', {
            message: `开始执行: ${NODE_NAME_MAP[nodeName]}`,
            timestamp: new Date().toISOString(),
          });
        },
        onNodeEnd: (nodeName, nodeIndex, totalNodes) => {
          this.sendEvent(subject, 'node_end', {
            nodeIndex,
            totalSteps: totalNodes,
            nodeName,
            nodeLabel: NODE_NAME_MAP[nodeName],
          });
          this.sendEvent(subject, 'log', {
            message: `${NODE_NAME_MAP[nodeName]} 完成`,
            timestamp: new Date().toISOString(),
          });
        },
      };

      // 4. 获取 stream 并设置回调
      const { stream, setCallbacks } = streamFitnessCoach(
        message,
        threadId,
        existingUserInfo,
      );
      
      setCallbacks(callbacks);

      try {
        // 5. 迭代 stream 处理每个节点的更新
        for await (const event of await stream) {
          for (const [nodeName, updates] of Object.entries(event)) {
            const stateUpdates = updates as Partial<FitnessCoachState>;
            
            // 更新意图（在 checkUserInfo 节点完成后）
            if (stateUpdates.intent) {
              currentIntent = stateUpdates.intent;
            }
            
            // 根据当前意图计算节点顺序
            const nodeOrder = getNodeOrderByIntent(currentIntent);
            const nodeIndex = nodeOrder.indexOf(nodeName);
            
            // 通知节点完成
            callbacks.onNodeEnd?.(nodeName, nodeIndex, nodeOrder.length, stateUpdates);
            
            // 更新最终状态
            finalState = { ...finalState, ...stateUpdates };
          }
        }
      } finally {
        // 清理回调
        setCallbacks(null);
      }

      // 6. 根据结果处理
      if (finalState.needsInput) {
        this.sendEvent(subject, 'log', {
          message: `缺少以下信息: ${finalState.missingFields?.join(', ')}`,
          timestamp: new Date().toISOString(),
        });

        this.sendEvent(subject, 'needs_input', {
          missingFields: finalState.missingFields,
          options: finalState.options,
          userInfo: finalState.userInfo,
        });
      } else {
        this.sendEvent(subject, 'result', {
          success: true,
          userInfo: finalState.userInfo,
          trainingPlan: finalState.trainingPlan,
          dietPlan: finalState.dietPlan,
        });

        this.sendEvent(subject, 'log', {
          message: '健身计划生成完成！',
          timestamp: new Date().toISOString(),
        });
      }

      // 7. 发送结束事件
      this.sendEvent(subject, 'end', { message: '工作流执行完毕' });
      subject.complete();

    } catch (error) {
      this.sendEvent(subject, 'error', {
        message: error instanceof Error ? error.message : '未知错误',
      });
      this.sendEvent(subject, 'end', { message: '工作流执行失败' });
      subject.complete();
    }
  }
}
