<script setup lang="ts">
import { ref } from 'vue';
import ChatInterface from './components/ChatInterface.vue';
import FitnessCoach from './components/FitnessCoach.vue';

type PageType = 'chat' | 'fitness';
const currentPage = ref<PageType>('fitness');
</script>

<template>
  <div class="app-container">
    <!-- 页面切换导航 -->
    <nav class="page-nav">
      <button 
        class="nav-btn" 
        :class="{ active: currentPage === 'chat' }"
        @click="currentPage = 'chat'"
      >
        AI 对话
      </button>
      <button 
        class="nav-btn" 
        :class="{ active: currentPage === 'fitness' }"
        @click="currentPage = 'fitness'"
      >
        健身计划
      </button>
    </nav>

    <!-- 页面内容 -->
    <main class="page-content">
      <ChatInterface v-if="currentPage === 'chat'" />
      <FitnessCoach v-else-if="currentPage === 'fitness'" />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background-color: #f5f5f5;
  color: #333;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.page-nav {
  display: flex;
  gap: 8px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  z-index: 100;
}

.nav-btn {
  padding: 8px 20px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.nav-btn.active {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-color: transparent;
  color: white;
}

.page-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.page-content > div {
  flex: 1;
  width: 100%;
  overflow-y: auto;
}
</style>
