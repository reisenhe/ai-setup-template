import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * 安全计算器工具
 * 仅允许数字和 + - * / ( ) . 字符，防止代码注入
 */
export const calculateTool = tool(
  async ({ expression }) => {
    // 白名单校验：只允许数字、运算符和括号
    if (!/^[\d\s+\-*/().]+$/.test(expression)) {
      return `无效的表达式: "${expression}"。仅支持加减乘除和括号。`;
    }

    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${expression})`)();
      if (typeof result !== 'number' || !isFinite(result)) {
        return `计算结果无效（可能存在除以零的情况）`;
      }
      return `${expression} = ${result}`;
    } catch {
      return `表达式解析失败: "${expression}"`;
    }
  },
  {
    name: 'calculate',
    description:
      '计算数学表达式，支持加(+)、减(-)、乘(*)、除(/)和括号。例如 (3 + 5) * 2 或 100 / 4 - 3',
    schema: z.object({
      expression: z
        .string()
        .describe('要计算的数学表达式，如 "(3 + 5) * 2" 或 "100 / 4"'),
    }),
  },
);

export const calcTools = [calculateTool];
