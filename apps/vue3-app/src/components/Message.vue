<template>
  <div class="message" :class="{ 'user-message': isUserMessage, 'ai-message': isAIMessage }">
    <div class="message-bubble">
      <div class="message-content" v-html="renderedContent"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { MessageRoleEnum } from '../enums/message.enum';
import { useMarkdownRenderer } from '../utils/markdown.util';

interface Props {
  content: string;
  role: MessageRoleEnum;
}

const props = defineProps<Props>();

const { renderMarkdown } = useMarkdownRenderer();

const isUserMessage = computed(() => props.role === MessageRoleEnum.USER);
const isAIMessage = computed(() => props.role === MessageRoleEnum.ASSISTANT);

const renderedContent = computed(() => {
  return renderMarkdown(props.content);
});
</script>

<style scoped>
.message {
  display: flex;
  margin-bottom: 16px;
  max-width: 80%;
}

.user-message {
  justify-content: flex-end;
  align-self: flex-end;
}

.ai-message {
  justify-content: flex-start;
  align-self: flex-start;
}

.message-bubble {
  padding: 12px 16px;
  border-radius: 18px;
  word-wrap: break-word;
}

.user-message .message-bubble {
  background-color: #0078d4;
  color: white;
  border-bottom-right-radius: 4px;
}

.ai-message .message-bubble {
  background-color: #f0f0f0;
  color: #333;
  border-bottom-left-radius: 4px;
}

.message-content {
  line-height: 1.5;
}

/* 确保 Markdown 内容正确显示 */
.message-content :deep(p) {
  margin: 0 0 8px 0;
}

.message-content :deep(ul),
.message-content :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.message-content :deep(code) {
  background-color: rgba(255, 255, 255, 0.2);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: monospace;
}

.user-message .message-content :deep(code) {
  background-color: rgba(255, 255, 255, 0.2);
}

.ai-message .message-content :deep(code) {
  background-color: rgba(0, 0, 0, 0.1);
}
</style>
