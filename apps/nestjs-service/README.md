# NestJS 后端服务

基于 [NestJS](https://nestjs.com/) 框架构建的后端服务，提供 RESTful API 接口。

## 技术栈

- [NestJS](https://nestjs.com/) - 渐进式 Node.js 框架
- [TypeScript](https://www.typescriptlang.org/) - 类型安全的 JavaScript 超集
- [Express](https://expressjs.com/) - Web 应用框架
- [Prisma](https://www.prisma.io/) - 下一代 ORM
- [PostgreSQL](https://www.postgresql.org/) - 关系型数据库
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

## 启动开发服务器

```bash
# 开发模式（带热重载）
pnpm dev

# 或
pnpm start:dev
```

服务默认运行在 http://localhost:3000

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
- `GET /chat/memory/stream?message=xxx&threadId=xxx` - 记忆聊天

### 教师接口（需要 JWT 认证）

- `POST /teacher/stream` - 智能教师分析（SSE，HITL）
- `POST /teacher/resume` - 恢复教师执行（SSE）

### 其他接口

- `GET /` - 根接口
- `GET /health` - 健康检查

## 配置说明

### 环境变量

- `DATABASE_URL` - PostgreSQL 数据库连接字符串
- `JWT_SECRET` - JWT 签名密钥（生产环境务必修改）
- `JWT_EXPIRES_IN` - JWT 过期时间（默认：7d）
- `DASHSCOPE_API_KEY` - DashScope API 密钥
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

### 数据库模块

使用 Prisma ORM 管理数据库：

- **PrismaModule** - 全局模块，提供 PrismaService
- **PrismaService** - 继承 PrismaClient，自动连接数据库
- **UserModule** - 用户 CRUD 操作
- **AuthModule** - 认证逻辑和 JWT 管理

## 参考资料

- [NestJS 官方文档](https://docs.nestjs.com/)
- [NestJS 中文文档](https://docs.nestjs.cn/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
