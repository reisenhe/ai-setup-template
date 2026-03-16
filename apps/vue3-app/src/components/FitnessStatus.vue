<template>
  <div class="fitness-status">
    <!-- 步骤条 -->
    <div class="steps-container">
      <div class="steps-header">
        <h3>执行步骤</h3>
      </div>
      <div class="steps-list">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          class="step-item"
          :class="getStepClass(index)"
        >
          <div class="step-indicator">
            <div class="step-icon">
              <span v-if="getStepStatus(index) === 'completed'">✓</span>
              <span v-else-if="getStepStatus(index) === 'running'" class="loading-spinner"></span>
              <span v-else-if="getStepStatus(index) === 'error'">✗</span>
              <span v-else>{{ index + 1 }}</span>
            </div>
          </div>
          <div class="step-content">
            <div class="step-name">{{ step.name }}</div>
          </div>
          <!-- 连接线（最后一个不显示） -->
          <div v-if="index < steps.length - 1" class="step-line" :class="{ 'line-completed': getStepStatus(index) === 'completed' }"></div>
        </div>
      </div>
    </div>

    <!-- 结果区域 -->
    <div class="result-container">
      <div class="result-header">
        <h3>{{ resultTitle }}</h3>
      </div>
      <div class="result-content">
        <!-- 需要用户选择 -->
        <div v-if="needsInput" class="user-input-section">
          <p class="input-hint">请补充以下信息：</p>
          <div v-for="field in missingFields" :key="field" class="input-field">
            <label>{{ getFieldLabel(field) }}</label>
            <div class="options-group">
              <button
                v-for="option in getFieldOptions(field)"
                :key="option"
                class="option-btn"
                :class="{ selected: selectedOptions[field] === option }"
                @click="selectOption(field, option)"
              >
                {{ getOptionLabel(field, option) }}
              </button>
            </div>
          </div>
          <button
            class="submit-btn"
            :disabled="!canSubmit"
            @click="submitOptions"
          >
            确认并生成计划
          </button>
        </div>

        <!-- 生成的计划结果 -->
        <div v-else-if="result" class="plan-result">
          <div class="result-tabs">
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'training' }"
              @click="activeTab = 'training'"
            >
              训练计划
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'diet' }"
              @click="activeTab = 'diet'"
            >
              饮食计划
            </button>
          </div>

          <!-- 训练计划 -->
          <div v-if="activeTab === 'training'" class="tab-content training-plan">
            <div v-for="(day, dayKey) in result.trainingPlan" :key="dayKey" class="day-card">
              <div class="day-header">
                <span class="day-name">{{ getDayName(dayKey) }}</span>
                <span class="day-focus">{{ day.focus }}</span>
              </div>
              <div class="exercises-list">
                <div v-for="(exercise, idx) in day.exercises" :key="idx" class="exercise-item">
                  <span class="exercise-name">{{ exercise.name }}</span>
                  <span class="exercise-detail">{{ exercise.sets }}组 × {{ exercise.reps }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 饮食计划 -->
          <div v-if="activeTab === 'diet'" class="tab-content diet-plan">
            <div v-for="(meal, mealKey) in result.dietPlan" :key="mealKey" class="meal-card">
              <div class="meal-header">
                <span class="meal-name">{{ getMealName(mealKey) }}</span>
                <span class="meal-calories">{{ meal.calories }} 卡路里</span>
              </div>
              <div class="foods-list">
                <span v-for="(food, idx) in meal.foods" :key="idx" class="food-tag">
                  {{ food }}
                </span>
              </div>
              <div class="macros">
                <span>蛋白质: {{ meal.macros.protein }}g</span>
                <span>碳水: {{ meal.macros.carbs }}g</span>
                <span>脂肪: {{ meal.macros.fat }}g</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 等待状态 -->
        <div v-else class="waiting-state">
          <div class="waiting-icon">🏋️</div>
          <p>等待开始...</p>
          <p class="waiting-hint">发送消息开始生成您的健身计划</p>
        </div>
      </div>
    </div>

    <!-- 日志区域 -->
    <div class="logs-container">
      <div class="logs-header">
        <h3>执行日志</h3>
        <button class="clear-btn" @click="$emit('clearLogs')" v-if="logs.length > 0">
          清空
        </button>
      </div>
      <div class="logs-list" ref="logsContainer">
        <div v-for="(log, index) in logs" :key="index" class="log-item">
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
        <div v-if="logs.length === 0" class="no-logs">
          暂无日志
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';

interface StepInfo {
  id: string;
  name: string;
  index: number;
}

interface LogItem {
  message: string;
  timestamp: string;
}

interface UserInfo {
  gender?: 'male' | 'female';
  ageRange?: '18-25' | '26-35' | '36-45' | '46-55' | '55+';
  trainingGoal?: 'muscle_gain' | 'fat_loss';
}

interface TrainingDay {
  focus: string;
  exercises: Array<{ name: string; sets: number; reps: string; restSeconds: number }>;
}

interface Meal {
  foods: string[];
  calories: number;
  macros: { protein: number; carbs: number; fat: number };
}

interface FitnessResult {
  userInfo: UserInfo;
  trainingPlan: Record<string, TrainingDay>;
  dietPlan: Record<string, Meal>;
}

interface UserInputOptions {
  gender: string[];
  ageRange: string[];
  trainingGoal: string[];
}

interface Props {
  steps: StepInfo[];
  currentStepIndex: number;  // 当前执行的步骤索引（-1 表示未开始）
  isStepRunning: boolean;    // 当前步骤是否正在执行
  logs: LogItem[];
  needsInput: boolean;
  missingFields: string[];
  options: UserInputOptions | null;
  result: FitnessResult | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  submitOptions: [userInfo: UserInfo];
  clearLogs: [];
}>();

const logsContainer = ref<HTMLElement | null>(null);
const activeTab = ref<'training' | 'diet'>('training');
const selectedOptions = ref<Record<string, string>>({});

// 计算结果标题
const resultTitle = computed(() => {
  if (props.needsInput) return '需要补充信息';
  if (props.result) return '生成结果';
  return '执行状态';
});

// 是否可以提交
const canSubmit = computed(() => {
  if (!props.missingFields || props.missingFields.length === 0) return false;
  return props.missingFields.every(field => selectedOptions.value[field]);
});

// 获取步骤状态
function getStepStatus(stepIndex: number): 'pending' | 'running' | 'completed' | 'error' {
  if (stepIndex < props.currentStepIndex) {
    return 'completed';
  }
  if (stepIndex === props.currentStepIndex) {
    return props.isStepRunning ? 'running' : 'completed';
  }
  return 'pending';
}

// 获取步骤样式类
function getStepClass(stepIndex: number) {
  const status = getStepStatus(stepIndex);
  return {
    'step-pending': status === 'pending',
    'step-running': status === 'running',
    'step-completed': status === 'completed',
    'step-error': status === 'error',
  };
}

// 字段标签映射
function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    gender: '性别',
    ageRange: '年龄段',
    trainingGoal: '训练目标',
  };
  return labels[field] || field;
}

