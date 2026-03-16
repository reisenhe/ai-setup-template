import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { OpenAIChatService } from './chat/openai-chat.service';
import { ChatWithToolService } from './chat/chat-with-tool.service';
import { MemoryChatService } from './chat/memory-chat.service';
import { FitnessCoachController } from './fitness-coach/fitness-coach.controller';
import { FitnessCoachService } from './fitness-coach/fitness-coach.service';
import { FitnessCoachLiteService } from './fitness-coach/fitness-coach-lite.service';

@Module({
  imports: [],
  controllers: [AppController, ChatController, FitnessCoachController],
  providers: [AppService, ChatService, OpenAIChatService, ChatWithToolService, MemoryChatService, FitnessCoachService, FitnessCoachLiteService],
})
export class AppModule {}
