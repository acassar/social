<script setup lang="ts">
import InstallPrompt from '@/components/InstallPrompt.vue';
</script>

<template>
  <v-app>
    <router-view />
    <InstallPrompt />
  </v-app>
</template>
