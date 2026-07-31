<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { NativeLang } from '@social/shared';
import { isWordEntryPost, usePostsStore } from '@/stores/posts';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{ channelId: string }>();

const postsStore = usePostsStore();
const authStore = useAuthStore();

// Réactions rapides (mêmes emojis que le salon texte, voir TextChannelView.vue).
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉'];

const LANG_LABEL: Record<NativeLang, string> = { fr: 'FR', de: 'DE' };

const term = ref('');
const translation = ref('');
const note = ref('');
// Un mot se poste « dans sa langue » (voir doc/SPEC.md §5) : on pré-remplit
// avec la langue native de l'auteur, modifiable au besoin (rien n'empêche de
// documenter un mot dans l'autre langue).
const lang = ref<NativeLang>(authStore.user?.nativeLang ?? 'fr');

watch(
  () => props.channelId,
  async (channelId) => {
    await postsStore.loadChannel(channelId);
  },
  { immediate: true },
);

function authorLabel(authorId: string): string {
  return authorId === authStore.user?.id ? 'Toi' : `Membre ${authorId.slice(0, 4)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const wordsWithReactions = computed(() =>
  postsStore.posts
    .filter(isWordEntryPost)
    .map((post) => ({
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
    }))
    .reverse(),
);

async function onSubmit(): Promise<void> {
  const payload = {
    term: term.value.trim(),
    lang: lang.value,
    translation: translation.value.trim(),
    note: note.value.trim() || undefined,
  };
  if (!payload.term || !payload.translation) {
    return;
  }
  await postsStore.postWord(payload);
  term.value = '';
  translation.value = '';
  note.value = '';
}

function onToggleReaction(postId: string, emoji: string): void {
  void postsStore.toggleReaction(postId, emoji);
}
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <div class="flex-grow-1 overflow-y-auto pa-4">
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
        Chargement des mots…
      </p>
      <p v-else-if="!wordsWithReactions.length" class="text-medium-emphasis text-center">
        Aucun mot posté pour l'instant — propose le premier.
      </p>

      <v-row>
        <v-col v-for="entry in wordsWithReactions" :key="entry.post.id" cols="12" sm="6" md="4">
          <v-card variant="outlined">
            <v-card-item>
              <template #prepend>
                <v-chip size="small" variant="flat">{{ LANG_LABEL[entry.post.lang] }}</v-chip>
              </template>
              <v-card-title class="text-h6">{{ entry.post.term }}</v-card-title>
              <v-card-subtitle>{{ entry.post.translation }}</v-card-subtitle>
            </v-card-item>
            <v-card-text v-if="entry.post.note">{{ entry.post.note }}</v-card-text>
            <v-card-text class="d-flex ga-1 flex-wrap">
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
            </v-card-text>
            <v-card-text class="text-caption text-medium-emphasis pt-0">
              {{ authorLabel(entry.post.authorId) }} · {{ formatDate(entry.post.createdAt) }}
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <v-divider />

    <form class="d-flex flex-column ga-2 pa-3" @submit.prevent="onSubmit">
      <div class="d-flex ga-2">
        <v-btn-toggle v-model="lang" mandatory density="comfortable" color="primary">
          <v-btn value="fr" size="small">FR</v-btn>
          <v-btn value="de" size="small">DE</v-btn>
        </v-btn-toggle>
        <v-text-field
          v-model="term"
          density="comfortable"
          variant="outlined"
          placeholder="Le mot"
          hide-details
        />
        <v-text-field
          v-model="translation"
          density="comfortable"
          variant="outlined"
          placeholder="Traduction"
          hide-details
        />
      </div>
      <v-text-field
        v-model="note"
        density="comfortable"
        variant="outlined"
        placeholder="Note (contexte, anecdote…) — optionnel"
        hide-details
      />
      <v-btn type="submit" color="primary" :disabled="!term.trim() || !translation.trim()">
        Ajouter le mot
      </v-btn>
    </form>
  </div>
</template>
