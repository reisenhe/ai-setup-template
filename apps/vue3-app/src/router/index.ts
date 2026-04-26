import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/LoginView.vue"),
    meta: { public: true },
  },
  {
    path: "/",
    name: "Chat",
    component: () => import("../views/ChatView.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 全局前置守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("token");
  const isPublic = to.meta.public;

  // 如果路由是公开的（如登录页），直接放行
  if (isPublic) {
    // 已登录用户访问登录页，重定向到首页
    if (token && to.path === "/login") {
      next("/");
    } else {
      next();
    }
    return;
  }

  // 非公开路由，检查 token
  if (!token) {
    next("/login");
  } else {
    next();
  }
});

export default router;
