# MCP Server 创建指南

## 是什么

**MCP（Model Context Protocol）** 是 Anthropic 提出的开放协议，用于标准化 LLM 应用与外部数据/能力的交互方式。它定义了三种核心原语：

| 原语 | 类型 | 说明 |
|------|------|------|
| **Resources** | 只读上下文 | 静态数据，注入到 LLM 上下文中（类似文件、数据库记录） |
| **Tools** | 可调用函数 | LLM 按需调用，执行查询或操作，返回结果 |
| **Prompts** | 模板 | 可复用的提示词模板 |

### 核心依赖

```bash
# MCP 服务端（官方 SDK）
pnpm add @modelcontextprotocol/sdk

# MCP 客户端适配器（LangChain 集成，将 MCP Tools 转为 LangChain Tools）
pnpm add @langchain/mcp-adapters
```

---

## 为什么

### 什么时候适合用 MCP

| 场景 | 适合 | 说明 |
|------|------|------|
| 角色/人物档案、背景故事 | ✅ | 数据结构固定，由 LLM 按需取用 |
| 第三方 API 查询（天气、股票、搜索） | ✅ | 标准化工具调用接口 |
| 知识库检索 | ✅ | 向量检索结果作为 Resource 或 Tool 返回 |
| 需要渐进式披露的上下文 | ✅ | 只在用户问到时才查询，节省 token |
| **一次性注入 System Prompt** | ❌ | 直接 import 文件更简单，不需要 MCP |
| 实时计算（数学运算） | ❌ | 直接用 LangChain Tool 定义更合适 |

### MCP vs 直接 import

```
直接 import：
  代码 → 读取文件 → 全量注入 SystemPrompt → LLM 被动接收

MCP Tools：
  LLM → 自主判断 → 按需调用 get_character_info → 只获取需要的字段
```

MCP 的核心价值：**让 LLM 成为数据获取的主动决策者，而不是被动接收者**。

### 输入与输出

```
输入（客户端 → MCP 服务器）：
  GET /mcp          → 建立 SSE 长连接
  POST /mcp?sessionId=xxx → JSON-RPC 请求（listTools / callTool / readResource）

输出（MCP 服务器 → 客户端）：
  Resources: { contents: [{ uri, mimeType, text }] }
  Tools:     { content: [{ type: "text", text: "JSON 字符串" }] }
```

---

## 怎么做

### 1. 创建 MCP 服务器

```typescript
// src/mcp/mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export function createMcpServer() {
  const server = new Server(
    { name: 'my-mcp-server', version: '1.0.0' },
    {
      capabilities: {
        resources: {}, // 声明支持 Resources
        tools: {},     // 声明支持 Tools
      },
    },
  );

  // ── Resources ────────────────────────────────────────────────

  // 列出可用资源
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'profile://math/full',
        name: '数学老师陈严谨',
        mimeType: 'application/json',
        description: '完整角色档案',
      },
    ],
  }));

  // 读取资源内容
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    // 解析 uri，查询数据，返回 JSON 文本
    const data = { name: '陈严谨', age: 42 }; // 实际从 DB / 文件读取
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data) }],
    };
  });

  // ── Tools ─────────────────────────────────────────────────────

  // 列出可用工具
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'get_character_info',
        description: '获取角色指定字段的信息',
        inputSchema: {
          type: 'object',
          properties: {
            character: { type: 'string', enum: ['math', 'english', 'security'] },
            field: {
              type: 'string',
              enum: ['basicInfo', 'background', 'personality', 'relationships', 'secrets'],
            },
          },
          required: ['character', 'field'],
        },
      },
    ],
  }));

  // 执行工具调用
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'get_character_info') {
      const { character, field } = args as { character: string; field: string };
      const data = profiles[character][field]; // 实际查询逻辑
      return {
        content: [{ type: 'text', text: JSON.stringify({ character, field, data }) }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}
```

---

### 2. 在 NestJS 中暴露 SSE 端点

MCP 使用 SSE（Server-Sent Events）作为传输层。NestJS 需要做两件事：管理 SSE 会话、路由 POST 消息。

```typescript
// src/mcp/mcp.controller.ts
import { Controller, Get, Post, Req, Res, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMcpServer } from './mcp-server';

@Controller('mcp')
export class McpController {
  // 维护活跃会话，key = sessionId
  private transports: Map<string, SSEServerTransport> = new Map();

  @Get()
  async handleSseConnection(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const transport = new SSEServerTransport('/mcp', res);
    this.transports.set(transport.sessionId, transport);

    const mcpServer = createMcpServer();
    await mcpServer.connect(transport);

    res.on('close', () => this.transports.delete(transport.sessionId));
  }

  @Post()
  async handleMcpMessage(@Req() req: Request, @Res() res: Response) {
    const sessionId = req.query.sessionId as string;
    const transport = this.transports.get(sessionId);

    if (!transport) {
      res.status(HttpStatus.NOT_FOUND).json({ error: 'Session not found' });
      return;
    }

    // 将原始请求流交给 transport 处理（不能经过 body-parser！）
    await transport.handlePostMessage(req, res);
  }
}
```

