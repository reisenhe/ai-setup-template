# Turbo Monorepo 项目模板

这是一个基于 Turborepo 的 monorepo 项目模板，集成了 NestJS 后端服务和 Vue3 前端应用。

## 项目介绍

本项目采用 monorepo 架构，使用 pnpm workspaces 和 Turborepo 进行包管理，包含以下应用和包：

### 应用 (Apps)

- **nestjs-service** - NestJS 后端服务，提供 RESTful API 接口
- **vue3-app** - Vue3 前端应用，基于 Vite 构建

### 共享包 (Packages)

- **@turbo-monorepo/utils** - 通用工具函数包，可在各应用间共享

## 技术栈

### 整体架构
- [Turborepo](https://turbo.build/) - 高性能的 monorepo 构建系统
- [pnpm](https://pnpm.io/) - 高效的包管理器

### 后端 (nestjs-service)
- [NestJS](https://nestjs.com/) - 渐进式 Node.js 框架
- [TypeScript](https://www.typescriptlang.org/) - 类型安全的 JavaScript 超集
- [Jest](https://jestjs.io/) - JavaScript 测试框架
- [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) - 代码规范与格式化

### 前端 (vue3-app)
- [Vue 3](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [TypeScript](https://www.typescriptlang.org/) - 类型安全的 JavaScript 超集
- [markdown-it](https://github.com/markdown-it/markdown-it) - Markdown 解析器
- [@microsoft/fetch-event-source](https://github.com/Azure/fetch-event-source) - SSE (Server-Sent Events) 支持

## 环境要求

- Node.js >= 18
- pnpm >= 10.0.0

## 安装

```bash
# 克隆项目后，安装所有依赖
pnpm install
```

## 环境配置

后端服务需要配置 AI API 密钥：

```bash
# 进入后端服务目录
cd apps/nestjs-service

# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入你的 API Key
```

`.env` 文件内容：
```bash
# DashScope API 配置（通义千问）
# 获取 API Key: https://help.aliyun.com/zh/model-studio/get-api-key
DASHSCOPE_API_KEY=sk-your-api-key
```

## 启动开发环境

### 同时启动所有应用

```bash
# 在根目录执行，会同时启动后端和前端
pnpm dev
```

### 单独启动后端服务

```bash
cd apps/nestjs-service
pnpm dev
```
后端服务默认运行在 http://localhost:3000

### 单独启动前端应用

```bash
cd apps/vue3-app
pnpm dev
```
前端应用默认运行在 http://localhost:5173

## 构建

```bash
# 构建所有应用和包
pnpm build
```

## 代码规范

```bash
# 运行所有项目的 lint
pnpm lint

# 格式化所有代码
pnpm format
```

## 项目结构

```
.
├── apps/
│   ├── nestjs-service/     # NestJS 后端服务
│   └── vue3-app/           # Vue3 前端应用
├── packages/
│   └── utils/              # 共享工具包
├── package.json            # 根目录配置
├── pnpm-workspace.yaml     # pnpm workspace 配置
└── turbo.json              # Turborepo 配置
```

## 开发说明

- 使用 `pnpm dev` 可以同时启动前后端服务，便于联调开发
- 共享包 `@turbo-monorepo/utils` 中的代码可以在任意应用中通过 import 引入使用
- 前端应用已配置 SSE (Server-Sent Events) 支持，可用于实时通信场景