import { Module } from '@nestjs/common';
import { ChatThreadController } from './chat-thread.controller';
import { ChatThreadService } from './chat-thread.service';

@Module({
  controllers: [ChatThreadController],
  providers: [ChatThreadService],
  exports: [ChatThreadService],
})
export class ChatThreadModule {}
