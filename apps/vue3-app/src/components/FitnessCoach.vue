<template>
  <div class="fitness-coach-page">
    <!-- 左侧对话区域 -->
    <div class="chat-panel">
      <div class="panel-header">
        <div class="header-title-row">
          <h2>健身计划助手</h2>
          <div class="api-mode-toggle">
            <button
              :class="['toggle-btn', apiMode === 'stream' ? 'active' : '']"
              @click="apiMode = 'stream'"
            >完整</button>
            <button
              :class="['toggle-btn', apiMode === 'lite' ? 'active' : '']"
              @click="apiMode = 'lite'"
            >精简</button>
          </div>
        </div>
        <p class="panel-subtitle">告诉我你的性别、年龄和健身目标</p>
      </div>
      
      <div class="chat-messages" ref="messagesContainer">
        <Message 
          v-for="(message, index) in messages" 
          :key="index"
          :content="message.content"
          :role="message.role"
        />
        <div v-if="isLoading" class="loading-indicator">
          <span>正在处理...</span>
        </div>
      </div>
      
      <div class="chat-input">
        <textarea
          v-model="inputMessage"
          placeholder="例如：我是25岁的男性，想要增肌..."
          @keyup.enter.exact="sendMessage"
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

    <!-- 右侧状态区域 -->
    <div class="status-panel">
      <FitnessStatus
        :steps="steps"
        :currentStepIndex="currentStepIndex"
        :isStepRunning="isStepRunning"
        :logs="logs"
        :needsInput="needsInput"
        :missingFields="missingFields"
        :options="options"
        :result="result"
        @submitOptions="handleSubmitOptions"
        @clearLogs="clearLogs"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import Message from './Message.vue';
import FitnessStatus from './FitnessStatus.vue';
import { MessageRoleEnum } from '../enums/message.enum';
import { createEventStream } from '../controllers/sse.controller';

// 消息接口
interface ChatMessage {
  content: string;
  role: MessageRoleEnum;
}

// 步骤接口
interface StepInfo {
  id: string;
  name: string;
  index: number;
}

// 日志接口
interface LogItem {
  message: string;
  timestamp: string;
}

// 用户信息接口
interface UserInfo {
  gender?: 'male' | 'female';
  ageRange?: '18-25' | '26-35' | '36-45' | '46-55' | '55+';
  trainingGoal?: 'muscle_gain' | 'fat_loss';
}

// 用户输入选项接口
interface UserInputOptions {
  gender: string[];
  ageRange: string[];
  trainingGoal: string[];
}

// 训练日接口
interface TrainingDay {
  focus: string;
  exercises: Array<{ name: string; sets: number; reps: string; restSeconds: number }>;
}

// 餐食接口
interface Meal {
  foods: string[];
  calories: number;
  macros: { protein: number; carbs: number; fat: number };
}

// 结果接口
interface FitnessResult {
  userInfo: UserInfo;
  trainingPlan: Record<string, TrainingDay>;
  dietPlan: Record<string, Meal>;
}

// 状态
const messages = ref<ChatMessage[]>([
  {
    content: '你好！我是你的健身计划助手。请告诉我你的**性别**、**年龄段**和**训练目标**（增肌还是减脂），我会为你生成个性化的训练和饮食计划。\n\n例如：我是28岁的男性，想要增肌。',
    role: MessageRoleEnum.ASSISTANT,
  },
]);

const inputMessage = ref('');
const isLoading = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);

// 步骤状态（默认显示四个步骤，会根据意图动态更新）
const steps = ref<StepInfo[]>([
  { id: 'checkUserInfo', name: '分析用户意图', index: 0 },
  { id: 'generateTrainingPlan', name: '生成/调整训练计划', index: 1 },
  { id: 'generateDietPlan', name: '生成/调整饮食计划', index: 2 },
  { id: 'combineResults', name: '合并结果', index: 3 },
]);

// 当前执行的步骤索引（-1 表示未开始，等于 totalSteps 表示全部完成）
const currentStepIndex = ref(-1);
// 当前步骤是否正在执行（用于区分 running 和 completed）
const isStepRunning = ref(false);
// 总步骤数
const totalSteps = ref(0);

// 日志
const logs = ref<LogItem[]>([]);

