<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
const visible = ref(false);

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault();
  deferredPrompt.value = event as BeforeInstallPromptEvent;
  visible.value = true;
}

async function install() {
  if (!deferredPrompt.value) return;
  await deferredPrompt.value.prompt();
  await deferredPrompt.value.userChoice;
  deferredPrompt.value = null;
  visible.value = false;
}

function dismiss() {
  visible.value = false;
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
});

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
});
</script>

<template>
  <div v-if="visible" class="install-prompt" role="status">
    <span>Installer Social sur cet appareil ?</span>
    <button type="button" class="install-prompt__action" @click="install">Installer</button>
    <button type="button" class="install-prompt__dismiss" @click="dismiss">Plus tard</button>
  </div>
</template>

<style scoped>
.install-prompt {
  position: fixed;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 8px;
  background: #1e1e1e;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  font-size: 0.875rem;
  z-index: 100;
}

.install-prompt__action,
.install-prompt__dismiss {
  border: none;
  background: transparent;
  color: #5865f2;
  font-weight: 600;
  cursor: pointer;
}

.install-prompt__dismiss {
  color: rgba(255, 255, 255, 0.6);
  font-weight: 400;
}
</style>
