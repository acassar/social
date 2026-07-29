import 'vuetify/styles';
import { createVuetify } from 'vuetify';

// Thème sombre par défaut, sobre, dans l'esprit Discord (voir SPEC §M2-T4).
export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'dark',
  },
});