// 需要输入状态
const needsInput = ref(false);
const missingFields = ref<string[]>([]);
const options = ref<UserInputOptions | null>(null);
const currentUserInfo = ref<UserInfo>({});

// 结果
const result = ref<FitnessResult | null>(null);

// 会话线程 ID - 用于维护 HITL 模式下的会话记忆
const threadId = ref<string>(`fitness-${Date.now()}`);

// API 模式：stream（完整版，含日志）/ lite（精简版，只含关键事件）
const apiMode = ref<'stream' | 'lite'>('stream');

// 当前 API 地址
const apiUrl = () => apiMode.value === 'lite' ? '/api/fitness-coach/lite' : '/api/fitness-coach/stream';

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

// 重置步骤状态
function resetSteps() {
  currentStepIndex.value = -1;
  isStepRunning.value = false;
}

// 清空日志
function clearLogs() {
  logs.value = [];
}

// 所有可能的步骤定义
const ALL_STEPS: Record<string, StepInfo> = {
  checkUserInfo: { id: 'checkUserInfo', name: '分析用户意图', index: 0 },
  generateTrainingPlan: { id: 'generateTrainingPlan', name: '生成/调整训练计划', index: 1 },
  generateDietPlan: { id: 'generateDietPlan', name: '生成/调整饮食计划', index: 1 },  // 索引会动态调整
  combineResults: { id: 'combineResults', name: '合并结果', index: 3 },
};

// 根据总步骤数更新显示的步骤
function updateStepsForIntent(totalSteps: number) {
  switch (totalSteps) {
    case 1:
      // collect_info: 只有 checkUserInfo
      steps.value = [{ ...ALL_STEPS.checkUserInfo, index: 0 }];
      break;
    case 2:
      // adjust_training 或 adjust_diet: checkUserInfo + 一个计划节点
      // 我们无法确定是哪个，所以保持当前步骤
      break;
    case 4:
    default:
      // generate_both 或 adjust_both: 完整流程
      steps.value = [
        { ...ALL_STEPS.checkUserInfo, index: 0 },
        { ...ALL_STEPS.generateTrainingPlan, index: 1 },
        { ...ALL_STEPS.generateDietPlan, index: 2 },
        { ...ALL_STEPS.combineResults, index: 3 },
      ];
      break;
  }
}

// 发送消息
function sendMessage() {
  const message = inputMessage.value.trim();
  if (!message || isLoading.value) return;

  // 重置步骤状态（但保留已有结果）
  resetSteps();
  needsInput.value = false;
  // 不重置 result，保留已有的训练/饮食计划

  // 添加用户消息
  messages.value.push({
    content: message,
    role: MessageRoleEnum.USER,
  });

  inputMessage.value = '';
  isLoading.value = true;
  scrollToBottom();

  // 调用后端 API
  callFitnessCoachAPI(message);
}

// 处理用户选择选项后提交
function handleSubmitOptions(selectedOptions: UserInfo) {
  // 合并用户信息
  currentUserInfo.value = { ...currentUserInfo.value, ...selectedOptions };
  
  // 重置步骤状态（但保留已有结果）
  resetSteps();
  needsInput.value = false;
  // 不重置 result，保留已有的训练/饮食计划
  isLoading.value = true;

  // 添加确认消息
  const optionLabels: Record<string, Record<string, string>> = {
    gender: { male: '男性', female: '女性' },
    ageRange: {
      '18-25': '18-25岁',
      '26-35': '26-35岁',
      '36-45': '36-45岁',
      '46-55': '46-55岁',
      '55+': '55岁以上',
    },
    trainingGoal: { muscle_gain: '增肌', fat_loss: '减脂' },
  };

  const confirmMessage = Object.entries(selectedOptions)
    .map(([key, value]) => `${optionLabels[key]?.[value as string] || value}`)
    .join('、');

  messages.value.push({
    content: `已选择: ${confirmMessage}`,
    role: MessageRoleEnum.USER,
  });
  scrollToBottom();

  // 使用同一个 threadId 继续调用 API
  // LangGraph 的 checkpoint 会自动恢复之前的状态并合并新的用户输入
  callFitnessCoachAPI('', currentUserInfo.value);
}

