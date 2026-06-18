import { db, type AuthPermission, type AuthRole, type AuthUser, type PosRoleName } from '../db/db';

export interface InventorySessionUser {
  id: string;
  name: string;
  role: PosRoleName;
  role_id: string;
  phone?: string;
  email?: string;
  position_title?: string;
  profile_note?: string;
  permissions: string[];
}

interface PosAuthSnapshot {
  users?: AuthUser[];
  roles?: AuthRole[];
  permissions?: AuthPermission[];
}

const SESSION_KEY = 'inventory_current_user';
const now = () => new Date().toISOString();

const DEFAULT_PERMISSIONS: AuthPermission[] = [
  { id: 'perm_dashboard_view', code: 'dashboard:view', name: 'Lihat dashboard' },
  { id: 'perm_pos_use', code: 'pos:use', name: 'Gunakan kasir' },
  { id: 'perm_products_read', code: 'products:read', name: 'Lihat produk' },
  { id: 'perm_products_manage', code: 'products:manage', name: 'Kelola produk' },
  { id: 'perm_stock_read', code: 'stock:read', name: 'Lihat stok' },
  { id: 'perm_stock_manage', code: 'stock:manage', name: 'Kelola stok' },
  { id: 'perm_shift_manage', code: 'shift:manage', name: 'Kelola shift' },
  { id: 'perm_reports_view', code: 'reports:view', name: 'Lihat laporan' },
  { id: 'perm_customers_manage', code: 'customers:manage', name: 'Kelola pelanggan' },
  { id: 'perm_sync_manage', code: 'sync:manage', name: 'Sinkronisasi data' },
  { id: 'perm_settings_manage', code: 'settings:manage', name: 'Kelola pengaturan' },
  { id: 'perm_discount_apply', code: 'discount:apply', name: 'Beri diskon' },
  { id: 'perm_void_manage', code: 'void:manage', name: 'Void transaksi' },
  { id: 'perm_refund_manage', code: 'refund:manage', name: 'Refund transaksi' },
  { id: 'perm_cash_manage', code: 'cash:manage', name: 'Cash in/out' },
  { id: 'perm_users_manage', code: 'users:manage', name: 'Kelola user' },
  { id: 'perm_receipt_print', code: 'receipt:print', name: 'Cetak struk' },
];

const cashierPermissions = ['dashboard:view', 'pos:use', 'shift:manage', 'customers:manage', 'receipt:print'];
const supervisorPermissions = [
  ...cashierPermissions,
  'reports:view',
  'stock:read',
  'discount:apply',
  'void:manage',
  'refund:manage',
  'cash:manage',
];
const adminPermissions = [
  'dashboard:view',
  'pos:use',
  'products:read',
  'products:manage',
  'stock:read',
  'stock:manage',
  'shift:manage',
  'reports:view',
  'customers:manage',
  'sync:manage',
  'settings:manage',
  'cash:manage',
  'receipt:print',
];
const ownerPermissions = DEFAULT_PERMISSIONS.map(permission => permission.code);

const DEFAULT_ROLES: AuthRole[] = [
  { id: 'role_owner', name: 'Owner', description: 'Akses penuh seluruh aplikasi', permissions: ownerPermissions },
  { id: 'role_admin', name: 'Admin', description: 'Operasional toko, katalog, laporan, dan sync', permissions: adminPermissions },
  { id: 'role_supervisor', name: 'Supervisor', description: 'Kasir senior dengan otorisasi diskon, void, dan refund', permissions: supervisorPermissions },
  { id: 'role_kasir', name: 'Kasir', description: 'Transaksi kasir dan shift harian', permissions: cashierPermissions },
];

const DEFAULT_USERS: AuthUser[] = [
  {
    id: 'usr_owner',
    name: 'Roid Owner',
    role_id: 'role_owner',
    role: 'Owner',
    pin: '1111',
    phone: '08123456789',
    email: 'roid@kastur.local',
    position_title: 'Owner Kastur',
    profile_note: 'Pemilik dengan akses penuh seluruh modul dan pengaturan permission.',
    is_active: true,
    created_at: now(),
  },
  {
    id: 'usr_admin',
    name: 'Nawir Admin',
    role_id: 'role_admin',
    role: 'Admin',
    pin: '2222',
    phone: '08123456790',
    email: 'nawir@kastur.local',
    position_title: 'Admin Operasional',
    profile_note: 'Mengelola katalog, stok, laporan, sinkronisasi, dan pengaturan operasional.',
    is_active: true,
    created_at: now(),
  },
  {
    id: 'usr_spv',
    name: 'Kastur Supervisor',
    role_id: 'role_supervisor',
    role: 'Supervisor',
    pin: '3333',
    phone: '08123456791',
    email: 'supervisor@kastur.local',
    position_title: 'Supervisor Kasir',
    profile_note: 'Mengawasi shift, diskon, laporan, dan proses kasir harian.',
    is_active: true,
    created_at: now(),
  },
  {
    id: 'usr_kasir1',
    name: 'Roid Kasir',
    role_id: 'role_kasir',
    role: 'Kasir',
    pin: '4444',
    phone: '08123456792',
    email: 'kasir.roid@kastur.local',
    position_title: 'Kasir',
    profile_note: 'Menangani transaksi, pelanggan, shift, dan cetak struk.',
    is_active: true,
    created_at: now(),
  },
  {
    id: 'usr_kasir2',
    name: 'Nawir Kasir',
    role_id: 'role_kasir',
    role: 'Kasir',
    pin: '5555',
    phone: '08123456793',
    email: 'kasir.nawir@kastur.local',
    position_title: 'Kasir',
    profile_note: 'Menangani transaksi, pelanggan, shift, dan cetak struk.',
    is_active: true,
    created_at: now(),
  },
];

function emitAuthChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('inventory-auth-changed'));
  }
}

function normalizeEmail(value?: string) {
  return (value ?? '').trim().toLowerCase();
}

function normalizePhone(value?: string) {
  return (value ?? '').replace(/\D/g, '');
}

function toSessionUser(user: AuthUser, role?: AuthRole): InventorySessionUser {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    role_id: user.role_id,
    phone: user.phone,
    email: user.email,
    position_title: user.position_title,
    profile_note: user.profile_note,
    permissions: role?.permissions ?? [],
  };
}

function hasAllOwnerPermissions(role: AuthRole) {
  return ownerPermissions.every(permission => role.permissions.includes(permission));
}

export const authService = {
  async ensureAuthData() {
    await db.transaction('rw', db.authPermissions, db.authRoles, db.authUsers, async () => {
      if ((await db.authPermissions.count()) === 0) {
        await db.authPermissions.bulkPut(DEFAULT_PERMISSIONS);
      }

      if ((await db.authRoles.count()) === 0) {
        await db.authRoles.bulkPut(DEFAULT_ROLES);
      } else {
        const ownerRole = await db.authRoles.get('role_owner');
        if (ownerRole && !hasAllOwnerPermissions(ownerRole)) {
          await db.authRoles.update('role_owner', {
            permissions: ownerPermissions,
            description: DEFAULT_ROLES.find(role => role.id === 'role_owner')?.description ?? ownerRole.description,
          });
        }
      }

      if ((await db.authUsers.count()) === 0) {
        await db.authUsers.bulkPut(DEFAULT_USERS);
      }
    });
  },

  async importPosAuthSnapshot(snapshot: PosAuthSnapshot) {
    const users = snapshot.users ?? [];
    const roles = snapshot.roles ?? [];
    const permissions = snapshot.permissions ?? [];

    if (!users.length || !roles.length) {
      return { success: false, users: 0, roles: 0, message: 'Snapshot POS belum memiliki data user dan role.' };
    }

    await db.transaction('rw', db.authPermissions, db.authRoles, db.authUsers, async () => {
      await Promise.all([
        db.authUsers.clear(),
        db.authRoles.clear(),
        permissions.length ? db.authPermissions.clear() : Promise.resolve(),
      ]);

      if (permissions.length) await db.authPermissions.bulkPut(permissions);
      await db.authRoles.bulkPut(roles);
      await db.authUsers.bulkPut(users);
    });

    await this.refreshCurrentUser();
    return { success: true, users: users.length, roles: roles.length };
  },

  async login(identifier: string, pin: string) {
    await this.ensureAuthData();

    const email = normalizeEmail(identifier);
    const phone = normalizePhone(identifier);
    const users = await db.authUsers.toArray();
    const user = users.find(item => {
      const emailMatches = email && normalizeEmail(item.email) === email;
      const phoneMatches = phone && normalizePhone(item.phone) === phone;
      return item.is_active && item.pin === pin && (emailMatches || phoneMatches);
    });

    if (!user) {
      return { success: false, message: 'Email/nomor HP atau PIN tidak cocok.' };
    }

    const role = await db.authRoles.get(user.role_id);
    const sessionUser = toSessionUser(user, role);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    emitAuthChanged();
    return { success: true, user: sessionUser };
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
    emitAuthChanged();
  },

  getCurrentUser(): InventorySessionUser | null {
    const userStr = localStorage.getItem(SESSION_KEY);
    if (!userStr) return null;

    try {
      return JSON.parse(userStr) as InventorySessionUser;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  },

  async refreshCurrentUser() {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return null;

    const user = await db.authUsers.get(currentUser.id);
    if (!user || !user.is_active) {
      this.logout();
      return null;
    }

    const role = await db.authRoles.get(user.role_id);
    const sessionUser = toSessionUser(user, role);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    emitAuthChanged();
    return sessionUser;
  },

  canApprove(user: InventorySessionUser | null): boolean {
    return user?.role === 'Owner';
  },

  can(user: InventorySessionUser | null, permission: string): boolean {
    return Boolean(user?.permissions.includes(permission));
  },
};
