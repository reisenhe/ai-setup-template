import { Controller, Get, Post, Req, Res, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMcpServer } from './mcp-server';

/**
 * MCP (Model Context Protocol) 控制器
 * 基于官方 SDK 实现 SSE 传输的 MCP 服务器
 *
 * 路由前缀: /mcp
 *
 * 端点:
 * - GET  /mcp    - MCP SSE 连接端点（供 MCP 客户端连接）
 * - POST /mcp    - MCP 消息接收端点
 *
 * 提供的 Resources:
 * - profile://math/full       - 数学老师陈严谨完整档案
 * - profile://english/full    - 英语老师王潇洒完整档案
 * - profile://security/full   - 保安队长李德全完整档案
 * - profile://network/relationships - 角色关系网络
 *
 * 提供的 Tools:
 * - get_character_info        - 获取角色特定信息
 * - get_character_relationship - 获取角色间关系
 */
@Controller('mcp')
export class McpController {
  // 存储活跃的 SSE 传输连接，key 为 session ID
  private transports: Map<string, SSEServerTransport> = new Map();

  /**
   * MCP SSE 连接端点
   * GET /mcp
   *
   * MCP 客户端通过此端点建立 SSE 连接
   * 连接成功后，客户端可以通过 POST /mcp 发送 JSON-RPC 消息
   */
  @Get()
  async handleSseConnection(@Res() res: Response) {
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 创建 SSE 传输层，消息接收端点为 /mcp
    const transport = new SSEServerTransport('/mcp', res);

    // 存储 transport 以便后续 POST 请求使用
    // SSEServerTransport 在初始化时会通过 SSE 发送 session ID
    this.transports.set(transport.sessionId, transport);

    // 创建新的 MCP 服务器实例并连接
    const mcpServer = createMcpServer();
    await mcpServer.connect(transport);

    console.log(
      '[MCP] Client connected via SSE, session:',
      transport.sessionId,
    );

    // 当连接关闭时清理
    res.on('close', () => {
      this.transports.delete(transport.sessionId);
      console.log('[MCP] Client disconnected, session:', transport.sessionId);
    });
  }

  /**
   * MCP 消息接收端点
   * POST /mcp
   *
   * 接收来自 MCP 客户端的 JSON-RPC 消息
   * 消息通过 SSEServerTransport 处理后转发给 MCP 服务器
   */
  @Post()
  async handleMcpMessage(@Req() req: Request, @Res() res: Response) {
    // 从查询参数中获取 session ID
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'Missing sessionId' });
      return;
    }

    const transport = this.transports.get(sessionId);
    if (!transport) {
      res.status(HttpStatus.NOT_FOUND).json({ error: 'Session not found' });
      return;
    }

    // 调用 transport 的消息处理方法
    await transport.handlePostMessage(req, res);
  }

  /**
   * 健康检查端点
   * GET /mcp/health
   *
   * 提供非 MCP 格式的简单健康检查，方便直接浏览器访问
   */
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      service: 'MCP Profile Server',
      version: '1.0.0',
      protocol: 'Model Context Protocol',
      transport: 'SSE',
      activeSessions: this.transports.size,
      availableResources: [
        'profile://math/full',
        'profile://english/full',
        'profile://security/full',
        'profile://network/relationships',
      ],
      availableTools: ['get_character_info', 'get_character_relationship'],
    };
  }
}
