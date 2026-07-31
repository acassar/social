import type { SubscribePushRequestDto } from '@social/shared';
import { http } from './http';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && VAPID_PUBLIC_KEY.length > 0;
}

// PushManager.subscribe() attend une clé binaire (Uint8Array), pas la
// chaîne base64url exposée par VAPID_PUBLIC_KEY.
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

function toSubscribeDto(subscription: PushSubscription): SubscribePushRequestDto {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Abonnement Push incomplet');
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

// Sans service worker actif (ex. dev sans build PWA), `ready` ne se résout
// jamais : on borne l'attente plutôt que de bloquer indéfiniment le clic.
function waitForServiceWorker(timeoutMs = 5000): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) =>
      setTimeout(() => reject(new Error('Service worker indisponible')), timeoutMs),
    ),
  ]);
}

// Abonne le navigateur aux Web Push (demande la permission si besoin) et
// enregistre l'abonnement côté API. Un seul abonnement par appareil, partagé
// par tous les salons opt-in (voir doc/BACKLOG.md M6-T2).
export async function ensurePushSubscribed(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error('Les notifications Push ne sont pas supportées par ce navigateur');
  }

  const registration = await waitForServiceWorker();
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  await http.post<void>('/push/subscribe', toSubscribeDto(subscription));
}
