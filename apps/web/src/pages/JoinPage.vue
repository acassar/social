<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { NativeLang } from '@social/shared';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const codeFromQuery = route.query.code;
const inviteCode = ref(typeof codeFromQuery === 'string' ? codeFromQuery : '');
const displayName = ref('');
const nativeLang = ref<NativeLang>('fr');
const password = ref('');
const submitting = ref(false);
const errorMessage = ref<string | null>(null);

const langOptions: Array<{ title: string; value: NativeLang }> = [
  { title: 'Français', value: 'fr' },
  { title: 'Deutsch', value: 'de' },
];

async function onSubmit(): Promise<void> {
  errorMessage.value = null;
  submitting.value = true;
  try {
    await authStore.join({
      inviteCode: inviteCode.value,
      displayName: displayName.value,
      nativeLang: nativeLang.value,
      password: password.value,
    });
    await router.push({ name: 'app' });
  } catch {
    errorMessage.value = "Code d'invitation invalide, expiré, ou pseudo déjà pris.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card>
          <v-card-title>Rejoindre avec un code</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="onSubmit">
              <v-text-field v-model="inviteCode" label="Code d'invitation" required />
              <v-text-field v-model="displayName" label="Pseudo" autocomplete="username" required />
              <v-select v-model="nativeLang" :items="langOptions" label="Langue" />
              <v-text-field
                v-model="password"
                label="Mot de passe"
                type="password"
                autocomplete="new-password"
                required
              />
              <v-alert v-if="errorMessage" type="error" density="compact" class="mb-4">
                {{ errorMessage }}
              </v-alert>
              <v-btn type="submit" color="primary" block :loading="submitting"> Rejoindre </v-btn>
            </v-form>
            <div class="text-center mt-4">
              <router-link to="/login">Déjà un compte ? Se connecter</router-link>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
