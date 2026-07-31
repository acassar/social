<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const displayName = ref('');
const password = ref('');
const submitting = ref(false);
const errorMessage = ref<string | null>(null);

const authStore = useAuthStore();
const router = useRouter();

async function onSubmit(): Promise<void> {
  errorMessage.value = null;
  submitting.value = true;
  try {
    await authStore.login({ displayName: displayName.value, password: password.value });
    await router.push({ name: 'app' });
  } catch {
    errorMessage.value = 'Pseudo ou mot de passe incorrect.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <v-main>
    <v-container class="fill-height" fluid>
      <v-row align="center" justify="center">
        <v-col cols="12" sm="8" md="4">
          <v-card>
            <v-card-title>Se connecter</v-card-title>
            <v-card-text>
              <v-form @submit.prevent="onSubmit">
                <v-text-field
                  v-model="displayName"
                  label="Pseudo"
                  autocomplete="username"
                  required
                />
                <v-text-field
                  v-model="password"
                  label="Mot de passe"
                  type="password"
                  autocomplete="current-password"
                  required
                />
                <v-alert v-if="errorMessage" type="error" density="compact" class="mb-4">
                  {{ errorMessage }}
                </v-alert>
                <v-btn type="submit" color="primary" block :loading="submitting">
                  Se connecter
                </v-btn>
              </v-form>
              <div class="text-center mt-4">
                <router-link to="/join">Pas encore de compte ? Rejoindre avec un code</router-link>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </v-main>
</template>
