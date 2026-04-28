import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Redis 连通性健康检查 */
  @Public()
  @Get('health/redis')
  async healthRedis() {
    const enabled = this.redisService.isEnabled();
    if (!enabled) {
      return { enabled: false, status: 'DISABLED' };
    }
    try {
      const pong = await this.redisService.ping();
      return { enabled: true, status: pong };
    } catch (err) {
      return {
        enabled: true,
        status: 'ERROR',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
