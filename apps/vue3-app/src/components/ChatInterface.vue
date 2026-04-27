<template>
  <div class="chat-layout">
    <!-- ── 侧边栏：会话列表 ────────────────────── -->
    <aside class="chat-sidebar">
      <div class="sidebar-header">
        <h3>会话列表</h3>
      </div>

      <div class="sidebar-agent-tabs">
        <button
          :class="{ active: selectedAgent === 'memory' }"
          @click="switchAgent('memory')"
        >
          记忆聊天
        </button>
        <button
          :class="{ active: selectedAgent === 'teacher' }"
          @click="switchAgent('teacher')"
        >
          智能老师
        </button>
      </div>

      <button class="new-thread-btn" @click="handleCreateThread">
        + 新建会话
      </button>

      <div class="thread-list">
        <div
          v-for="thread in threads"
          :key="thread.id"
          :class="{
            'thread-item': true,
            active: thread.id === currentThreadId,
          }"
          @click="handleSelectThread(thread.id)"
        >
          <span class="thread-title" :title="thread.title">{{
            thread.title
          }}</span>
          <button
            class="thread-delete"
            title="删除会话"
            @click.stop="handleDeleteThread(thread.id)"
          >
            ×
          </button>
        </div>
        <div v-if="!threads.length" class="thread-empty">暂无会话</div>
      </div>
    </aside>

    <!-- ── 主区域：对话 ────────────────────── -->
    <div class="chat-interface">
      <div class="chat-header">
        <h1>AI 对话工具</h1>
        <span v-if="currentThread" class="current-thread-label">
          当前：{{ currentThread.title }}
        </span>
      </div>

      <ConfirmDialog
        :visible="showConfirmDialog"
        :question="pendingConfirm?.question ?? ''"
        :subject="pendingConfirm?.subject ?? ''"
        @confirm="handleConfirm"
        @cancel="handleCancel"
      />

      <div class="chat-messages" ref="messagesContainer">
        <Message
          v-for="(message, index) in messages"
          :key="index"
          :content="message.content"
          :role="message.role"
        />
        <div v-if="isLoading" class="loading-indicator">
          <span>AI 正在思考...</span>
        </div>
      </div>

      <div class="chat-input">
        <textarea
          v-model="inputMessage"
          :placeholder="
            currentThreadId ? '输入你的问题...' : '请先在左侧选择或新建一个会话'
          "
          @keyup.enter.exact="sendMessage"
          @keyup.enter.shift="inputMessage += '\n'"
          :disabled="isLoading || !currentThreadId"
        ></textarea>
        <button
          @click="sendMessage"
          :disabled="!inputMessage.trim() || isLoading || !currentThreadId"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, computed, watch } from "vue";
import Message from "./Message.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import { MessageRoleEnum } from "../enums/message.enum";
import { createEventStream } from "../controllers/sse.controller";
import {
  listThreads,
  createThread,
  deleteThread as apiDeleteThread,
  getThreadMessages,
  type AgentType,
  type ChatThread,
} from "../api/services/chat-thread.service";

interface ChatMessage {
  content: string;
  role: MessageRoleEnum;
}

interface PendingConfirm {
  question: string;
  subject: string;
  threadId: string;
  aiMessageIndex: number;
}

const messages = ref<ChatMessage[]>([]);
const inputMessage = ref("");
const isLoading = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);

// ── HITL ──────────────────────────────────────
const showConfirmDialog = ref(false);
const pendingConfirm = ref<PendingConfirm | null>(null);

// ── 会话列表/切换 ─────────────────────────────
const selectedAgent = ref<AgentType>("memory");
const threads = ref<ChatThread[]>([]);
const currentThreadId = ref<string>("");

const currentThread = computed(() =>
  threads.value.find((t) => t.id === currentThreadId.value),
);

const streamEndpoint = computed(() =>
  selectedAgent.value === "teacher"
    ? "/api/teacher/stream"
    : "/api/chat/memory/stream",
);

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

// ── 侧边栏：加载会话 / 切换 / 新建 / 删除 ────────
async function refreshThreads(selectLatest = false) {
  const list = (await listThreads(
    selectedAgent.value,
  )) as unknown as ChatThread[];
  threads.value = list;
  if (selectLatest && list.length) {
    await handleSelectThread(list[0].id);
  } else if (!list.length) {
    currentThreadId.value = "";
    messages.value = [];
  }
}

