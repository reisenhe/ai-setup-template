import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { OpenAIChatService } from './chat/openai-chat.service';
import { ChatWithToolService } from './chat/chat-with-tool.service';
import { MemoryChatService } from './chat/memory-chat.service';
import { TeacherController } from './langgraph-teacher/teacher.controller';
import { TeacherService } from './langgraph-teacher/teacher.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [PrismaModule, AuthModule, UserModule],
  controllers: [AppController, ChatController, TeacherController],
  providers: [
    AppService,
    ChatService,
    OpenAIChatService,
    ChatWithToolService,
    MemoryChatService,
    TeacherService,
  ],
})
export class AppModule {}
