<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const router = useRouter();

onMounted(() => {
  void authStore.restoreSession();
});

async function onLogout(): Promise<void> {
  await authStore.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" class="text-center">
        <p v-if="authStore.user">
          Connecté·e en tant que <strong>{{ authStore.user.displayName }}</strong> ({{
            authStore.user.nativeLang === 'fr' ? 'Français' : 'Deutsch'
          }})
        </p>
        <p>App protégée — shell façon Discord à venir en M2-T4.</p>
        <v-btn variant="text" @click="onLogout">Se déconnecter</v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>
