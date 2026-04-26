import axios from "axios";
import type { AxiosRequestConfig, AxiosResponse } from "axios";

// 扩展 axios 类型，使拦截器返回 data 而非完整 response
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  message?: string;
}

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: "/api", // 使用 vite 代理
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器 - 自动携带 token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 响应拦截器 - 处理 401 错误
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      // token 过期或无效，清除 token
      localStorage.removeItem("token");
      // 如果不在登录页，才跳转到登录页（避免刷新页面）
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error.response?.data || error);
  },
);

export default apiClient;