> ⚠️ **关键配置**：`handlePostMessage` 需要读取原始请求流，NestJS 默认的 body-parser 会消费该流导致 `stream is not readable` 错误。

```typescript
// src/app.module.ts —— 排除 MCP POST 路由的 body 解析
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { json } from 'express';

@Module({ /* controllers, providers... */ })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(json())
      .exclude({ path: 'mcp', method: RequestMethod.POST }) // ← 关键排除
      .forRoutes('*');
  }
}
```

```typescript
// src/main.ts —— 禁用默认 bodyParser
const app = await NestFactory.create(AppModule, { bodyParser: false });
```

---

### 3. 接入 Agent：MCP Tools → LangChain Tools

使用 `@langchain/mcp-adapters` 的 `MultiServerMCPClient` 将 MCP Tools 自动转换为 LangChain 可用的工具，绑定给 LLM。

```typescript
// src/agent/teacher.agent.ts
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import type { StructuredToolInterface } from '@langchain/core/tools';

// ── 懒加载 + 缓存（避免每次调用重新连接）─────────────────────────
let mcpToolsCache: StructuredToolInterface[] | null = null;
let mcpAdapterClient: MultiServerMCPClient | null = null;

async function getMcpTools(): Promise<StructuredToolInterface[]> {
  if (mcpToolsCache) return mcpToolsCache;

  mcpAdapterClient = new MultiServerMCPClient({
    // key = 服务器名称（任意），value = 连接配置
    'school-profiles': {
      transport: 'sse',
      url: process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp',
    },
  });

  mcpToolsCache = await mcpAdapterClient.getTools();
  return mcpToolsCache;
}

// ── 在 LangGraph 节点中使用 ──────────────────────────────────────
async function mathNode(state: TeacherStateType) {
  const llm = new ChatOpenAI({ /* ... */ });

  const mcpTools = await getMcpTools();
  const allTools = [...calcTools, ...mcpTools]; // 可与其他工具混合
  const llmWithTools = llm.bindTools(allTools);

  const systemPrompt = `你是数学老师，角色ID "math"。
按需调用工具：
- get_character_info(character="math", field="personality") → 获取性格和教学风格
- get_character_relationship(character1="math", character2=...) → 查询角色关系
- calculate(expression=...) → 精确计算`;

  // 工具调用循环（MCP Tools + calcTools 统一处理）
  const messages = [new SystemMessage(systemPrompt), ...state.messages];
  let response = await llmWithTools.invoke(messages);
  messages.push(response);

  while (response.tool_calls?.length) {
    for (const toolCall of response.tool_calls) {
      const tool = allTools.find((t) => t.name === toolCall.name);
      if (tool) {
        const invoke = tool.invoke.bind(tool) as (a: unknown) => Promise<unknown>;
        const result = await invoke(toolCall.args);
        const content = typeof result === 'string' ? result : JSON.stringify(result);
        messages.push(new ToolMessage({ content, tool_call_id: toolCall.id! }));
      }
    }
    response = await llmWithTools.invoke(messages);
    messages.push(response);
  }

  return { messages: [new AIMessage(response.content as string)] };
}
```

---

### 4. 整体数据流

```
Vue 前端
  │  POST /api/teacher/start    (Vite proxy → /teacher/start)
  ▼
NestJS TeacherController
  │  teacherAgent.startStream()
  ▼
LangGraph Teacher Agent (mathNode / englishNode / securityNode)
  │  getMcpTools() —— 首次调用，建立 SSE 连接
  ▼
MultiServerMCPClient ──SSE──► NestJS McpController (GET /mcp)
                               │
                    LLM 决策调用工具
                               │
                    POST /mcp?sessionId=xxx
                               ▼
                        SSEServerTransport
                               ▼
                        MCP Server Handler
                          (get_character_info)
                               ▼
                        返回角色字段 JSON
  ◄────────────────────────────┘
LLM 基于工具结果生成最终回复
  ▼
SSE 流式返回给前端
```

---

### 5. 关键约束与注意事项

| 约束 | 说明 |
|------|------|
| **不能跳过 MCP 直接 import 数据文件** | 破坏了协议封装，无法演示 MCP 的独立性 |
| **MCP 内部地址 ≠ 前端代理地址** | 前端走 Vite proxy `/api/mcp` → `/mcp`，但 NestJS 内部客户端直接访问 `http://localhost:3000/mcp` |
| **`/mcp` POST 必须绕过 body-parser** | `SSEServerTransport.handlePostMessage` 需要读取原始流 |
| **MCP Tools 缓存** | 每次 `getTools()` 都会建立新 SSE 连接，务必做单例缓存 |
| **工具 invoke 类型** | `calcTools` 与 `mcpTools` 类型签名不兼容，需统一包装后调用 |
