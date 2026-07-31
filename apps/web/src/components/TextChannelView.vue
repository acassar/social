<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { usePostsStore } from '@/stores/posts';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{ channelId: string }>();

const postsStore = usePostsStore();
const authStore = useAuthStore();

const draft = ref('');
const listEl = ref<HTMLElement | null>(null);

// Réactions rapides (M3-T3) : pas de sélecteur d'emoji, un jeu fixe suffit
// pour ce socle. Une palette libre viendra si le besoin se confirme à l'usage.
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉'];

async function scrollToBottom(): Promise<void> {
  await nextTick();
  if (listEl.value) {
    listEl.value.scrollTop = listEl.value.scrollHeight;
  }
}

watch(
  () => props.channelId,
  async (channelId) => {
    await postsStore.loadChannel(channelId);
    await scrollToBottom();
  },
  { immediate: true },
);

watch(
  () => postsStore.posts.length,
  () => {
    void scrollToBottom();
  },
);

// Pas d'annuaire des membres côté API pour l'instant (hors périmètre M3-T3,
// voir doc/BACKLOG.md « Backlog différé ») : on ne peut afficher que « Toi »
// ou un identifiant court pour les autres auteurs.
function authorLabel(authorId: string): string {
  return authorId === authStore.user?.id ? 'Toi' : `Membre ${authorId.slice(0, 4)}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const postsWithReactions = computed(() =>
  postsStore.posts.map((post) => ({
    post,
    reactions: QUICK_REACTIONS.map((emoji) => {
      const forEmoji = (postsStore.reactionsByPost[post.id] ?? []).filter(
        (reaction) => reaction.emoji === emoji,
      );
      return {
        emoji,
        count: forEmoji.length,
        reactedByMe: forEmoji.some((reaction) => reaction.userId === authStore.user?.id),
      };
    }),
  })),
);

async function onSend(): Promise<void> {
  const body = draft.value;
  if (!body.trim()) {
    return;
  }
  draft.value = '';
  try {
    await postsStore.sendMessage(body);
  } catch {
    draft.value = body;
  }
}

function onToggleReaction(postId: string, emoji: string): void {
  void postsStore.toggleReaction(postId, emoji);
}
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <div ref="listEl" class="flex-grow-1 overflow-y-auto pa-4">
      <div v-if="postsStore.nextCursor" class="text-center mb-4">
        <v-btn
          size="small"
          variant="text"
          :loading="postsStore.loadingMore"
          @click="postsStore.loadMore()"
        >
          Charger plus d'historique
        </v-btn>
      </div>

      <p v-if="postsStore.loading" class="text-medium-emphasis text-center">
        Chargement des messages…
      </p>
      <p v-else-if="!postsStore.posts.length" class="text-medium-emphasis text-center">
        Aucun message pour l'instant — sois le·la premier·ère à écrire.
      </p>

      <div v-for="entry in postsWithReactions" :key="entry.post.id" class="mb-4">
        <div class="d-flex align-baseline ga-2">
          <span class="font-weight-medium">{{ authorLabel(entry.post.authorId) }}</span>
          <span class="text-caption text-medium-emphasis">{{ formatTime(entry.post.createdAt) }}</span>
        </div>
        <p class="mb-1" style="white-space: pre-wrap">{{ entry.post.body }}</p>
        <div class="d-flex ga-1 flex-wrap">
          <v-chip
            v-for="reaction in entry.reactions"
            :key="reaction.emoji"
            size="small"
            :variant="reaction.reactedByMe ? 'flat' : 'outlined'"
            :color="reaction.reactedByMe ? 'primary' : undefined"
            @click="onToggleReaction(entry.post.id, reaction.emoji)"
          >
            {{ reaction.emoji }}
            <span v-if="reaction.count" class="ml-1">{{ reaction.count }}</span>
          </v-chip>
        </div>
      </div>
    </div>

    <v-divider />

    <form class="d-flex ga-2 pa-3" @submit.prevent="onSend">
      <v-text-field
        v-model="draft"
        density="comfortable"
        variant="outlined"
        placeholder="Écrire un message…"
        hide-details
        autofocus
        @keydown.enter.exact.prevent="onSend"
      />
      <v-btn type="submit" color="primary" :disabled="!draft.trim()">Envoyer</v-btn>
    </form>
  </div>
</template>
