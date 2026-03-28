/**
 * MCP (Model Context Protocol) 服务器
 * 基于官方 SDK 实现，提供角色档案作为 Resource
 *
 * 参考: https://docs.langchain.com/oss/javascript/langchain/mcp
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { mathTeacherProfile } from './teacher/math-teacher.profile';
import { englishTeacherProfile } from './teacher/english-teacher.profile';
import { securityGuardProfile } from './teacher/security-guard.profile';

// 角色档案数据存储
const profiles = {
  math: mathTeacherProfile,
  english: englishTeacherProfile,
  security: securityGuardProfile,
};

const profileNames: Record<string, string> = {
  math: '陈严谨（数学老师）',
  english: '王潇洒（英语老师）',
  security: '李德全（保安队长）',
};

/**
 * 创建并配置 MCP 服务器
 */
export function createMcpServer() {
  const server = new Server(
    {
      name: 'school-character-profiles',
      version: '1.0.0',
    },
    {
      capabilities: {
        // 提供角色档案作为 Resources（只读上下文）
        resources: {},
        // 提供查询工具作为 Tools（可选）
        tools: {},
      },
    },
  );

  // ============================================================
  // Resources: 角色档案（主要功能）
  // ============================================================

  // 列出所有可用资源
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'profile://math/full',
          name: profileNames.math,
          mimeType: 'application/json',
          description:
            '数学老师陈严谨的完整档案，包含背景故事、性格特点、人际关系等',
        },
        {
          uri: 'profile://english/full',
          name: profileNames.english,
          mimeType: 'application/json',
          description:
            '英语老师王潇洒的完整档案，包含布鲁克林成长经历、嘻哈文化背景等',
        },
        {
          uri: 'profile://security/full',
          name: profileNames.security,
          mimeType: 'application/json',
          description: '保安队长李德全的完整档案，包含东北农村出身、军旅生涯等',
        },
        {
          uri: 'profile://network/relationships',
          name: '角色关系网络',
          mimeType: 'application/json',
          description: '三位角色之间的互动关系图谱',
        },
      ],
    };
  });

  // 读取指定资源内容
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    // 解析 URI: profile://{type}/full 或 profile://network/relationships
    const match = uri.match(/^profile:\/\/(\w+)\/(\w+)$/);
    if (!match) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }

    const [, type, section] = match;

    if (type === 'network' && section === 'relationships') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                nodes: [
                  { id: 'math', name: '陈严谨', role: '数学老师' },
                  { id: 'english', name: '王潇洒', role: '英语老师' },
                  { id: 'security', name: '李德全', role: '保安队长' },
                ],
                edges: [
                  {
                    source: 'math',
                    target: 'english',
                    relation: '棋友',
                    detail: '每周在教师食堂下棋',
                  },
                  {
                    source: 'math',
                    target: 'security',
                    relation: '忘年交',
                    detail: '老李送烤红薯，老陈教数学题',
                  },
                  {
                    source: 'english',
                    target: 'security',
                    relation: '篮球搭子',
                    detail: '每周三篮球场单挑',
                  },
                ],
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    const profile = profiles[type as keyof typeof profiles];
    if (!profile || section !== 'full') {
      throw new Error(`Resource not found: ${uri}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(profile, null, 2),
        },
      ],
    };
  });

  // ============================================================
  // Tools: 查询工具（辅助功能）
  // ============================================================

  // 列出可用工具
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_character_info',
          description: '获取指定角色的特定信息片段，用于在对话中引用角色背景',
          inputSchema: {
            type: 'object',
            properties: {
              character: {
                type: 'string',
                enum: ['math', 'english', 'security'],
                description:
                  '角色类型: math(数学老师), english(英语老师), security(保安)',
              },
              field: {
                type: 'string',
                enum: [
                  'basicInfo',
                  'background',
                  'personality',
                  'relationships',
                  'dailyLife',
                  'secrets',
                ],
                description: '要查询的信息字段',
              },
            },
            required: ['character', 'field'],
          },
        },
        {
          name: 'get_character_relationship',
          description: '获取两个角色之间的关系描述',
          inputSchema: {
            type: 'object',
            properties: {
              character1: {
                type: 'string',
                enum: ['math', 'english', 'security'],
                description: '第一个角色',
              },
              character2: {
                type: 'string',
                enum: ['math', 'english', 'security'],
                description: '第二个角色',
              },
            },
            required: ['character1', 'character2'],
          },
        },
      ],
    };
  });

  // 执行工具调用
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'get_character_info': {
        const { character, field } = args as {
          character: keyof typeof profiles;
          field: string;
        };
        const profile = profiles[character];
        if (!profile) {
          throw new Error(`Unknown character: ${character}`);
        }
        const data = (profile as Record<string, unknown>)[field];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { character: profile.name, field, data },
                null,
                2,
              ),
            },
          ],
        };
      }

      case 'get_character_relationship': {
        const { character1, character2 } = args as {
          character1: keyof typeof profiles;
          character2: keyof typeof profiles;
        };
        const profile1 = profiles[character1];
        const profile2 = profiles[character2];

        if (!profile1 || !profile2) {
          throw new Error('Unknown character');
        }

        // 在 profile1 的关系列表中查找与 profile2 的关系
        const relation = profile1.relationships.find(
          (r: { person: string }) =>
            r.person.includes(profile2.name) ||
            profile2.name.includes(r.person),
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  character1: profile1.name,
                  character2: profile2.name,
                  relation: relation || '两人没有直接互动记录',
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}
