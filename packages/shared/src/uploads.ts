// Types partagés pour l'upload de fichiers (M5-T1). Réutilisés par M5-T2
// pour attacher un fichier uploadé à un post de type `memes`.

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;

export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

// 10 Mo : suffisant pour des photos/mèmes, sans configuration dédiée vu la
// taille du groupe. À revoir si besoin de fichiers plus lourds (M5-T2/T3).
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

export interface UploadResultDto {
  url: string;
  thumbUrl: string | null;
  mime: string;
  width: number | null;
  height: number | null;
}
