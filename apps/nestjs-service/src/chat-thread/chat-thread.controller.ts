import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AgentType, ChatThreadService } from './chat-thread.service';

interface AuthUser {
  id: number;
  email: string;
  username: string;
}

const AGENT_TYPES: AgentType[] = ['memory', 'teacher'];

function normalizeAgentType(value?: string): AgentType {
  if (!value || !AGENT_TYPES.includes(value as AgentType)) {
    throw new BadRequestException('agentType 必须是 memory / teacher');
  }
  return value as AgentType;
}

@Controller('chat-threads')
export class ChatThreadController {
  constructor(private readonly service: ChatThreadService) {}

  /** 列出当前用户在某个 agent 下的会话 */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('agentType') agentType?: string) {
    const typed = agentType ? normalizeAgentType(agentType) : undefined;
    return this.service.list(user.id, typed);
  }

  /** 创建新会话 */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { agentType: string; title?: string },
  ) {
    const typed = normalizeAgentType(body?.agentType);
    return this.service.create(user.id, typed, body?.title);
  }

  /** 重命名 */
  @Patch(':id')
  rename(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { title: string },
  ) {
    if (!body?.title || !body.title.trim()) {
      throw new BadRequestException('title 不能为空');
    }
    return this.service.rename(user.id, id, body.title);
  }

  /** 删除 */
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }

  /** 获取会话历史消息（用于前端回显） */
  @Get(':id/messages')
  getMessages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getMessages(user.id, id);
  }
}
