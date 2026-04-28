import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestContextService } from './request-context.service';

/**
 * 全局请求日志中间件
 * - 用 AsyncLocalStorage 建立请求上下文
 * - 请求结束时单行输出 method url status durationMs userId=? cacheHit=?
 * - 便于 autocannon 压测后用 grep/awk 聚合
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly context: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startedAt = Date.now();
    this.context.run({ startedAt }, () => {
      res.on('finish', () => {
        const store = this.context.getStore();
        const duration = Date.now() - startedAt;
        const userId = store?.userId ?? '-';
        const cacheHit = store?.cacheHit ?? '-';
        this.logger.log(
          `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms userId=${userId} cacheHit=${cacheHit}`,
        );
      });
      next();
    });
  }
}
