import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { json } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { OpenAIChatService } from './chat/openai-chat.service';
import { ChatWithToolService } from './chat/chat-with-tool.service';
import { MemoryChatService } from './chat/memory-chat.service';
import { TeacherController } from './langgraph-teacher/teacher.controller';
import { TeacherService } from './langgraph-teacher/teacher.service';
import { McpController } from './mcp/mcp.controller';

@Module({
  imports: [],
  controllers: [
    AppController,
    ChatController,
    TeacherController,
    McpController,
  ],
  providers: [
    AppService,
    ChatService,
    OpenAIChatService,
    ChatWithToolService,
    MemoryChatService,
    TeacherService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 对所有路由启用 JSON body 解析，
    // 但排除 MCP POST 端点——SSE 传输层需要读取原始请求流
    consumer
      .apply(json())
      .exclude({ path: 'mcp', method: RequestMethod.POST })
      .forRoutes('*');
  }
}
