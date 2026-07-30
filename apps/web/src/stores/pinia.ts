import { createPinia, setActivePinia } from 'pinia';

// Instance unique, activée immédiatement : permet d'utiliser useAuthStore()
// en dehors d'un composant monté (ex. tests, garde de navigation) tout en
// restant la même instance que celle installée sur l'app via `app.use(pinia)`.
export const pinia = createPinia();
setActivePinia(pinia);
