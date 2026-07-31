import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { vuetify } from './plugins/vuetify';
import { pinia } from './stores/pinia';

createApp(App).use(pinia).use(router).use(vuetify).mount('#app');
