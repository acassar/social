import { Transform } from 'class-transformer';

/**
 * Retire les espaces en début/fin d'un champ texte saisi par l'utilisateur.
 *
 * À poser sur les identifiants copiés-collés (pseudo, code d'invitation) :
 * un espace parasite les faisait échouer avec un 401 indiscernable d'un vrai
 * mauvais mot de passe. La transformation tourne avant la validation (le
 * ValidationPipe global est en `transform: true`), donc une valeur ne
 * contenant que des espaces devient '' et part en 400, pas en 401.
 *
 * Volontairement pas appliqué aux mots de passe : un espace initial ou final
 * peut y être intentionnel, le retirer changerait le secret de l'utilisateur.
 */
export function Trim(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}
