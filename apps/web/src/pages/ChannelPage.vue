<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useChannelsStore } from '@/stores/channels';
import TextChannelView from '@/components/TextChannelView.vue';
import WordChannelView from '@/components/WordChannelView.vue';
import MemeChannelView from '@/components/MemeChannelView.vue';

const route = useRoute();
const channelsStore = useChannelsStore();

const channel = computed(() => channelsStore.channels.find((c) => c.id === route.params.channelId));
const channelId = computed(() => String(route.params.channelId));
</script>

<template>
  <TextChannelView v-if="channel?.type === 'text'" :channel-id="channelId" class="fill-height" />
  <WordChannelView
    v-else-if="channel?.type === 'word_of_day'"
    :channel-id="channelId"
    class="fill-height"
  />
  <MemeChannelView
    v-else-if="channel?.type === 'memes'"
    :channel-id="channelId"
    class="fill-height"
  />
  <v-container v-else-if="channel" fluid>
    <p class="text-body-2 text-medium-emphasis">
      Salon « {{ channel.name }} » — pas encore de contenu (arrive avec M5).
    </p>
  </v-container>
  <v-container v-else class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col class="text-center text-medium-emphasis">
        <p>Sélectionne un salon dans la barre latérale.</p>
      </v-col>
    </v-row>
  </v-container>
</template>
