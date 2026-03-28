/**
 * MCP 客户端服务
 * 用于连接到 MCP 服务器并获取角色档案资源
 *
 * 本服务演示如何作为 MCP 客户端连接到远程 MCP 服务器，
 * 获取 Resources（只读上下文数据）和调用 Tools
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// 角色档案类型定义
export interface CharacterProfile {
  id: string;
  name: string;
  nickname: string;
  englishName?: string;
  basicInfo: {
    age: number;
    gender: string;
    hometown: string;
    currentLocation: string;
    education: string;
    teachingYears?: number;
    workingYears?: string;
    subjects?: string[];
    position?: string;
  };
  background: {
    childhood: { story: string; keyEvent: string };
    youth: { story: string; keyEvent: string };
    adulthood: { story: string; keyEvent: string };
  };
  personality: {
    traits: string[];
    teachingStyle?: string;
    workingStyle?: string;
    motto: string;
    quirks: string[];
    dialectPhrases?: Array<{ phrase: string; meaning: string }>;
  };
  relationships: Array<{
    person: string;
    relation: string;
    detail: string;
  }>;
  dailyLife: {
    routine: string;
    hobbies: string[];
    favoriteFood: string;
    dislikes: string;
  };
  campusMemories?: Array<{ year: string; event: string }>;
  secrets: {
    hiddenTalent: string;
    regret: string;
    wish: string;
    slangDictionary?: Record<string, string>;
    treasure?: string;
  };
}

// MCP 服务器配置
// 注意：MCP 客户端在服务内部直接访问 NestJS 路由（无 /api 代理前缀）
const MCP_SERVER_URL =
  process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';

/**
 * MCP 客户端服务类
 * 提供连接 MCP 服务器、读取 Resources、调用 Tools 的能力
 */
export class McpClientService {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private connected = false;

  // 角色档案缓存（避免频繁请求）
  private profileCache: Map<string, CharacterProfile> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 分钟缓存
  private lastCacheTime = 0;

  /**
   * 连接到 MCP 服务器
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // 创建 SSE 传输层连接到 MCP 服务器
      this.transport = new SSEClientTransport(new URL(MCP_SERVER_URL));

      // 创建 MCP 客户端
      this.client = new Client(
        {
          name: 'teacher-agent-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            // 声明客户端支持的能力
          },
        },
      );

      // 连接到服务器
      await this.client.connect(this.transport);
      this.connected = true;

      console.log('[MCP Client] Connected to MCP server at', MCP_SERVER_URL);
    } catch (error) {
      console.error('[MCP Client] Failed to connect:', error);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.close();
      this.connected = false;
      this.client = null;
      this.transport = null;
      console.log('[MCP Client] Disconnected from MCP server');
    }
  }

  /**
   * 确保已连接
   */
  private async ensureConnected(): Promise<Client> {
    if (!this.connected || !this.client) {
      await this.connect();
    }
    return this.client!;
  }

  /**
   * 列出所有可用的 Resources
   */
  async listResources(): Promise<
    Array<{ uri: string; name: string; description?: string }>
  > {
    const client = await this.ensureConnected();
    const result = await client.listResources();
    return result.resources.map((r) => ({
      uri: r.uri,
      name: r.name ?? '',
      description: r.description,
    }));
  }

  /**
   * 读取指定 Resource 内容
   * @param uri 资源 URI，如 'profile://math/full'
   */
  async readResource(uri: string): Promise<string> {
    const client = await this.ensureConnected();
    const result = await client.readResource({ uri });

    // 返回第一个内容块的文本
    const content = result.contents[0];
    if (content && 'text' in content) {
      return content.text;
    }
    throw new Error(`Resource ${uri} has no text content`);
  }

  /**
   * 获取角色档案
   * @param character 角色类型: 'math' | 'english' | 'security'
   * @returns 角色档案对象
   */
  async getCharacterProfile(
    character: 'math' | 'english' | 'security',
  ): Promise<CharacterProfile> {
    // 检查缓存
    const now = Date.now();
    if (
      this.profileCache.has(character) &&
      now - this.lastCacheTime < this.cacheExpiry
    ) {
      return this.profileCache.get(character)!;
    }

    // 从 MCP 服务器读取 Resource
    const uri = `profile://${character}/full`;
    const jsonText = await this.readResource(uri);
    const profile = JSON.parse(jsonText) as CharacterProfile;

    // 更新缓存
    this.profileCache.set(character, profile);
    this.lastCacheTime = now;

    return profile;
  }

  /**
   * 调用 MCP Tool: get_character_info
   * @param character 角色类型
   * @param field 要查询的字段
   */
  async getCharacterInfo(
    character: 'math' | 'english' | 'security',
    field:
      | 'basicInfo'
      | 'background'
      | 'personality'
      | 'relationships'
      | 'dailyLife'
      | 'secrets',
  ): Promise<unknown> {
    const client = await this.ensureConnected();
    const result = await client.callTool({
      name: 'get_character_info',
      arguments: { character, field },
    });

    // 解析返回的 JSON
    const content = result.content as Array<{ type: string; text?: string }>;
    const firstContent = content[0];
    if (firstContent && firstContent.type === 'text' && firstContent.text) {
      return JSON.parse(firstContent.text) as unknown;
    }
    throw new Error('Unexpected tool response format');
  }

  /**
   * 调用 MCP Tool: get_character_relationship
   * @param character1 角色1
   * @param character2 角色2
   */
  async getCharacterRelationship(
    character1: 'math' | 'english' | 'security',
    character2: 'math' | 'english' | 'security',
  ): Promise<{
    character1: string;
    character2: string;
    relation: unknown;
  }> {
    const client = await this.ensureConnected();
    const result = await client.callTool({
      name: 'get_character_relationship',
      arguments: { character1, character2 },
    });

    const content = result.content as Array<{ type: string; text?: string }>;
    const firstContent = content[0];
    if (firstContent && firstContent.type === 'text' && firstContent.text) {
      return JSON.parse(firstContent.text) as {
        character1: string;
        character2: string;
        relation: unknown;
      };
    }
    throw new Error('Unexpected tool response format');
  }
}

// 导出单例实例
export const mcpClient = new McpClientService();