async function switchAgent(agent: AgentType) {
  if (agent === selectedAgent.value) return;
  selectedAgent.value = agent;
  currentThreadId.value = "";
  messages.value = [];
  await refreshThreads(true);
}

async function handleCreateThread() {
  const thread = (await createThread(
    selectedAgent.value,
  )) as unknown as ChatThread;
  threads.value = [thread, ...threads.value];
  await handleSelectThread(thread.id);
}

async function handleDeleteThread(id: string) {
  if (!confirm("确定要删除这个会话吗？")) return;
  await apiDeleteThread(id);
  threads.value = threads.value.filter((t) => t.id !== id);
  if (currentThreadId.value === id) {
    currentThreadId.value = "";
    messages.value = [];
  }
}

async function handleSelectThread(id: string) {
  currentThreadId.value = id;
  // 加载历史消息
  const history = (await getThreadMessages(id)) as unknown as Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  messages.value = history.map((m) => ({
    content: m.content,
    role: m.role === "user" ? MessageRoleEnum.USER : MessageRoleEnum.ASSISTANT,
  }));
  scrollToBottom();
}

// ── SSE 消息处理（基础） ─────────────────────
function handleSseMessage(msg: any, aiMessageIndex: number) {
  try {
    const parsedData = JSON.parse(msg.data);
    if (parsedData.type === "chunk" && parsedData.content) {
      messages.value[aiMessageIndex].content += parsedData.content;
      scrollToBottom();
    } else if (parsedData.type === "end") {
      isLoading.value = false;
      scrollToBottom();
      refreshThreads();
    } else if (parsedData.type === "error") {
      messages.value[aiMessageIndex].content = `错误: ${parsedData.message}`;
      isLoading.value = false;
    }
  } catch (error) {
    console.error("解析消息失败:", error);
  }
}

// ── SSE 消息处理（老师 HITL） ─────────────────
function handleTeacherSseMessage(
  msg: any,
  aiMessageIndex: number,
  threadId: string,
) {
  try {
    const parsedData = JSON.parse(msg.data);
    if (parsedData.type === "chunk" && parsedData.content) {
      messages.value[aiMessageIndex].content += parsedData.content;
      scrollToBottom();
    } else if (parsedData.type === "confirm") {
      isLoading.value = false;
      pendingConfirm.value = {
        question: parsedData.question,
        subject: parsedData.subject,
        threadId,
        aiMessageIndex,
      };
      showConfirmDialog.value = true;
    } else if (parsedData.type === "end") {
      isLoading.value = false;
      scrollToBottom();
      refreshThreads();
    } else if (parsedData.type === "error") {
      messages.value[aiMessageIndex].content = `错误: ${parsedData.message}`;
      isLoading.value = false;
    }
  } catch (error) {
    console.error("解析消息失败:", error);
  }
}

// ── HITL 确认 ────────────────────────────────
function handleConfirm() {
  showConfirmDialog.value = false;
  if (!pendingConfirm.value) return;

  const { threadId, aiMessageIndex } = pendingConfirm.value;
  pendingConfirm.value = null;
  isLoading.value = true;

  createEventStream(
    "/api/teacher/resume",
    { threadId, confirmed: true },
    {
      onmessage: (msg) =>
        handleTeacherSseMessage(msg, aiMessageIndex, threadId),
      onclose: () => {
        isLoading.value = false;
      },
      onerror: () => {
        isLoading.value = false;
      },
    },
  );
}

function handleCancel() {
  showConfirmDialog.value = false;
  if (!pendingConfirm.value) return;

  const { threadId, aiMessageIndex } = pendingConfirm.value;
  pendingConfirm.value = null;
  isLoading.value = true;

  createEventStream(
    "/api/teacher/resume",
    { threadId, confirmed: false },
    {
      onmessage: (msg) =>
        handleTeacherSseMessage(msg, aiMessageIndex, threadId),
      onclose: () => {
        isLoading.value = false;
      },
      onerror: () => {
        isLoading.value = false;
      },
    },
  );
}

