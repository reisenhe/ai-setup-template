<template>
  <div class="chat-interface">
    <div class="chat-header">
      <h1>AI 对话工具</h1>
    </div>
    
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
        placeholder="输入你的问题..."
        @keyup.enter.exact="sendMessage"
        @keyup.enter.shift="inputMessage += '\n'"
        :disabled="isLoading"
      ></textarea>
      <button 
        @click="sendMessage"
        :disabled="!inputMessage.trim() || isLoading"
      >
        发送
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
import Message from './Message.vue';
import { MessageRoleEnum } from '../enums/message.enum';
import { createEventStream } from '../controllers/sse.controller';

interface Message {
  content: string;
  role: MessageRoleEnum;
}

const messages = ref<Message[]>([
  {
    content: '你好！我是一个 AI 助手，有什么我可以帮助你的吗？',
    role: MessageRoleEnum.ASSISTANT
  }
]);

const inputMessage = ref('');
const isLoading = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);

// 模拟 SSE 接口地址，实际项目中需要替换为真实的后端接口
const SSE_URL = 'http://localhost:3000/api/sse/stream';

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

function sendMessage() {
  const message = inputMessage.value.trim();
  if (!message || isLoading.value) return;

  // 添加用户消息
  messages.value.push({
    content: message,
    role: MessageRoleEnum.USER
  });

  inputMessage.value = '';
  isLoading.value = true;

  scrollToBottom();

  // 模拟 AI 回复
  // 实际项目中，这里应该调用 createEventStream 与后端进行流式通信
  setTimeout(() => {
    // 模拟流式回复
    let aiResponse = '这是一个 AI 生成的回复。';
    
    // 添加 AI 回复
    messages.value.push({
      content: aiResponse,
      role: MessageRoleEnum.ASSISTANT
    });
    
    isLoading.value = false;
    scrollToBottom();
  }, 1000);

  // 实际项目中的流式通信代码
  /*
  const controller = createEventStream(
    SSE_URL,
    { prompt: message },
    {
      onopen: async (response) => {
        if (!response.ok) {
          console.error('连接失败:', response.status);
          isLoading.value = false;
        }
      },
      onmessage: (msg) => {
        // 处理流式消息
        const data = msg.data;
        try {
          const parsedData = JSON.parse(data);
          // 这里需要根据后端返回的数据格式进行处理
          console.log('收到消息:', parsedData);
        } catch (error) {
          console.error('解析消息失败:', error);
        }
      },
      onclose: () => {
        console.log('连接关闭');
        isLoading.value = false;
      },
      onerror: (err) => {
        console.error('发生错误:', err);
        isLoading.value = false;
      }
    }
  );
  */
}

onMounted(() => {
  scrollToBottom();
});
</script>

<style scoped>
.chat-interface {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 32px;
  box-sizing: border-box;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
}

.chat-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.chat-header h1 {
  font-size: 26px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
  letter-spacing: -0.5px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  margin-bottom: 20px;
  box-shadow: 
    0 4px 24px rgba(0, 0, 0, 0.06),
    0 1px 2px rgba(0, 0, 0, 0.04);
}

.chat-input {
  display: flex;
  gap: 14px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.04);
}

.chat-input textarea {
  flex: 1;
  padding: 14px 18px;
  border: 2px solid #e8e8e8;
  border-radius: 12px;
  resize: none;
  height: 80px;
  font-size: 15px;
  font-family: inherit;
  background: #fafafa;
  color: #333;
  transition: all 0.25s ease;
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
  padding: 0 28px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.25s ease;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
}

.chat-input button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
}

.chat-input button:active:not(:disabled) {
  transform: translateY(0);
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
  margin-top: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 12px;
  color: #92400e;
  font-size: 14px;
  font-weight: 500;
}

.loading-indicator::before {
  content: '';
  width: 8px;
  height: 8px;
  background: #f59e0b;
  border-radius: 50%;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
  transition: background 0.2s;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}
</style>
