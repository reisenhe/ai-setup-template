<template>
  <Teleport to="body">
    <div v-if="visible" class="confirm-overlay" @click.self="handleCancel">
      <div class="confirm-dialog">
        <div class="confirm-header">
          <span class="confirm-icon">🎓</span>
          <h3>老师确认</h3>
        </div>

        <div class="confirm-body">
          <p class="confirm-question">{{ question }}</p>
          <p class="confirm-hint">确认后由对应老师解答；点击"让保安来"将由保安大哥东北方言作答。</p>
        </div>

        <div class="confirm-actions">
          <button class="btn-cancel" @click="handleCancel">让保安来 🧱</button>
          <button class="btn-confirm" @click="handleConfirm">确认，请老师解答</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
  question: string;
  subject: string;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

function handleConfirm() {
  emit('confirm');
}

function handleCancel() {
  emit('cancel');
}
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.confirm-dialog {
  background: #fff;
  border-radius: 20px;
  padding: 32px;
  width: 420px;
  max-width: calc(100vw - 48px);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.15),
    0 4px 16px rgba(99, 102, 241, 0.12);
  animation: slideUp 0.25s ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.confirm-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.confirm-icon {
  font-size: 28px;
  line-height: 1;
}

.confirm-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: -0.3px;
}

.confirm-body {
  margin-bottom: 28px;
}

.confirm-question {
  font-size: 22px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 10px;
  line-height: 1.4;
}

.confirm-hint {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 10px 20px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cancel:hover {
  border-color: #d1d5db;
  background: #f9fafb;
  color: #374151;
}

.btn-confirm {
  padding: 10px 24px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
}

.btn-confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
}

.btn-confirm:active {
  transform: translateY(0);
}
</style>
