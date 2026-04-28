import { Global, Module } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

/**
 * 公共基础模块：请求上下文等
 * 标记 @Global() 后其他模块无需重复导入
 */
@Global()
@Module({
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class CommonModule {}
