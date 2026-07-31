<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ChannelType } from '@social/shared';
import { useAuthStore } from '@/stores/auth';
import { useChannelsStore } from '@/stores/channels';
import { useNotificationsStore } from '@/stores/notifications';
import { useRealtimeStore } from '@/stores/realtime';

const CHANNEL_ICONS: Record<ChannelType, string> = {
  text: 'mdi-pound',
  word_of_day: 'mdi-book-alphabet',
  memes: 'mdi-image-multiple',
};

const authStore = useAuthStore();
const channelsStore = useChannelsStore();
const realtimeStore = useRealtimeStore();
const notificationsStore = useNotificationsStore();
const route = useRoute();
const router = useRouter();

onMounted(async () => {
  await authStore.restoreSession();
  if (authStore.user) {
    await channelsStore.fetchChannels(authStore.user.groupId);
  }
  realtimeStore.connect();
});

onUnmounted(() => {
  realtimeStore.disconnect();
});

const currentChannel = computed(() =>
  channelsStore.channels.find((channel) => channel.id === route.params.channelId),
);

const pageTitle = computed(() => {
  if (route.name === 'glossary') {
    return 'Glossaire';
  }
  return currentChannel.value?.name ?? 'Sélectionne un salon';
});

// Charge la préférence de notifications du salon affiché à chaque
// changement (M6-T2) ; pas de préchargement pour tous les salons, un
// toggle par salon visité suffit (voir doc/BACKLOG.md).
watch(
  () => currentChannel.value?.id,
  (channelId) => {
    if (channelId) {
      void notificationsStore.fetchPreference(channelId);
    }
  },
  { immediate: true },
);

async function onToggleNotifications(): Promise<void> {
  const channelId = currentChannel.value?.id;
  if (!channelId) {
    return;
  }
  if (notificationsStore.isEnabled(channelId)) {
    await notificationsStore.disable(channelId);
  } else {
    await notificationsStore.enable(channelId);
  }
}

async function onLogout(): Promise<void> {
  realtimeStore.disconnect();
  await authStore.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <v-navigation-drawer permanent width="260">
    <v-list-subheader>Salons</v-list-subheader>
    <v-list nav density="compact">
      <v-list-item
        v-for="channel in channelsStore.sortedChannels"
        :key="channel.id"
        :to="{ name: 'channel', params: { channelId: channel.id } }"
        :title="channel.name"
        :prepend-icon="CHANNEL_ICONS[channel.type]"
      />
    </v-list>

    <v-divider />
    <v-list nav density="compact">
      <v-list-item
        :to="{ name: 'glossary' }"
        title="Glossaire"
        prepend-icon="mdi-book-open-variant"
      />
    </v-list>

    <template #append>
      <div class="pa-2">
        <p v-if="authStore.user" class="text-body-2 mb-2">{{ authStore.user.displayName }}</p>
        <v-btn variant="text" size="small" block @click="onLogout">Se déconnecter</v-btn>
      </div>
    </template>
  </v-navigation-drawer>

  <v-app-bar flat density="comfortable">
    <v-toolbar-title>{{ pageTitle }}</v-toolbar-title>
    <v-btn
      v-if="currentChannel && notificationsStore.supported"
      :icon="notificationsStore.isEnabled(currentChannel.id) ? 'mdi-bell' : 'mdi-bell-off-outline'"
      :title="
        notificationsStore.isEnabled(currentChannel.id)
          ? 'Désactiver les notifications de ce salon'
          : 'Activer les notifications de ce salon'
      "
      variant="text"
      @click="onToggleNotifications"
    />
  </v-app-bar>

  <v-main>
    <router-view />
  </v-main>
</template>