// ── 发送消息 ─────────────────────────────────
function sendMessage() {
  const message = inputMessage.value.trim();
  if (!message || isLoading.value || !currentThreadId.value) return;

  messages.value.push({ content: message, role: MessageRoleEnum.USER });
  inputMessage.value = "";
  isLoading.value = true;
  scrollToBottom();

  const aiMessageIndex = messages.value.length;
  messages.value.push({ content: "", role: MessageRoleEnum.ASSISTANT });

  const isTeacherApi = selectedAgent.value === "teacher";
  const threadId = currentThreadId.value;

  createEventStream(
    streamEndpoint.value,
    { message, threadId },
    {
      onopen: async (response) => {
        if (!response.ok) {
          messages.value[aiMessageIndex].content = "连接失败，请重试";
          isLoading.value = false;
        }
      },
      onmessage: (msg) => {
        if (isTeacherApi) {
          handleTeacherSseMessage(msg, aiMessageIndex, threadId);
        } else {
          handleSseMessage(msg, aiMessageIndex);
        }
      },
      onclose: () => {
        isLoading.value = false;
      },
      onerror: (err) => {
        console.error("发生错误:", err);
        if (!messages.value[aiMessageIndex].content) {
          messages.value[aiMessageIndex].content = "连接出错，请重试";
        }
        isLoading.value = false;
      },
    },
  );
}

// 进入页面或切换 agent 时加载
watch(
  selectedAgent,
  () => {
    refreshThreads(true);
  },
  { immediate: false },
);

onMounted(async () => {
  await refreshThreads(true);
  scrollToBottom();
});
</script>

<style scoped>
.chat-layout {
  display: flex;
  height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
}

/* ── 侧边栏 ───────────────────────── */
.chat-sidebar {
  width: 260px;
  padding: 20px 16px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.sidebar-agent-tabs {
  display: flex;
  gap: 6px;
}

.sidebar-agent-tabs button {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #4b5563;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.sidebar-agent-tabs button.active {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff;
  border-color: transparent;
}

.new-thread-btn {
  padding: 10px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(59, 130, 246, 0.25);
  transition: transform 0.2s;
}
.new-thread-btn:hover {
  transform: translateY(-1px);
}

.thread-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}

.thread-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(243, 244, 246, 0.7);
  cursor: pointer;
  transition: background 0.2s;
}
.thread-item:hover {
  background: rgba(209, 213, 219, 0.8);
}
.thread-item.active {
  background: rgba(99, 102, 241, 0.12);
  box-shadow: inset 3px 0 0 #6366f1;
}

.thread-title {
  flex: 1;
  font-size: 13px;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thread-delete {
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.thread-delete:hover {
  color: #ef4444;
}

.thread-empty {
  color: #9ca3af;
  font-size: 13px;
  text-align: center;
  padding: 16px 0;
}

/* ── 主聊天区 ────────────────────── */
.chat-interface {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px 32px;
  box-sizing: border-box;
  overflow: hidden;
}

.chat-header {
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: baseline;
  gap: 14px;
}

.chat-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.current-thread-label {
  font-size: 13px;
  color: #6b7280;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  margin-bottom: 16px;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.06),
    0 1px 2px rgba(0, 0, 0, 0.04);
}

.chat-input {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.chat-input textarea {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e8e8e8;
  border-radius: 12px;
  resize: none;
  height: 70px;
  font-size: 15px;
  font-family: inherit;
  background: #fafafa;
  color: #333;
  transition: all 0.2s;
}
.chat-input textarea:focus {
  outline: none;
  border-color: #6366f1;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
}
.chat-input textarea::placeholder {
  color: #9ca3af;
}

.chat-input button {
  padding: 0 24px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
}
.chat-input button:hover:not(:disabled) {
  transform: translateY(-1px);
}
.chat-input button:disabled {
  background: linear-gradient(135deg, #d1d5db 0%, #c4c7cc 100%);
  cursor: not-allowed;
  box-shadow: none;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 14px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 12px;
  color: #92400e;
  font-size: 14px;
  font-weight: 500;
}
.loading-indicator::before {
  content: "";
  width: 8px;
  height: 8px;
  background: #f59e0b;
  border-radius: 50%;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

.chat-messages::-webkit-scrollbar,
.thread-list::-webkit-scrollbar {
  width: 6px;
}
.chat-messages::-webkit-scrollbar-thumb,
.thread-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}
</style>
