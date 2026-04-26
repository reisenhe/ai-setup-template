<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { register, login } from "../api/services/auth.service";

const router = useRouter();
const email = ref("");
const password = ref("");
const isRegister = ref(false);
const error = ref("");
const loading = ref(false);

async function handleSubmit() {
  if (!email.value || !password.value) {
    error.value = "请填写所有字段";
    return;
  }

  if (!isRegister.value && !email.value.includes("@")) {
    error.value = "请输入有效的邮箱地址";
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    const payload = {
      email: email.value,
      username: isRegister.value ? email.value.split("@")[0] : "",
      password: password.value,
    };

    const response: any = isRegister.value
      ? await register(payload)
      : await login({ email: email.value, password: password.value });

    localStorage.setItem("token", response.access_token);
    router.push("/");
  } catch (err: any) {
    error.value = err.message || err.error || "操作失败，请重试";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">{{ isRegister ? "创建账号" : "欢迎回来" }}</h1>

      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="form-group">
          <label for="email">邮箱</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="your@email.com"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="请输入密码"
            required
          />
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>

        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? "处理中..." : isRegister ? "注册" : "登录" }}
        </button>
      </form>

      <div class="toggle-mode">
        <span>
          {{ isRegister ? "已有账号？" : "还没有账号？" }}
        </span>
        <a href="#" @click.prevent="isRegister = !isRegister">
          {{ isRegister ? "立即登录" : "立即注册" }}
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
}

.login-title {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
  font-size: 28px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  color: #555;
  font-weight: 500;
  font-size: 14px;
}

.form-group input {
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.error-message {
  color: #e74c3c;
  background: #fee;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
}

.submit-btn {
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s,
    opacity 0.2s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-mode {
  text-align: center;
  margin-top: 20px;
  color: #666;
  font-size: 14px;
}

.toggle-mode a {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
  margin-left: 5px;
}

.toggle-mode a:hover {
  text-decoration: underline;
}
</style>
