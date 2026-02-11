import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const isNative = Capacitor.isNativePlatform();

export async function hapticsImpact(style: ImpactStyle = ImpactStyle.Medium) {
  if (isNative) {
    await Haptics.impact({ style });
  } else if (navigator.vibrate) {
    navigator.vibrate(50);
  }
}

export async function hapticsNotification(type: NotificationType = NotificationType.Success) {
  if (isNative) {
    await Haptics.notification({ type });
  } else if (navigator.vibrate) {
    navigator.vibrate([50, 30, 50]);
  }
}

export async function hapticsSelection() {
  if (isNative) {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } else if (navigator.vibrate) {
    navigator.vibrate(30);
  }
}
