import apiClient from "../index";

export type AgentType = "memory" | "teacher";

export interface ChatThread {
  id: string;
  userId: number;
  agentType: AgentType;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** 获取当前用户的会话列表 */
export const listThreads = (agentType: AgentType) => {
  return apiClient.get<ChatThread[]>("/chat-threads", {
    params: { agentType },
  });
};

/** 新建会话 */
export const createThread = (agentType: AgentType, title?: string) => {
  return apiClient.post<ChatThread>("/chat-threads", { agentType, title });
};

/** 重命名会话 */
export const renameThread = (id: string, title: string) => {
  return apiClient.patch<ChatThread>(`/chat-threads/${id}`, { title });
};

/** 删除会话 */
export const deleteThread = (id: string) => {
  return apiClient.delete<{ id: string }>(`/chat-threads/${id}`);
};

/** 获取会话历史消息（用于回显） */
export const getThreadMessages = (id: string) => {
  return apiClient.get<ChatMessage[]>(`/chat-threads/${id}/messages`);
};
