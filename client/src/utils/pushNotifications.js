import API from "../services/api";

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// Web Push subscriptions need the VAPID public key as a Uint8Array, but the
// server hands it over as a base64url string — this converts between the two.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Registers the service worker, requests notification permission, subscribes
 * to push, and saves the subscription on the server. Throws with a
 * human-readable message on failure so the caller can show it to the user.
 */
export async function enablePushNotifications() {
  if (!isPushSupported()) {
    throw new Error("Push notifications aren't supported in this browser.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const { data } = await API.get("/notifications/vapid-public-key");
  if (!data?.publicKey) {
    throw new Error("Push notifications aren't configured on the server yet.");
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }

  await API.post("/notifications/subscribe", { subscription: subscription.toJSON() });
  return subscription;
}

/** Unsubscribes this device from push notifications, both locally and on the server. */
export async function disablePushNotifications() {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await API.post("/notifications/unsubscribe", { endpoint: subscription.endpoint }).catch(() => {});
  await subscription.unsubscribe();
}

/** Checks whether this device already has an active push subscription. */
export async function isPushEnabled() {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return !!subscription;
}