// 获取字段选项
function getFieldOptions(field: string): string[] {
  if (!props.options) return [];
  return (props.options as Record<string, string[]>)[field] || [];
}

// 选项标签映射
function getOptionLabel(field: string, option: string): string {
  const labels: Record<string, Record<string, string>> = {
    gender: { male: '男', female: '女' },
    ageRange: {
      '18-25': '18-25岁',
      '26-35': '26-35岁',
      '36-45': '36-45岁',
      '46-55': '46-55岁',
      '55+': '55岁以上',
    },
    trainingGoal: { muscle_gain: '增肌', fat_loss: '减脂' },
  };
  return labels[field]?.[option] || option;
}

// 选择选项
function selectOption(field: string, option: string) {
  selectedOptions.value[field] = option;
}

// 提交选项
function submitOptions() {
  emit('submitOptions', selectedOptions.value as UserInfo);
}

// 日期名称映射
function getDayName(day: string): string {
  const names: Record<string, string> = {
    monday: '周一',
    tuesday: '周二',
    wednesday: '周三',
    thursday: '周四',
    friday: '周五',
  };
  return names[day] || day;
}

// 餐食名称映射
function getMealName(meal: string): string {
  const names: Record<string, string> = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐',
  };
  return names[meal] || meal;
}

// 格式化时间
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// 自动滚动日志到底部
watch(() => props.logs.length, () => {
  nextTick(() => {
    if (logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
    }
  });
});

