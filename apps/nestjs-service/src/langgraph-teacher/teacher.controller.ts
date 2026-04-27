import { Controller, Post, Body, Sse, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { TeacherService } from './teacher.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface AuthUser {
  id: number;
  email: string;
  username: string;
}

/**
 * 智能老师控制器
 * 提供两个 SSE 接口：初始消息流 + HITL 确认恢复流
 */
@Controller('teacher')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  /**
   * 初始消息接口 - 发送问题，decider 分析并暂停等待确认
   * POST /teacher/stream
   */
  @Post('stream')
  @Sse()
  streamChat(
    @CurrentUser() user: AuthUser,
    @Body() body: { message: string; threadId: string },
  ): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    this.teacherService.streamChat(
      user.id,
      body.message,
      subject,
      body.threadId,
    );
    return subject.asObservable();
  }

  /**
   * HITL 确认恢复接口 - 用户确认后恢复图执行
   * POST /teacher/resume
   */
  @Post('resume')
  @Sse()
  resumeChat(
    @CurrentUser() user: AuthUser,
    @Body() body: { threadId: string; confirmed: boolean },
  ): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    this.teacherService.resumeChat(
      user.id,
      body.threadId,
      body.confirmed,
      subject,
    );
    return subject.asObservable();
  }
}
