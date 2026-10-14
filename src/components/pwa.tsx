'use client';
import { useEffect, useState } from 'react';
import { claimInstallPrompt } from '@/lib/install-prompt';

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
let registration: Promise<ServiceWorkerRegistration> | undefined;
export function registerPwa() {
  if (!registration)
    registration = navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .catch((error) => {
        registration = undefined;
        throw error;
      });
  return registration;
}
export function PwaProvider() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    if ('serviceWorker' in navigator && window.isSecureContext) void registerPwa().catch(() => {});
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone;
    const apple =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let shown = false;
    const showInstallBanner = () => {
      if (standalone || shown) return;
      try {
        if (!claimInstallPrompt(window.localStorage)) return;
      } catch {
        return;
      }
      shown = true;
      setIos(apple);
      setShow(true);
    };
    const install = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      showInstallBanner();
    };
    const installed = () => {
      shown = true;
      setShow(false);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('appinstalled', installed);
    const timer = window.setTimeout(() => {
      if (apple) showInstallBanner();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', install);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  if (!show) return null;
  return (
    <aside className="pwa-banner" aria-label="Install Personal University">
      <strong>Your university, on your Home Screen</strong>
      <p className="muted">
        {ios
          ? 'Open the browser’s Share menu, choose Add to Home Screen, then open University from your Home Screen.'
          : 'Install University for quick access to your courses and vocabulary practice.'}
      </p>
      <div className="actions-row">
        {prompt && (
          <button
            className="button primary"
            onClick={async () => {
              try {
                await prompt.prompt();
                await prompt.userChoice;
                setPrompt(null);
                setShow(false);
              } catch {
                setShow(false);
              }
            }}
          >
            Install app
          </button>
        )}
        <button
          className="button secondary"
          onClick={() => {
            setShow(false);
          }}
        >
          Maybe later
        </button>
      </div>
    </aside>
  );
}

export function PwaSettings({ configured }: { configured: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const capable =
      window.isSecureContext &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    const timer = window.setTimeout(() => {
      setSupported(capable);
      if (!capable) setReady(true);
    }, 0);
    if (!capable) return () => window.clearTimeout(timer);
    void registerPwa()
      .then(async (reg) => {
        const subscription = await reg.pushManager.getSubscription();
        if (subscription) {
          const response = await fetch('/api/push/subscription', { cache: 'no-store' });
          if (response.ok) {
            const data = await response.json();
            setEnabled(data.endpoints.includes(subscription.endpoint));
          }
        }
      })
      .catch(() => setMessage('Could not check reminders. Try reloading.'))
      .finally(() => setReady(true));
    return () => window.clearTimeout(timer);
  }, []);
  async function toggle() {
    setBusy(true);
    setMessage('');
    try {
      // Permission is requested directly from this user gesture (required on iOS).
      if (!enabled && (await Notification.requestPermission()) !== 'granted')
        throw new Error(
          'Notifications are blocked. Allow them in your browser or phone settings, then try again.',
        );
      const reg = await registerPwa();
      let subscription = await reg.pushManager.getSubscription();
      if (enabled) {
        if (subscription) {
          const response = await fetch('/api/push/subscription', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          if (!response.ok) throw new Error('Could not disable reminders. Try again.');
          await subscription.unsubscribe();
        }
        setEnabled(false);
        setMessage('Reminders disabled on this device.');
      } else {
        const response = await fetch('/api/push/config');
        if (!response.ok) throw new Error('Reminders are not configured yet.');
        const { publicKey } = await response.json();
        if (!subscription) {
          const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
            c.charCodeAt(0),
          );
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
          });
        }
        const saved = await fetch('/api/push/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        });
        if (!saved.ok) throw new Error('Could not save reminders. Try again.');
        setEnabled(true);
        setMessage('Daily vocabulary reminders enabled on this device.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update reminders. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel pwa-settings">
      <h2>Install & vocabulary reminders</h2>
      <p className="muted">
        Add University to your Home Screen from your browser menu. On iPhone or iPad, use Share →
        Add to Home Screen, then open the installed app.
      </p>
      <p className="muted">
        Get one daily reminder after 9:00 AM in your profile’s timezone when you have new words to
        learn or reviews due. Reminders work even when the app is closed.
      </p>
      <button
        className="button secondary"
        disabled={!ready || busy || (!enabled && (!supported || !configured))}
        onClick={toggle}
      >
        {busy
          ? 'Saving…'
          : enabled
            ? 'Disable reminders on this device'
            : 'Enable vocabulary reminders'}
      </button>
      {ready && !supported && (
        <p className="muted">
          Use a browser that supports notifications. On iPhone or iPad, open the app from your Home
          Screen first.
        </p>
      )}
      {!configured && (
        <p className="muted">
          Daily notifications will be available once the server’s reminder service is configured.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
