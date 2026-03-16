import { Controller, Post, Body, Sse, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { FitnessCoachService } from './fitness-coach.service';
import { FitnessCoachLiteService } from './fitness-coach-lite.service';
import type { UserInfo } from '../agent/langgraph';

/**
 * 健身教练请求体接口
 */
interface FitnessCoachRequestBody {
  /** 用户消息 */
  message: string;
  /** 会话线程 ID，用于维护会话记忆（HITL 模式） */
  threadId?: string;
  /** 已有的用户信息（可选，用于兼容旧调用方式） */
  userInfo?: Partial<UserInfo>;
}

/**
 * 健身教练控制器
 * 提供 LangGraph 健身教练多 Agent 系统的 SSE 接口
 */
@Controller('fitness-coach')
export class FitnessCoachController {
  constructor(
    private readonly fitnessCoachService: FitnessCoachService,
    private readonly fitnessCoachLiteService: FitnessCoachLiteService,
  ) {}

  /**
   * 完整版 SSE 流式接口，包含日志、初始化等详细事件
   * POST /fitness-coach/stream
   */
  @Post('stream')
  @Sse()
  streamWorkflow(@Body() body: FitnessCoachRequestBody): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    const threadId = body.threadId || `fitness-${Date.now()}`;
    this.fitnessCoachService.executeWorkflow(body.message, subject, threadId, body.userInfo);
    return subject.asObservable();
  }

  /**
   * 精简版 SSE 流式接口，只包含节点进度和最终结果，无日志
   * POST /fitness-coach/lite
   */
  @Post('lite')
  @Sse()
  liteWorkflow(@Body() body: FitnessCoachRequestBody): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    const threadId = body.threadId || `fitness-lite-${Date.now()}`;
    this.fitnessCoachLiteService.executeWorkflow(body.message, subject, threadId, body.userInfo);
    return subject.asObservable();
  }
}

