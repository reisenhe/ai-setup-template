import { Global, Module } from '@nestjs/common';
import { LanggraphCheckpointerService } from './langgraph-checkpointer.service';

@Global()
@Module({
  providers: [LanggraphCheckpointerService],
  exports: [LanggraphCheckpointerService],
})
export class LanggraphCheckpointerModule {}
