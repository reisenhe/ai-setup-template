import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useRouter } from "vue-router";

/** 获取 token 并检查是否有效 */
function getAuthToken(): string | null {
  return localStorage.getItem("token");
}

/** 处理 401 未授权，清除 token 并跳转登录 */
function handleUnauthorized() {
  localStorage.removeItem("token");
  // 直接跳转，避免循环依赖
  window.location.href = "/login";
}

/** 创建消息流 */
export function createEventStream<T = any>(
  url: string,
  params: T,
  callbacks: {
    onopen?: (response: Response) => Promise<void>;
    onmessage?: (msg: any) => void;
    onclose?: () => void;
    onerror?: (err: any) => void;
  },
) {
  const controller = new AbortController();
  const token = getAuthToken();

  fetchEventSource(url, {
    signal: controller.signal, // 支持中断对话流程
    method: "POST", // 支持结构化数据传输
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, // 必需设置JSON格式
    openWhenHidden: true, // 保持后台标签页连接
    body: JSON.stringify(params), // 参数序列化
    // 流式通信生命周期钩子
    async onopen(response) {
      // 检查是否为 401 未授权
      if (response.status === 401) {
        handleUnauthorized();
        controller.abort();
        return;
      }
      if (callbacks.onopen) {
        await callbacks.onopen(response);
      }
    },
    onmessage(msg) {
      if (callbacks.onmessage) {
        callbacks.onmessage(msg);
      }
    },
    onclose() {
      if (callbacks.onclose) {
        callbacks.onclose();
      }
    },
    onerror(err) {
      if (callbacks.onerror) {
        callbacks.onerror(err);
      }
    },
  });

  return controller;
}
