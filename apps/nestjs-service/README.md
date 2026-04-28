# NestJS 后端服务

基于 [NestJS](https://nestjs.com/) 框架构建的后端服务，提供 RESTful API 接口。

## 技术栈

- [NestJS](https://nestjs.com/) - 渐进式 Node.js 框架
- [TypeScript](https://www.typescriptlang.org/) - 类型安全的 JavaScript 超集
- [Express](https://expressjs.com/) - Web 应用框架
- [Prisma](https://www.prisma.io/) - 下一代 ORM
- [PostgreSQL](https://www.postgresql.org/) - 关系型数据库
- [ioredis](https://github.com/redis/ioredis) - Redis 客户端
- [Redis](https://redis.io/) - 内存数据库（用户缓存 + 短期对话记忆）
- [Passport](http://www.passportjs.org/) - 认证中间件
- [JWT](https://jwt.io/) - JSON Web Token 认证
- [bcrypt](https://github.com/kelektiv/node.bcrypt.js) - 密码加密
- [RxJS](https://rxjs.dev/) - 响应式编程库
- [LangChain](https://js.langchain.com/) - AI 应用开发框架
- [Jest](https://jestjs.io/) - JavaScript 测试框架
- [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) - 代码规范与格式化

## 项目结构

```
src/
├── agent/               # AI 智能体
│   ├── langchain/          # LangChain 智能体
│   ├── langgraph-teacher/  # LangGraph 教师智能体
│   └── openai-chat.agent.ts # OpenAI 智能体
├── auth/                # 认证模块
│   ├── decorators/         # 装饰器（@Public, @CurrentUser）
│   ├── dto/                # 数据传输对象
│   ├── guards/             # JWT 守卫
│   ├── strategies/         # Passport 策略
│   ├── auth.controller.ts  # 认证控制器
│   ├── auth.module.ts      # 认证模块
│   └── auth.service.ts     # 认证服务
├── chat/                # 聊天模块
│   ├── chat.controller.ts    # 聊天控制器
│   ├── chat.service.ts       # 聊天服务
│   └── ...                   # 其他聊天服务
├── chat-thread/         # 会话管理模块
│   ├── chat-thread.controller.ts # 会话控制器
│   ├── chat-thread.module.ts   # 会话模块
│   └── chat-thread.service.ts  # 会话服务
├── checkpointer/        # LangGraph 检查点模块
│   ├── langgraph-checkpointer.module.ts  # 检查点模块（全局）
│   └── langgraph-checkpointer.service.ts # PostgresSaver 服务
├── common/               # 公共模块（请求上下文 + 日志中间件）
│   ├── common.module.ts         # 全局 @Global() 模块
│   ├── request-context.service.ts # AsyncLocalStorage 请求上下文
│   └── request-logging.middleware.ts # HTTP 单行日志 + cacheHit
├── redis/                # Redis 模块（全局单例）
│   ├── redis.module.ts          # @Global() 模块
│   ├── redis.service.ts         # ioredis 封装 + HIT/MISS 打点
│   └── redis.constants.ts       # REDIS_CLIENT token + Key 工厂
├── langgraph-teacher/   # 教师模块
│   ├── teacher.controller.ts # 教师控制器
│   └── teacher.service.ts    # 教师服务
├── prisma/              # 数据库模块
│   ├── prisma.module.ts    # Prisma 模块
│   └── prisma.service.ts   # Prisma 服务
├── tools/               # 工具函数
│   ├── calc.tools.ts       # 计算工具
│   └── time.tools.ts       # 时间工具
├── user/                # 用户模块
│   ├── user.module.ts      # 用户模块
│   └── user.service.ts     # 用户服务
├── app.controller.ts    # 根控制器
├── app.module.ts        # 根模块
├── app.service.ts       # 根服务
└── main.ts              # 应用入口文件

prisma/
├── schema.prisma        # 数据库模型定义
├── migrations/          # 数据库迁移记录
└── prisma.config.ts     # Prisma 配置
```

## 安装依赖

```bash
pnpm install
```

## 数据库设置

### 1. 配置环境变量

复制并编辑环境变量文件：

```bash
cp .env.example .env
```

在 `.env` 中配置数据库连接：

```env
# PostgreSQL 数据库连接
DATABASE_URL=postgresql://user:password@host:5432/dbname

# JWT 配置
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d
```

### 2. 执行数据库迁移

```bash
# 创建并应用迁移
npx prisma migrate dev

# 生成 Prisma Client
npx prisma generate

# 查看数据库（可选）
npx prisma studio
```

### 数据库模型

当前使用 PostgreSQL 数据库，包含以下表：

- **User** - 用户表（id, email, username, password, createdAt, updatedAt）
- **ChatThread** - 聊天会话表（id, userId, agentType, title, createdAt, updatedAt）
  - 与 User 建立一对多关系，删除用户时级联删除会话
  - 索引：`[userId, agentType, updatedAt]` 优化查询性能
- **LangGraph Checkpoints** - LangGraph 框架自动管理的检查点表（由 `@langchain/langgraph-checkpoint-postgres` 自动创建）
  - `checkpoints` - 检查点元数据
  - `checkpoint_blobs` - 检查点数据（消息内容等）
  - `checkpoint_writes` - 检查点写入记录
  - `checkpoint_migrations` - 检查点迁移记录

## 启动开发服务器

```bash
# 开发模式（带热重载）
pnpm dev

# 或
pnpm start:dev
```

服务默认运行在 http://localhost:3000

## Redis 配置与连通性验证

项目使用 Redis 提供：

1. 登录态用户信息缓存（key：`ai-setup:user:{id}`），减少鉴权时的 DB 查询。
2. LangGraph Checkpointer 的旁路缓存（`ai-setup:ckpt:{threadId}:{ns}:{checkpointId}` 与 `...:latest`），PostgreSQL 仍是 source of truth。

### 环境变量

```env
# Redis 开关，false 时整个 Redis 链路被旁路（用于压测对比）
REDIS_ENABLED=true
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
# 所有 key 都会自动拼接这个前缀，多个环境共用一个 Redis 实例时避免撕 Key
REDIS_KEY_PREFIX=ai-setup:
```

### 连通性验证

```bash
# 返回 { "enabled": true, "status": "PONG" } 即表示连通正常
curl http://localhost:3000/health/redis
```

启动日志中应观察到 `[RedisService] connected to <host>:<port> (PONG)`。若 `REDIS_ENABLED=false`，则输出 `Redis 未启用 (REDIS_ENABLED=false)…`。

### 请求日志与 cacheHit 打点

项目穿通 `RequestLoggingMiddleware` + `AsyncLocalStorage`，每个 HTTP 请求结束时输出单行日志：

```
[HTTP] GET /chat-threads 200 12ms userId=1 cacheHit=HIT
[HTTP] POST /auth/login 201 45ms userId=1 cacheHit=-
```

`cacheHit` 四态：

- `HIT`：命中 Redis
- `MISS`：未命中，回源 DB
- `BYPASS`：`REDIS_ENABLED=false` 或本次请求未走 Redis
- `ERROR`：Redis 异常，已降级

推荐用法【autocannon 压测对比】：

1. `REDIS_ENABLED=false` 启动，跑一轮 `autocannon` 压测，记录 QPS / P95。
2. 改为 `REDIS_ENABLED=true` 重启，再跑一轮。
3. 对比日志中 `cacheHit=HIT` 占比与 autocannon 指标。

## 登录用户信息缓存

登录 / 注册成功后，`AuthService` 会写入 `ai-setup:user:{id}`，TTL 与 `JWT_EXPIRES_IN` 对齐；`JwtStrategy.validate` 在鉴权时优先读 Redis，MISS 时回源 DB 并回写。语义摘要：

- 缓存内容：`{ id, email, username }`（不包含密码等敏感字段）
- 主动失效：`AuthService.invalidateUserCache(userId)`，预留给登出 / 资料变更
- Redis 写入失败不阶级主流程，业务自动降级走 DB

## LangGraph Checkpointer Redis 旁路缓存

`LanggraphCheckpointerService` 使用自定义的 `RedisPostgresHybridCheckpointer`（继承 `PostgresSaver`）：

- **读路径**：`getTuple` 先查 `ai-setup:ckpt:{threadId}:{ns}:latest` 取到 `checkpointId`，再读 `ai-setup:ckpt:{threadId}:{ns}:{checkpointId}`；未命中则回源 PG 并回填 Redis，TTL 1 小时。
- **写路径**：`put` 先落 PG，再 `MULTI` 写入 tuple 与 latest 指针；`putWrites` 落 PG 后失效对应缓存。
- **删除**：`deleteThread` 走父类删 PG，再用 `SCAN` 匹配 `ai-setup:ckpt:{threadId}:*` 分批删除，避免 `KEYS` 阻塞。
- **序列化**：使用 `BaseCheckpointSaver.serde.dumpsTyped / loadsTyped`（含 BaseMessage 类型信息），以 base64 承载 JSON 字符串，外层有 `v:1` 版本字段，反序列化失败直接当 MISS 回源。

### REDIS_ENABLED 降级

`REDIS_ENABLED=false` 或 ioredis 未初始化时，Hybrid 中所有 Redis 分支直接走 `BYPASS`，请求日志 `cacheHit=BYPASS`，业务等价于纯 PostgresSaver。

### autocannon 对比方法

1. 准备好一个有多轮历史的 `threadId`（例如先用该账号走 `/chat/memory/stream` 对话 2 次）。
2. `REDIS_ENABLED=false` 启动，autocannon 压 `/chat-threads/:id/messages` 或 `/chat/memory/stream`（冷热读路径）。
3. 切换 `REDIS_ENABLED=true`，预热一次（MISS → 回填）后再压一轮。
4. 对比：
   - autocannon 产出的 QPS / P95
   - 后端日志中 `cacheHit=HIT` 占比（grep / awk 单行日志）
5. `redis-cli FLUSHDB` 后再压一轮，可以验证缓存仅起加速作用、数据仍完整（Postgres 源数据不丢）。

## 其他启动方式

```bash
# 普通启动
pnpm start

# 调试模式
pnpm start:debug

# 生产模式
pnpm start:prod
```

## 构建

```bash
pnpm build
```

构建输出位于 `dist/` 目录。

## 代码规范

```bash
# 运行 ESLint 检查并自动修复
pnpm lint

# 使用 Prettier 格式化代码
pnpm format
```

## 测试

```bash
# 单元测试
pnpm test

# 单元测试（监听模式）
pnpm test:watch

# 测试覆盖率
pnpm test:cov

# 端到端测试
pnpm test:e2e

# 调试测试
pnpm test:debug
```

## API 接口

### 认证接口

- `POST /auth/register` - 用户注册
- `POST /auth/login` - 用户登录

**注册示例**：

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"testuser","password":"password123"}'
```

**登录示例**：

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

响应：

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 聊天接口（需要 JWT 认证）

所有聊天接口需要在请求头中携带 JWT Token：

```
Authorization: Bearer <access_token>
```

- `GET /chat/stream?message=xxx` - 基础聊天（SSE）
- `POST /chat/stream` - 基础聊天（SSE，POST）
- `GET /chat/dashscope/stream?message=xxx` - DashScope 聊天
- `GET /chat/openai/stream?message=xxx` - OpenAI 聊天
- `GET /chat/tool/stream?message=xxx` - 工具调用聊天
- `GET /chat/memory/stream?message=xxx&threadId=xxx` - 记忆聊天（支持会话持久化 + Redis 旁路缓存）

### 会话管理接口（需要 JWT 认证）

- `GET /chat-threads?agentType=memory|teacher` - 获取用户的会话列表
- `POST /chat-threads` - 创建新会话（body: `{ agentType, title? }`）
- `PATCH /chat-threads/:id` - 重命名会话（body: `{ title }`）
- `DELETE /chat-threads/:id` - 删除会话（同时删除对应的 LangGraph checkpoint）
- `GET /chat-threads/:id/messages` - 获取会话的历史消息列表

**创建会话示例**：

```bash
curl -X POST http://localhost:3000/chat-threads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"agentType":"memory","title":"我的对话"}'
```

**获取历史消息示例**：

```bash
curl http://localhost:3000/chat-threads/{threadId}/messages \
  -H "Authorization: Bearer <token>"
```

响应：

```json
{
  "messages": [
    { "role": "human", "content": "你好" },
    { "role": "ai", "content": "你好！有什么可以帮助你的？" }
  ]
}
```

### 教师接口（需要 JWT 认证）

- `POST /teacher/stream` - 智能教师分析（SSE，HITL）
- `POST /teacher/resume` - 恢复教师执行（SSE）

### 其他接口

- `GET /` - 根接口
- `GET /health/redis` - Redis 连通性健康检查

## 配置说明

### 环境变量

- `DATABASE_URL` - PostgreSQL 数据库连接字符串
- `JWT_SECRET` - JWT 签名密钥（生产环境务必修改）
- `JWT_EXPIRES_IN` - JWT 过期时间（默认：7d，同时用作用户缓存的 TTL）
- `DASHSCOPE_API_KEY` - DashScope API 密钥
- `REDIS_ENABLED` - 是否启用 Redis（默认 true，false 时全线旁路）
- `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB` - Redis 连接参数
- `REDIS_KEY_PREFIX` - 全局 Key 前缀（默认 `ai-setup:`）
- `PORT` - 服务端口（默认：3000）

### JWT 认证

系统使用全局 JWT 守卫保护所有接口，通过 `@Public()` 装饰器标记公开接口：

```typescript
// 公开接口（无需登录）
@Public()
@Post('login')
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}

// 受保护接口（需要登录）
@Post('stream')
@Sse()
streamChat(@Body() body: ChatDto) {
  // 自动验证 JWT token
}
```

### 会话持久化（LangGraph Checkpointer）

项目使用 `@langchain/langgraph-checkpoint-postgres` 实现对话状态的数据库持久化：

**核心模块**：

- **LanggraphCheckpointerModule** - 全局模块，提供 PostgresSaver 单例
- **LanggraphCheckpointerService** - 管理 PostgresSaver 生命周期（setup/end）

**工作原理**：

1. 应用启动时，`PostgresSaver.fromConnString(DATABASE_URL)` 创建检查点保存器
2. 调用 `saver.setup()` 自动在数据库中创建 checkpoint 相关表
3. Agent 编译时注入 checkpointer：`workflow.compile({ checkpointer: saver })`
4. 每次对话状态变更自动持久化到 PostgreSQL
5. 重启服务后，使用相同 `threadId` 可继续之前的对话

**智能体改造**：

- `MemoryChatAgent` - 改为 `@Injectable()`，懒加载模式，首次调用时编译
- `TeacherAgent` - 改为 `@Injectable()`，保留 HITL 中断/恢复功能

**会话管理**：

- `ChatThreadService` - 管理用户会话列表，校验归属权和 agentType
- 首条消息时自动更新会话标题（取用户消息前 30 字）
- 删除会话时同步清理 LangGraph checkpoint 数据

### 数据库模块

使用 Prisma ORM 管理数据库：

- **PrismaModule** - 全局模块，提供 PrismaService
- **PrismaService** - 继承 PrismaClient，自动连接数据库
- **UserModule** - 用户 CRUD 操作
- **AuthModule** - 认证逻辑和 JWT 管理
- **LanggraphCheckpointerModule** - LangGraph 检查点持久化（全局模块）
- **ChatThreadModule** - 会话管理模块（CRUD + 历史消息）

## 参考资料

- [NestJS 官方文档](https://docs.nestjs.com/)
- [NestJS 中文文档](https://docs.nestjs.cn/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