// 重置选项当 needsInput 变化时
watch(() => props.needsInput, (newVal) => {
  if (newVal) {
    selectedOptions.value = {};
  }
});
</script>

<style scoped>
.fitness-status {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
}

/* 步骤条样式 - 横向布局 */
.steps-container {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.steps-header h3,
.result-header h3,
.logs-header h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.steps-list {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  position: relative;
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.step-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.3s ease;
  z-index: 1;
}

.step-pending .step-icon {
  background: #e5e7eb;
  color: #9ca3af;
}

.step-running .step-icon {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
}

.step-completed .step-icon {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.step-error .step-icon {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}

/* 横向连接线 */
.step-line {
  position: absolute;
  top: 16px;
  left: calc(50% + 16px);
  width: calc(100% - 32px);
  height: 2px;
  background: #e5e7eb;
  z-index: 0;
}

.step-line.line-completed {
  background: #10b981;
}

.step-content {
  text-align: center;
}

.step-name {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 结果区域样式 */
.result-container {
  flex: 1;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.result-content {
  flex: 1;
  overflow-y: auto;
}

/* 用户输入区域 */
.user-input-section {
  padding: 8px 0;
}

.input-hint {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 16px;
}

.input-field {
  margin-bottom: 16px;
}

.input-field label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.options-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.option-btn {
  padding: 8px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
}

.option-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.option-btn.selected {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-color: transparent;
  color: white;
}

.submit-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.submit-btn:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

/* 计划结果 */
.result-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tab-btn {
  flex: 1;
  padding: 10px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-color: transparent;
  color: white;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.day-card, .meal-card {
  background: #f9fafb;
  border-radius: 10px;
  padding: 12px;
}

.day-header, .meal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.day-name, .meal-name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.day-focus {
  font-size: 12px;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.meal-calories {
  font-size: 12px;
  color: #10b981;
  font-weight: 500;
}

.exercises-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.exercise-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 6px 8px;
  background: white;
  border-radius: 6px;
}

.exercise-name {
  color: #374151;
}

.exercise-detail {
  color: #9ca3af;
}

.foods-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.food-tag {
  font-size: 12px;
  padding: 4px 10px;
  background: white;
  border-radius: 12px;
  color: #374151;
}

.macros {
  display: flex;
  gap: 16px;
  font-size: 11px;
  color: #9ca3af;
}

/* 等待状态 */
.waiting-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #9ca3af;
}

.waiting-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.waiting-hint {
  font-size: 12px;
  margin-top: 8px;
}

/* 日志区域 */
.logs-container {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  max-height: 200px;
  display: flex;
  flex-direction: column;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.clear-btn {
  font-size: 12px;
  color: #9ca3af;
  background: none;
  border: none;
  cursor: pointer;
}

.clear-btn:hover {
  color: #6366f1;
}

.logs-list {
  flex: 1;
  overflow-y: auto;
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 11px;
}

.log-item {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid #f3f4f6;
}

.log-time {
  color: #9ca3af;
  white-space: nowrap;
}

.log-message {
  color: #374151;
}

.no-logs {
  color: #9ca3af;
  text-align: center;
  padding: 20px;
  font-size: 12px;
}
</style>
