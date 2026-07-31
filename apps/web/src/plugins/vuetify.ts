// Roboto : Vuetify la suppose présente sans la fournir. Servie en local via
// @fontsource plutôt que depuis Google Fonts — l'app est une PWA qui doit
// fonctionner hors ligne, et ça évite une requête tierce.
// Sous-ensembles latin/latin-ext seulement : importer les fichiers de graisse
// complets embarque aussi cyrillique, grec et vietnamien, soit ~2,4 Mo de
// polices précachées pour rien sur une app franco-allemande.
import '@fontsource/roboto/latin-300.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/roboto/latin-ext-300.css';
import '@fontsource/roboto/latin-ext-400.css';
import '@fontsource/roboto/latin-ext-500.css';
import '@fontsource/roboto/latin-ext-700.css';
// Material Design Icons : jeu d'icônes par défaut de Vuetify, mais la police
// n'est pas embarquée. Sans cet import, tout `prepend-icon`/`v-icon` réserve
// sa place et n'affiche rien.
import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';

// Thème sombre par défaut, sobre, dans l'esprit Discord (voir SPEC §M2-T4).
export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'dark',
  },
});
