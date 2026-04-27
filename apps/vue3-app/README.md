# Vue3 前端应用

基于 [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) 构建的现代化前端应用。

## 技术栈

- [Vue 3](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Vue Router](https://router.vuejs.org/) - 官方路由管理
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [TypeScript](https://www.typescriptlang.org/) - 类型安全的 JavaScript 超集
- [Axios](https://axios-http.com/) - HTTP 客户端
- [markdown-it](https://github.com/markdown-it/markdown-it) - Markdown 解析器
- [@microsoft/fetch-event-source](https://github.com/Azure/fetch-event-source) - SSE (Server-Sent Events) 支持

## 项目结构

```
src/
├── api/                 # API 服务层
│   ├── index.ts            # axios 实例和拦截器配置
│   └── services/           # 按模块划分的 API 服务
│       ├── auth.service.ts     # 认证相关接口
│       └── chat-thread.service.ts # 会话管理接口
├── assets/              # 静态资源
│   └── vue.svg
├── components/          # Vue 组件
│   ├── ChatInterface.vue   # 聊天界面组件（含会话侧边栏）
│   ├── ConfirmDialog.vue   # 确认对话框组件
│   └── Message.vue         # 消息组件
├── controllers/         # 控制器
│   └── sse.controller.ts   # SSE 控制器
├── enums/               # 枚举定义
│   └── message.enum.ts     # 消息类型枚举
├── router/              # 路由配置
│   └── index.ts            # 路由定义和守卫
├── utils/               # 工具函数
│   └── markdown.util.ts    # Markdown 工具
├── views/               # 页面视图
│   ├── ChatView.vue        # 聊天页面
│   └── LoginView.vue       # 登录页面
├── App.vue              # 根组件
├── main.js              # 应用入口
├── style.css            # 全局样式
└── vite-env.d.ts        # Vite 类型声明
```

## 安装依赖

```bash
pnpm install
```

## 启动开发服务器

```bash
pnpm dev
```

开发服务器默认运行在 http://localhost:5173

## 构建

```bash
# 生产构建
pnpm build

# 构建并预览
pnpm build
pnpm preview
```

构建输出位于 `dist/` 目录。

## 代码规范

```bash
pnpm lint
```

## 主要功能

### 认证系统

- **JWT Token 管理** - 自动携带 token，自动处理 401 错误
- **登录/注册页面** - 美观的用户认证界面
- **路由守卫** - 未登录自动跳转登录页

### API 服务层

应用采用分层架构，API 调用统一管理：

```typescript
// 示例：调用认证服务
import { login, register } from "./api/services/auth.service";

// 登录
const response = await login({ email: "user@example.com", password: "123456" });
localStorage.setItem("token", response.access_token);

// 注册
const response = await register({
  email: "user@example.com",
  username: "username",
  password: "123456",
});
```

**特性**：

- ✅ 自动携带 JWT Token（请求拦截器）
- ✅ 自动处理 401 错误（响应拦截器）
- ✅ 使用 Vite 代理，无需配置完整 Base URL
- ✅ 统一的错误处理
- ✅ TypeScript 类型安全

**代理配置**：

开发环境下，Vite 会将 `/api` 请求代理到后端：

```
前端请求: /api/auth/login
代理到:   http://localhost:3000/auth/login
```

生产环境下，前后端运行在同一域名，直接使用相对路径即可。

### 组件

- **ChatInterface.vue** - 聊天界面，支持 SSE 实时消息和会话管理
  - 左侧会话侧边栏：切换 Agent 类型、新建/删除会话、点击切换历史会话
  - 右侧聊天区：消息展示、输入框、发送按钮
  - 自动加载历史消息并回显
- **LoginView.vue** - 登录/注册页面
- **ChatView.vue** - 聊天页面容器
- **ConfirmDialog.vue** - 确认对话框组件
- **Message.vue** - 消息展示组件

### 会话管理

应用支持多会话管理和历史消息加载：

**会话侧边栏功能**：

- ✅ Agent 类型切换（Memory Chat / Teacher）
- ✅ 新建会话（自动选择最新会话或创建空会话）
- ✅ 会话列表（显示标题、更新时间）
- ✅ 点击切换会话（加载历史消息）
- ✅ 删除会话（二次确认）

**工作流程**：

1. 页面加载时自动获取当前 Agent 类型的会话列表
2. 自动选中最新会话，如果没有则创建空会话
3. 点击切换会话时，调用 `/chat-threads/{id}/messages` 加载历史
4. 发送新消息时，携带 `threadId`，后端自动关联到对应会话
5. 首条消息发送后，自动更新会话标题

**API 调用示例**：

```typescript
import {
  listThreads,
  createThread,
  getThreadMessages,
} from "./api/services/chat-thread.service";

// 获取会话列表
const threads = await listThreads("memory");

// 创建新会话
const newThread = await createThread({ agentType: "memory", title: "新会话" });

// 获取历史消息
const { messages } = await getThreadMessages(threadId);
// messages: [{ role: "human", content: "..." }, { role: "ai", content: "..." }]
```

### SSE 支持

应用已集成 Server-Sent Events 支持，可通过 `sse.controller.ts` 与后端建立实时连接。所有 SSE 请求自动携带 JWT Token。

**聊天 SSE 流程**：

1. 用户输入消息，调用 `createEventStream(endpoint, body)`
2. `endpoint` 根据当前 Agent 类型动态切换（`/chat/memory/stream` 或 `/teacher/stream`）
3. `body` 携带 `{ message, threadId }`
4. 后端流式返回响应，前端实时渲染 Markdown 内容

## 配置说明

- `vite.config.ts` - Vite 配置文件（包含 API 代理设置）
- `tsconfig.json` - TypeScript 配置
- `tsconfig.node.json` - Node 环境 TypeScript 配置
- `index.html` - 入口 HTML 文件

### 环境变量

创建 `.env` 文件（可选）：

```env
# API 基础 URL（开发环境使用 Vite 代理，通常不需要配置）
VITE_API_BASE_URL=http://localhost:3000
```

### API 代理

`vite.config.ts` 已配置开发环境代理：

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

## 参考资料

- [Vue 3 官方文档](https://vuejs.org/guide/introduction.html)
- [Vue 3 中文文档](https://cn.vuejs.org/)
- [Vite 官方文档](https://vitejs.dev/guide/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
