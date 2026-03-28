import { Injectable, NotFoundException } from '@nestjs/common';
import { mathTeacherProfile } from './teacher/math-teacher.profile';
import { englishTeacherProfile } from './teacher/english-teacher.profile';
import { securityGuardProfile } from './teacher/security-guard.profile';

export type ProfileType = 'math' | 'english' | 'security';

/**
 * MCP (Model Context Protocol) 服务
 * 提供角色档案查询功能，支持数学老师、英语老师、保安老李的背景资料
 */
@Injectable()
export class McpService {
  private readonly profiles = {
    math: mathTeacherProfile,
    english: englishTeacherProfile,
    security: securityGuardProfile,
  };

  /**
   * 获取指定角色的完整档案
   * @param type 角色类型: math | english | security
   * @returns 角色完整档案对象
   */
  getProfile(type: ProfileType) {
    const profile = this.profiles[type];
    if (!profile) {
      throw new NotFoundException(`未找到角色档案: ${type}`);
    }
    return profile;
  }

  /**
   * 获取指定角色的基础信息
   * @param type 角色类型
   * @returns 基础信息（姓名、年龄、籍贯等）
   */
  getBasicInfo(type: ProfileType) {
    const profile = this.getProfile(type);
    return {
      id: profile.id,
      name: profile.name,
      nickname: profile.nickname,
      englishName: profile.englishName,
      basicInfo: profile.basicInfo,
    };
  }

  /**
   * 获取指定角色的成长经历
   * @param type 角色类型
   * @returns 童年、青年、成年三段经历
   */
  getBackground(type: ProfileType) {
    const profile = this.getProfile(type);
    return {
      name: profile.name,
      background: profile.background,
    };
  }

  /**
   * 获取指定角色的人际关系
   * @param type 角色类型
   * @returns 与其他角色的关系描述
   */
  getRelationships(type: ProfileType) {
    const profile = this.getProfile(type);
    return {
      name: profile.name,
      relationships: profile.relationships,
    };
  }

  /**
   * 获取指定角色的性格特点
   * @param type 角色类型
   * @returns 性格特质、教学/工作风格、口头禅等
   */
  getPersonality(type: ProfileType) {
    const profile = this.getProfile(type);
    return {
      name: profile.name,
      personality: profile.personality,
    };
  }

  /**
   * 获取所有可用角色列表
   * @returns 角色摘要列表
   */
  getAllProfiles() {
    const roleMap: Record<string, string> = {
      math: '数学老师',
      english: '英语老师',
      security: '保安队长',
    };

    return Object.entries(this.profiles).map(([key, profile]) => ({
      type: key,
      id: profile.id,
      name: profile.name,
      nickname: profile.nickname,
      role: roleMap[key] || 'Staff',
      avatar: `/assets/${key}-avatar.png`,
    }));
  }

  /**
   * 获取角色间的互动关系网
   * 用于展示角色之间的关联
   * @returns 关系网络数据
   */
  getRelationshipNetwork() {
    return {
      nodes: [
        {
          id: 'math',
          name: '陈严谨',
          role: '数学老师',
          avatar: '/assets/math-avatar.png',
        },
        {
          id: 'english',
          name: '王潇洒',
          role: '英语老师',
          avatar: '/assets/english-avatar.png',
        },
        {
          id: 'security',
          name: '李德全',
          role: '保安队长',
          avatar: '/assets/security-avatar.png',
        },
      ],
      edges: [
        {
          source: 'math',
          target: 'english',
          relation: '棋友',
          strength: 'strong',
        },
        {
          source: 'math',
          target: 'security',
          relation: '忘年交',
          strength: 'strong',
        },
        {
          source: 'english',
          target: 'security',
          relation: '篮球搭子',
          strength: 'medium',
        },
      ],
    };
  }
}
