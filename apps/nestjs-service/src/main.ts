import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // 禁用默认 bodyParser，MCP SSE 传输层需要读取原始请求流
  // body-parser 的条件注册在 AppModule.configure() 中完成
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
