export type RoleLike = { role?: string | null };

export function normalizeRole(role: unknown): string {
  const raw = String(role ?? '').trim().toLowerCase().replace(/[\\s-]+/g, '_');
  const aliases: Record<string, string> = {
    admin: 'platform_admin', platformadmin: 'platform_admin', system_admin: 'platform_admin',
    'مسؤول المنصة': 'platform_admin', 'مسؤول النظام': 'platform_admin', 'مدير المنصة': 'platform_admin',
    principal: 'school_admin', schooladmin: 'school_admin', 'مسؤول المدرسة': 'school_admin', 'مدير المدرسة': 'school_admin',
    assistant_principal: 'vice_principal', viceprincipal: 'vice_principal', 'مساعد المدير': 'vice_principal', 'نائب المدير': 'vice_principal',
    observer: 'evaluator', evaluator: 'evaluator', 'مقيم': 'evaluator', 'مقيّم': 'evaluator', 'مقيم معتمد': 'evaluator', 'مقيّم معتمد': 'evaluator',
    teacher: 'teacher', 'معلم': 'teacher', 'معلّم': 'teacher'
  };
  return aliases[raw] || raw;
}

export function isAdminRole(role: unknown): boolean {
  return ['platform_admin', 'school_admin'].includes(normalizeRole(role));
}

export function isManagementRole(role: unknown): boolean {
  return ['platform_admin', 'school_admin', 'vice_principal'].includes(normalizeRole(role));
}

export function normalizeUserRole<T extends RoleLike>(user: T): T & { role: string } {
  return { ...user, role: normalizeRole(user.role) };
}
