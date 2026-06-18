import { db, type AppSetting } from '../db/db';

export type AppRole = 'OWNER' | 'ADMIN' | 'KASIR';

export interface AppSession {
  role: AppRole;
  name: string;
}

export const ROLE_OPTIONS: Array<{ value: AppRole; label: string; description: string }> = [
  {
    value: 'OWNER',
    label: 'Owner',
    description: 'Bisa menyetujui dan menolak approval harga.',
  },
  {
    value: 'ADMIN',
    label: 'Admin',
    description: 'Bisa membuat pengajuan dan melihat status approval.',
  },
  {
    value: 'KASIR',
    label: 'Kasir',
    description: 'Bisa melihat status harga yang sudah diajukan.',
  },
];

const ROLE_SETTING_KEY = 'currentUserRole';
const NAME_SETTING_KEY = 'currentUserName';

const roleLabels: Record<AppRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  KASIR: 'Kasir',
};

const defaultNames: Record<AppRole, string> = {
  OWNER: 'Owner Lokal',
  ADMIN: 'Admin Lokal',
  KASIR: 'Kasir Lokal',
};

function normalizeRole(value?: string): AppRole {
  if (value === 'OWNER' || value === 'ADMIN' || value === 'KASIR') {
    return value;
  }

  return 'OWNER';
}

function settingsToMap(settings: AppSetting[] | Map<string, string> | undefined) {
  if (settings instanceof Map) {
    return settings;
  }

  return new Map((settings ?? []).map(setting => [setting.key, setting.value]));
}

export class SessionService {
  static readonly ROLE_SETTING_KEY = ROLE_SETTING_KEY;
  static readonly NAME_SETTING_KEY = NAME_SETTING_KEY;

  static getDefaultSession(): AppSession {
    return {
      role: 'OWNER',
      name: defaultNames.OWNER,
    };
  }

  static fromSettings(settings?: AppSetting[] | Map<string, string>): AppSession {
    const settingMap = settingsToMap(settings);
    const role = normalizeRole(settingMap.get(ROLE_SETTING_KEY));
    const name = (settingMap.get(NAME_SETTING_KEY) ?? '').trim() || defaultNames[role];

    return { role, name };
  }

  static async getSession(): Promise<AppSession> {
    const settings = await db.appSettings.bulkGet([ROLE_SETTING_KEY, NAME_SETTING_KEY]);
    return SessionService.fromSettings(
      new Map([
        [ROLE_SETTING_KEY, settings[0]?.value ?? 'OWNER'],
        [NAME_SETTING_KEY, settings[1]?.value ?? defaultNames.OWNER],
      ]),
    );
  }

  static async saveSession(session: AppSession): Promise<void> {
    const role = normalizeRole(session.role);
    await db.appSettings.bulkPut([
      { key: ROLE_SETTING_KEY, value: role },
      { key: NAME_SETTING_KEY, value: session.name.trim() || defaultNames[role] },
    ]);
  }

  static roleLabel(role: AppRole): string {
    return roleLabels[role];
  }

  static defaultNameForRole(role: AppRole): string {
    return defaultNames[role];
  }

  static canApprove(role: AppRole): boolean {
    return role === 'OWNER';
  }
}
