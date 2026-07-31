<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { UploadResultDto } from '@social/shared';
import { ALLOWED_UPLOAD_MIME_TYPES } from '@social/shared';
import { isMemePost, usePostsStore } from '@/stores/posts';
import { useAuthStore } from '@/stores/auth';
import { http } from '@/lib/http';

const props = defineProps<{ channelId: string }>();

const postsStore = usePostsStore();
const authStore = useAuthStore();

// Réactions rapides (mêmes emojis que les autres salons, voir TextChannelView.vue).
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉'];

const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const caption = ref('');
const uploading = ref(false);
const uploadError = ref<string | null>(null);
const lightboxPostId = ref<string | null>(null);

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
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Les URLs renvoyées par l'API (`/uploads/…`) sont relatives au serveur qui
// les sert (M5-T1) — pas forcément le même origin que le front en dev.
function assetUrl(path: string): string {
  return `${http.baseUrl}${path}`;
}

const memesWithReactions = computed(() =>
  postsStore.posts
    .filter(isMemePost)
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

const lightboxEntry = computed(() =>
  memesWithReactions.value.find((entry) => entry.post.id === lightboxPostId.value),
);

function onFileSelected(files: File[] | File | null): void {
  const file = Array.isArray(files) ? (files[0] ?? null) : files;
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
  selectedFile.value = file;
  previewUrl.value = file ? URL.createObjectURL(file) : null;
  uploadError.value = null;
}

function resetForm(): void {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
  selectedFile.value = null;
  previewUrl.value = null;
  caption.value = '';
}

async function onSubmit(): Promise<void> {
  const file = selectedFile.value;
  if (!file || uploading.value) {
    return;
  }
  uploading.value = true;
  uploadError.value = null;
  try {
    const formData = new FormData();
    formData.append('file', file);
    const uploaded = await http.upload<UploadResultDto>('/uploads', formData);
    await postsStore.postMeme({
      url: uploaded.url,
      thumbUrl: uploaded.thumbUrl ?? undefined,
      mime: uploaded.mime,
      width: uploaded.width ?? undefined,
      height: uploaded.height ?? undefined,
      caption: caption.value.trim() || undefined,
    });
    resetForm();
  } catch {
    uploadError.value = "Impossible d'envoyer le mème.";
  } finally {
    uploading.value = false;
  }
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
        Chargement des mèmes…
      </p>
      <p v-else-if="!memesWithReactions.length" class="text-medium-emphasis text-center">
        Aucun mème posté pour l'instant — envoie le premier.
      </p>

      <v-row>
        <v-col
          v-for="entry in memesWithReactions"
          :key="entry.post.id"
          cols="6"
          sm="4"
          md="3"
        >
          <v-card variant="outlined" @click="lightboxPostId = entry.post.id">
            <v-img
              :src="assetUrl(entry.post.attachment.thumbUrl ?? entry.post.attachment.url)"
              :alt="entry.post.caption ?? 'Mème'"
              aspect-ratio="1"
              cover
            />
            <v-card-text v-if="entry.post.caption" class="text-truncate">
              {{ entry.post.caption }}
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <v-divider />

    <form class="d-flex flex-column ga-2 pa-3" @submit.prevent="onSubmit">
      <v-img
        v-if="previewUrl"
        :src="previewUrl"
        max-height="160"
        max-width="160"
        class="rounded"
        contain
      />
      <div class="d-flex ga-2">
        <v-file-input
          :accept="ALLOWED_UPLOAD_MIME_TYPES.join(',')"
          label="Choisir une image ou un gif"
          density="comfortable"
          variant="outlined"
          prepend-icon=""
          hide-details
          @update:model-value="onFileSelected"
        />
        <v-text-field
          v-model="caption"
          density="comfortable"
          variant="outlined"
          placeholder="Légende (optionnel)"
          hide-details
        />
      </div>
      <p v-if="uploadError" class="text-error text-caption mb-0">{{ uploadError }}</p>
      <v-btn type="submit" color="primary" :loading="uploading" :disabled="!selectedFile">
        Envoyer le mème
      </v-btn>
    </form>

    <v-dialog
      :model-value="!!lightboxEntry"
      max-width="800"
      @update:model-value="(open) => { if (!open) lightboxPostId = null; }"
    >
      <v-card v-if="lightboxEntry">
        <v-img :src="assetUrl(lightboxEntry.post.attachment.url)" max-height="80vh" contain />
        <v-card-text v-if="lightboxEntry.post.caption">{{ lightboxEntry.post.caption }}</v-card-text>
        <v-card-text class="d-flex ga-1 flex-wrap">
          <v-chip
            v-for="reaction in lightboxEntry.reactions"
            :key="reaction.emoji"
            size="small"
            :variant="reaction.reactedByMe ? 'flat' : 'outlined'"
            :color="reaction.reactedByMe ? 'primary' : undefined"
            @click="onToggleReaction(lightboxEntry.post.id, reaction.emoji)"
          >
            {{ reaction.emoji }}
            <span v-if="reaction.count" class="ml-1">{{ reaction.count }}</span>
          </v-chip>
        </v-card-text>
        <v-card-text class="text-caption text-medium-emphasis pt-0">
          {{ authorLabel(lightboxEntry.post.authorId) }} · {{ formatDate(lightboxEntry.post.createdAt) }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="lightboxPostId = null">Fermer</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
