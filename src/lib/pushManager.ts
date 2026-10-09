// Gestor de Web Push Notifications (VAPID)
import { isConfigured, supabase } from './supabaseClient';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushManager = {
  isPushSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  getPermissionState(): NotificationPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  },

  async requestPermissionAndSubscribe(householdId: string, userId: string): Promise<boolean> {
    if (!this.isPushSupported()) {
      console.warn('Web Push no está soportado en este navegador.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

      if (!vapidKey || vapidKey.includes('tu-clave')) {
        console.info('VAPID public key en modo demo; simulando suscripción push.');
        return true;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Guardar suscripción en Supabase si está conectado
      if (isConfigured && householdId && userId) {
        await supabase.from('push_subscriptions').upsert({
          household_id: householdId,
          user_id: userId,
          subscription: subscription.toJSON(),
        });
      }

      return true;
    } catch (e) {
      console.error('Error al suscribir a notificaciones push:', e);
      return false;
    }
  },
};
