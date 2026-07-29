import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { isAuthenticated } from '@/lib/auth';

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
  },
  {
    path: '/app',
    name: 'app',
    component: () => import('@/pages/AppHome.vue'),
    meta: { requiresAuth: true },
  },
  { path: '/', redirect: '/login' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    return { name: 'login' };
  }
  return true;
});
