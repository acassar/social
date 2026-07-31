<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ChannelType } from '@social/shared';
import { useAuthStore } from '@/stores/auth';
import { useChannelsStore } from '@/stores/channels';
import { useRealtimeStore } from '@/stores/realtime';

const CHANNEL_ICONS: Record<ChannelType, string> = {
  text: 'mdi-pound',
  word_of_day: 'mdi-book-alphabet',
  memes: 'mdi-image-multiple',
};

const authStore = useAuthStore();
const channelsStore = useChannelsStore();
const realtimeStore = useRealtimeStore();
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

    <template #append>
      <div class="pa-2">
        <p v-if="authStore.user" class="text-body-2 mb-2">{{ authStore.user.displayName }}</p>
        <v-btn variant="text" size="small" block @click="onLogout">Se déconnecter</v-btn>
      </div>
    </template>
  </v-navigation-drawer>

  <v-app-bar flat density="comfortable">
    <v-toolbar-title>{{ currentChannel?.name ?? 'Sélectionne un salon' }}</v-toolbar-title>
  </v-app-bar>

  <v-main>
    <router-view />
  </v-main>
</template>
