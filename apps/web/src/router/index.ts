import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { isAuthenticated } from '@/lib/auth';

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
  },
  {
    path: '/join',
    name: 'join',
    component: () => import('@/pages/JoinPage.vue'),
  },
  {
    path: '/app',
    component: () => import('@/pages/AppShellPage.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'app', component: () => import('@/pages/ChannelPage.vue') },
      {
        path: 'channels/:channelId',
        name: 'channel',
        component: () => import('@/pages/ChannelPage.vue'),
      },
    ],
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
