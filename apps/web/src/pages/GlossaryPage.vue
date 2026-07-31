<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { NativeLang } from '@social/shared';
import { useAuthStore } from '@/stores/auth';
import { useGlossaryStore } from '@/stores/glossary';

const LANG_LABEL: Record<NativeLang, string> = { fr: 'FR', de: 'DE' };

const authStore = useAuthStore();
const glossaryStore = useGlossaryStore();

const searchInput = ref('');
const langFilter = ref<NativeLang | null>(null);

function runSearch(): void {
  const groupId = authStore.user?.groupId;
  if (!groupId) {
    return;
  }
  void glossaryStore.search(groupId, { lang: langFilter.value, search: searchInput.value });
}

onMounted(runSearch);
watch(langFilter, runSearch);

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
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <div class="pa-4 pb-0">
      <form class="d-flex ga-2" @submit.prevent="runSearch">
        <v-text-field
          v-model="searchInput"
          density="comfortable"
          variant="outlined"
          placeholder="Rechercher un mot ou une traduction…"
          prepend-inner-icon="mdi-magnify"
          hide-details
          @keyup.enter="runSearch"
        />
        <v-btn-toggle v-model="langFilter" density="comfortable" color="primary">
          <v-btn :value="null" size="small">Tout</v-btn>
          <v-btn value="fr" size="small">FR</v-btn>
          <v-btn value="de" size="small">DE</v-btn>
        </v-btn-toggle>
        <v-btn type="submit" variant="tonal">Rechercher</v-btn>
      </form>
    </div>

    <div class="flex-grow-1 overflow-y-auto pa-4">
      <p v-if="glossaryStore.loading" class="text-medium-emphasis text-center">
        Chargement du glossaire…
      </p>
      <p v-else-if="glossaryStore.error" class="text-error text-center">
        {{ glossaryStore.error }}
      </p>
      <p v-else-if="!glossaryStore.entries.length" class="text-medium-emphasis text-center">
        Aucun mot ne correspond à cette recherche.
      </p>

      <v-row>
        <v-col v-for="entry in glossaryStore.entries" :key="entry.id" cols="12" sm="6" md="4">
          <v-card variant="outlined">
            <v-card-item>
              <template #prepend>
                <v-chip size="small" variant="flat">{{ LANG_LABEL[entry.lang] }}</v-chip>
              </template>
              <v-card-title class="text-h6">{{ entry.term }}</v-card-title>
              <v-card-subtitle>{{ entry.translation }}</v-card-subtitle>
            </v-card-item>
            <v-card-text v-if="entry.note">{{ entry.note }}</v-card-text>
            <v-card-text class="text-caption text-medium-emphasis pt-0">
              {{ authorLabel(entry.authorId) }} · {{ formatDate(entry.createdAt) }}
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <div v-if="glossaryStore.nextCursor" class="text-center mt-4">
        <v-btn
          size="small"
          variant="text"
          :loading="glossaryStore.loadingMore"
          @click="glossaryStore.loadMore()"
        >
          Charger plus de mots
        </v-btn>
      </div>
    </div>
  </div>
</template>
