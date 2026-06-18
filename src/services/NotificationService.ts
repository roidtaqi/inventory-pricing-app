import { db } from '../db/db';

type NotificationPermissionState = NotificationPermission | 'unsupported';

interface NotifyOptions {
  title: string;
  body: string;
  tag?: string;
}

interface ApprovalNotificationInput {
  productName: string;
  unitName?: string;
  actorName?: string;
}

const ENABLED_SETTING_KEY = 'browserNotificationsEnabled';

function supportsNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function buildProductLabel(input: Pick<ApprovalNotificationInput, 'productName' | 'unitName'>): string {
  return input.unitName ? `${input.productName} (${input.unitName})` : input.productName;
}

export class NotificationService {
  static readonly ENABLED_SETTING_KEY = ENABLED_SETTING_KEY;

  static getPermission(): NotificationPermissionState {
    if (!supportsNotifications()) {
      return 'unsupported';
    }

    return Notification.permission;
  }

  static async requestPermission(): Promise<NotificationPermissionState> {
    if (!supportsNotifications()) {
      await NotificationService.setEnabled(false);
      return 'unsupported';
    }

    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;

    await NotificationService.setEnabled(permission === 'granted');
    return permission;
  }

  static async setEnabled(enabled: boolean): Promise<void> {
    await db.appSettings.put({
      key: ENABLED_SETTING_KEY,
      value: String(enabled),
    });
  }

  static async isEnabled(): Promise<boolean> {
    if (NotificationService.getPermission() !== 'granted') {
      return false;
    }

    const setting = await db.appSettings.get(ENABLED_SETTING_KEY);
    return setting?.value === 'true';
  }

  static async notify(options: NotifyOptions): Promise<boolean> {
    if (!(await NotificationService.isEnabled())) {
      return false;
    }

    try {
      new Notification(options.title, {
        body: options.body,
        tag: options.tag,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      });
      return true;
    } catch (error) {
      console.error('Browser notification failed', error);
      return false;
    }
  }

  static notifyApprovalSubmitted(input: ApprovalNotificationInput): Promise<boolean> {
    const productLabel = buildProductLabel(input);
    const submittedBy = input.actorName ? ` oleh ${input.actorName}` : '';
    return NotificationService.notify({
      title: 'Approval harga diajukan',
      body: `${productLabel} menunggu persetujuan${submittedBy}.`,
      tag: `approval-submitted-${productLabel}`,
    });
  }

  static notifyApprovalApproved(input: ApprovalNotificationInput & { statusLabel?: string }): Promise<boolean> {
    const productLabel = buildProductLabel(input);
    const actor = input.actorName ? ` oleh ${input.actorName}` : '';
    const status = input.statusLabel ? ` Status: ${input.statusLabel}.` : '';
    return NotificationService.notify({
      title: 'Harga disetujui',
      body: `${productLabel} sudah disetujui${actor}.${status}`,
      tag: `approval-approved-${productLabel}`,
    });
  }

  static notifyApprovalRejected(input: ApprovalNotificationInput & { reason?: string }): Promise<boolean> {
    const productLabel = buildProductLabel(input);
    const actor = input.actorName ? ` oleh ${input.actorName}` : '';
    const reason = input.reason ? ` Alasan: ${input.reason}` : '';
    return NotificationService.notify({
      title: 'Approval harga ditolak',
      body: `${productLabel} ditolak${actor}.${reason}`,
      tag: `approval-rejected-${productLabel}`,
    });
  }
}