// 调用健身教练 API
function callFitnessCoachAPI(message: string, userInfo?: UserInfo) {
  const aiMessageIndex = messages.value.length;
  messages.value.push({
    content: '',
    role: MessageRoleEnum.ASSISTANT,
  });

  createEventStream(
    apiUrl(),
    { message, threadId: threadId.value, userInfo },
    {
      onopen: async (response) => {
        if (!response.ok) {
          console.error('连接失败:', response.status);
          messages.value[aiMessageIndex].content = '连接失败，请重试';
          isLoading.value = false;
        }
      },
      onmessage: (msg) => {
        try {
          const data = JSON.parse(msg.data);

          switch (data.type) {
            case 'init':
              // 初始化节点列表
              if (data.nodes) {
                steps.value = data.nodes;
                totalSteps.value = data.totalSteps || data.nodes.length;
              }
              currentStepIndex.value = -1;
              isStepRunning.value = false;
              break;

            case 'node_start':
              // 节点开始执行
              currentStepIndex.value = data.nodeIndex;
              isStepRunning.value = true;
              break;

            case 'node_end':
              // 节点执行完成
              currentStepIndex.value = data.nodeIndex;
              isStepRunning.value = false;
              // 更新总步骤数（如果有变化）
              if (data.totalSteps) {
                totalSteps.value = data.totalSteps;
              }
              break;

            case 'intent_update':
              // 意图更新，步骤数可能变化
              if (data.totalSteps) {
                totalSteps.value = data.totalSteps;
                // 根据新的步骤数动态更新显示的步骤
                updateStepsForIntent(data.totalSteps);
              }
              break;

            case 'log':
              // 添加日志
              logs.value.push({
                message: data.message,
                timestamp: data.timestamp,
              });
              break;

            case 'needs_input':
              // 需要用户输入
              needsInput.value = true;
              missingFields.value = data.missingFields || [];
              options.value = data.options || null;
              currentUserInfo.value = data.userInfo || {};
              messages.value[aiMessageIndex].content = '请在右侧面板中补充缺少的信息，然后点击确认生成计划。';
              isLoading.value = false;
              break;

            case 'result':
              // 收到结果 - 合并已有结果，只更新有新值的字段
              result.value = {
                userInfo: data.userInfo || result.value?.userInfo || {},
                trainingPlan: data.trainingPlan || result.value?.trainingPlan || {},
                dietPlan: data.dietPlan || result.value?.dietPlan || {},
              };
              messages.value[aiMessageIndex].content = '健身计划更新完成！请在右侧面板查看详细的训练和饮食计划。';
              break;

            case 'error':
              messages.value[aiMessageIndex].content = `错误: ${data.message}`;
              isLoading.value = false;
              break;

            case 'end':
              isLoading.value = false;
              scrollToBottom();
              break;
          }
        } catch (error) {
          console.error('解析消息失败:', error);
        }
      },
      onclose: () => {
        isLoading.value = false;
      },
      onerror: (err) => {
        console.error('SSE 错误:', err);
        if (!messages.value[aiMessageIndex].content) {
          messages.value[aiMessageIndex].content = '连接出错，请重试';
        }
        isLoading.value = false;
      },
    }
  );
}
</script>

<style scoped>
.fitness-coach-page {
  display: flex;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  padding: 24px;
  gap: 24px;
  box-sizing: border-box;
}

/* 左侧对话面板 */
.chat-panel {
  display: flex;
  flex-direction: column;
  max-width: 400px;
}

.panel-header {
  margin-bottom: 16px;
}

.header-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.api-mode-toggle {
  display: flex;
  background: #f0f0f5;
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.toggle-btn {
  padding: 4px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  color: #6b7280;
  background: transparent;
  transition: all 0.2s ease;
}

.toggle-btn.active {
  background: #ffffff;
  color: #6366f1;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.panel-header h2 {
  font-size: 22px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.panel-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 4px 0 0 0;
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
  border-radius: 14px;
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.04);
}

.chat-input textarea {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e8e8e8;
  border-radius: 10px;
  resize: none;
  height: 60px;
  font-size: 14px;
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

.chat-input button {
  padding: 0 24px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.25s ease;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
}

.chat-input button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
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
  padding: 10px 14px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 10px;
  color: #92400e;
  font-size: 13px;
  font-weight: 500;
}

/* 右侧状态面板 */
.status-panel {
  flex: 1;
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}
</style>
