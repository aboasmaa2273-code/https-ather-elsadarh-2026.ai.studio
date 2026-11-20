import {
  AcademicSettings,
  AuditLogEntry,
  ClassroomVisit,
  ImprovementPlan,
  PlatformSettings,
  RegisteredVisitor,
  Teacher
} from '../types';
import { DEFAULT_ACADEMIC_SETTINGS, DEFAULT_PLATFORM_SETTINGS } from '../data/defaultData';
import { atharRemoteAction, atharRemoteBootstrap } from './gasBridgeClient';

type CentralBootstrap = {
  teachers?: Record<string, unknown>[];
  visits?: Record<string, unknown>[];
  plans?: Record<string, unknown>[];
  archivedPlans?: Record<string, unknown>[];
  settings?: { key: string; value: unknown }[];
  auditLogs?: Record<string, unknown>[];
  visitors?: Record<string, unknown>[];
};

function parseSetting<T>(rows: CentralBootstrap['settings'], key: string, fallback: T): T {
  const row = (rows || []).find((item) => item.key === key);
  if (!row || row.value === undefined || row.value === null || row.value === '') return fallback;
  if (typeof row.value !== 'string') return row.value as T;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return row.value as T;
  }
}

export async function loadCentralData() {
  const raw = await atharRemoteBootstrap();
  const data = raw as unknown as CentralBootstrap;
  const teachers = (data.teachers || []).map((item) => ({
    ...item,
    id: String(item.id || ''),
    schoolId: String(item.schoolId || ''),
    fullName: String(item.fullName || item.name || ''),
    jobNumber: String(item.jobNumber || ''),
    specialization: String(item.specialization || ''),
    status: item.status === 'inactive' ? 'inactive' : 'active',
    email: String(item.email || ''),
    phone: String(item.phone || ''),
    dateAdded: String(item.dateAdded || '')
  })) as Teacher[];

  const visits = (data.visits || []).map((item) => ({
    ...item,
    id: String(item.id || ''),
    schoolId: String(item.schoolId || ''),
    practicalRecommendations: String(item.practicalRecommendations || item.recommendations || ''),
    observedIndicatorsCount: Number(item.observedIndicatorsCount ?? item.observedCount ?? 0),
    totalIndicatorsCount: Number(item.totalIndicatorsCount ?? item.totalCount ?? 0),
    achievementPercentage: Number(item.achievementPercentage || 0),
    indicators: Array.isArray(item.indicators) ? item.indicators : [],
    domains: Array.isArray(item.domains) ? item.domains : [],
    strengths: Array.isArray(item.strengths) ? item.strengths : [],
    improvementAreas: Array.isArray(item.improvementAreas) ? item.improvementAreas : []
  })) as ClassroomVisit[];

  const mapPlans = (items: Record<string, unknown>[] = []) => items.map((item) => ({
    ...item,
    id: String(item.id || ''),
    schoolId: String(item.schoolId || ''),
    relatedIndicatorText: String(item.relatedIndicatorText || item.relatedIndicator || ''),
    developmentalGoal: String(item.developmentalGoal || item.goal || ''),
    actionProcedure: String(item.actionProcedure || item.procedure || ''),
    responsiblePerson: String(item.responsiblePerson || item.responsible || '')
  })) as ImprovementPlan[];
  const plans = mapPlans(data.plans || []);
  const archivedPlans = mapPlans(data.archivedPlans || []);

  const auditLogs = (data.auditLogs || []).map((item) => ({
    ...item,
    id: String(item.id || ''),
    schoolId: String(item.schoolId || ''),
    timestamp: String(item.timestamp || ''),
    userName: String(item.userName || ''),
    userRole: String(item.userRole || ''),
    action: String(item.action || ''),
    details: String(item.details || '')
  })) as AuditLogEntry[];

  return {
    teachers,
    visits,
    plans,
    archivedPlans,
    auditLogs,
    registeredVisitors: (data.visitors || []).map((item) => ({
      ...item,
      id: String(item.id || ''),
      name: String(item.name || ''),
      role: String(item.role || 'evaluator'),
      roleTitle: String(item.roleTitle || ''),
      department: String(item.department || ''),
      jobNumber: String(item.jobNumber || ''),
      email: String(item.email || ''),
      phone: String(item.phone || ''),
      username: String(item.username || ''),
      status: item.status === 'inactive' ? 'inactive' : 'active'
    })) as RegisteredVisitor[],
    academicSettings: parseSetting<AcademicSettings>(data.settings, 'academicSettings', DEFAULT_ACADEMIC_SETTINGS),
    platformSettings: parseSetting<PlatformSettings>(data.settings, 'platformSettings', DEFAULT_PLATFORM_SETTINGS)
  };
}

export async function saveTeacherCentral(teacher: Partial<Teacher>) {
  return atharRemoteAction('saveTeacher', teacher as Record<string, unknown>);
}

export async function setTeacherStatusCentral(id: string, status: 'active' | 'inactive') {
  return atharRemoteAction('toggleTeacherStatus', { id, status });
}

export async function deleteTeacherCentral(id: string) {
  return atharRemoteAction('deleteTeacher', { id });
}

export async function saveVisitCentral(visit: ClassroomVisit & { recordHistory?: boolean }) {
  return atharRemoteAction('saveVisit', visit as unknown as Record<string, unknown>);
}

export async function changeVisitStatusCentral(id: string, status: ClassroomVisit['status']) {
  const action = status === 'approved' ? 'approveVisit'
    : status === 'archived' ? 'archiveVisit'
    : status === 'completed' ? 'unapproveVisit'
    : '';
  if (!action) throw new Error('حالة الزيارة المطلوبة غير مدعومة من الخادم.');
  return atharRemoteAction(action, { id });
}

export async function restoreVisitCentral(id: string) {
  return atharRemoteAction('restoreVisit', { id });
}

export async function archiveVisitsCentral(ids: string[]) {
  if (!ids.length) throw new Error('حدد تقريراً واحداً على الأقل.');
  return atharRemoteAction('archiveVisits', { ids });
}

export async function restoreVisitsCentral(ids: string[]) {
  if (!ids.length) throw new Error('حدد تقريراً واحداً على الأقل.');
  return atharRemoteAction('restoreVisits', { ids });
}

export async function archivePlansCentral(ids: string[]) {
  if (!ids.length) throw new Error('حدد خطة واحدة على الأقل.');
  return atharRemoteAction('deletePlans', { ids });
}

export async function restorePlansCentral(ids: string[]) {
  if (!ids.length) throw new Error('حدد خطة واحدة على الأقل.');
  return atharRemoteAction('restorePlans', { ids });
}

export async function savePlanCentral(plan: Partial<ImprovementPlan>) {
  return atharRemoteAction('savePlan', plan as Record<string, unknown>);
}

export async function savePlanFollowUpCentral(planId: string, values: {
  status: string;
  followUpResult: string;
  followUpNotes: string;
  followUpDate?: string;
}) {
  return atharRemoteAction('savePlanFollowUp', { planId, ...values });
}

export async function saveAcademicSettingsCentral(settings: AcademicSettings) {
  return atharRemoteAction('saveSettings', { academicSettings: settings });
}
