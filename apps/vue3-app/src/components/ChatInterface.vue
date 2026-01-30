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
  margin: 0 auto;
  padding: 20px;
  box-sizing: border-box;
}

.chat-header {
  margin-bottom: 20px;
}

.chat-header h1 {
  font-size: 24px;
  color: #333;
  margin: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 12px;
  margin-bottom: 20px;
}

.chat-input {
  display: flex;
  gap: 10px;
}

.chat-input textarea {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  resize: none;
  height: 100px;
  font-size: 14px;
  font-family: inherit;
}

.chat-input button {
  padding: 0 24px;
  background-color: #0078d4;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.chat-input button:hover:not(:disabled) {
  background-color: #005a9e;
}

.chat-input button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.loading-indicator {
  margin-top: 10px;
  color: #666;
  font-style: italic;
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 8px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}
</style>
