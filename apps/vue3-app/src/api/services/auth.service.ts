import apiClient from "../index";

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
}

/**
 * 用户注册
 */
export const register = (payload: RegisterPayload) => {
  return apiClient.post<AuthResponse>("/auth/register", payload);
};

/**
 * 用户登录
 */
export const login = (payload: LoginPayload) => {
  return apiClient.post<AuthResponse>("/auth/login", payload);
};
