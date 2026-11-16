'use strict';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = {
  console,
  Date,
  JSON,
  String,
  Object,
  Array,
  Math,
  Number,
  RegExp,
  Error,
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: () => 'test-spreadsheet-id',
      setProperty: () => { throw new Error('Health check must not write Script Properties'); }
    })
  },
  SpreadsheetApp: {
    openById: () => ({
      getSheetByName: (name) => ['Users', 'Teachers'].includes(name) ? {} : null
    })
  }
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('gas/Code.gs', 'utf8'), sandbox, { filename: 'gas/Code.gs' });

function sheet(records = []) {
  return { records };
}
function mockDatabase(data) {
  sandbox.getDatabaseSpreadsheet_ = () => ({
    getSheetByName: (name) => sheet(data[name] || [])
  });
  sandbox.rowsAsObjects_ = (value) => value && Array.isArray(value.records) ? value.records : [];
  sandbox.ensureRegisteredVisitorsSheet_ = () => sheet([]);
  sandbox.requireRole_ = (session, roles) => roles.includes(session.role);
}

const schoolId = 'sch_alsadara_01';
const records = {
  Teachers: [
    { id: 'teacher-1', schoolId, fullName: 'المعلم الأول' },
    { id: 'teacher-2', schoolId, fullName: 'المعلم الثاني' }
  ],
  Visits: [
    { id: 'visit-1', schoolId, teacherId: 'teacher-1', status: 'approved', strengths: '[]', improvementAreas: '[]' },
    { id: 'visit-2', schoolId, teacherId: 'teacher-2', status: 'approved', strengths: '[]', improvementAreas: '[]' }
  ],
  ImprovementPlans: [
    { id: 'plan-1', schoolId, teacherId: 'teacher-1', goal: 'هدف أول' },
    { id: 'plan-2', schoolId, teacherId: 'teacher-2', goal: 'هدف ثان' }
  ],
  Users: [],
  IndicatorLibrary: [],
  Settings: [],
  VisitIndicators: [],
  VisitDomains: [],
  PlanFollowUps: [],
  InternalNotes: [],
  InternalNoteHistory: [],
  AdministrativeFollowUps: [],
  VisitHistory: [],
  AuditLog: []
};

mockDatabase(records);
const teacherBootstrap = sandbox.dispatchApiAction_('bootstrap', {}, {
  id: 'user-teacher-1',
  schoolId,
  teacherId: 'teacher-1',
  role: 'teacher',
  name: 'المعلم الأول'
});
assert.equal(teacherBootstrap.success, true);
assert.deepEqual(Array.from(teacherBootstrap.teachers, (item) => item.id), ['teacher-1']);
assert.deepEqual(Array.from(teacherBootstrap.visits, (item) => item.id), ['visit-1']);
assert.deepEqual(Array.from(teacherBootstrap.plans, (item) => item.id), ['plan-1']);
assert.equal(teacherBootstrap.users.length, 0);
assert.equal(teacherBootstrap.visitors.length, 0);

const adminBootstrap = sandbox.dispatchApiAction_('bootstrap', {}, {
  id: 'user-admin',
  schoolId,
  role: 'school_admin',
  name: 'مدير المدرسة'
});
assert.equal(adminBootstrap.success, true);
assert.equal(adminBootstrap.visits.length, 2);
assert.equal(adminBootstrap.plans.length, 2);

const health = sandbox.getDatabaseHealth_();
assert.equal(health.success, true);
assert.equal(health.databaseReady, true);

sandbox.SpreadsheetApp.openById = () => ({
  getSheetByName: (name) => name === 'Users' ? {} : null
});
const missingSheetHealth = sandbox.getDatabaseHealth_();
assert.equal(missingSheetHealth.success, false);
assert.equal(missingSheetHealth.databaseReady, false);

sandbox.SpreadsheetApp.openById = () => { throw new Error('simulated access denied'); };
const deniedHealth = sandbox.getDatabaseHealth_();
assert.equal(deniedHealth.success, false);
assert.equal(deniedHealth.databaseReady, false);

mockDatabase({
  Users: [
    { id: 'eval-1', name: 'مقيم نشط', role: ' Evaluator ', status: ' ACTIVE ', schoolId },
    { id: 'eval-2', name: 'مقيم بحالة فارغة', role: 'evaluator', status: '', schoolId },
    { id: 'teacher-1', name: 'معلم', role: 'teacher', status: 'active', schoolId },
    { id: 'eval-3', name: 'مقيم معطل', role: 'evaluator', status: 'disabled', schoolId },
    { id: 'eval-4', name: 'مقيم بمدرسة أخرى', role: 'evaluator', status: 'active', schoolId: 'another-school' }
  ]
});
const directory = sandbox.getPublicEvaluators_();
assert.equal(directory.success, true);
assert.deepEqual(Array.from(directory.evaluators, (item) => item.id).sort(), ['eval-1', 'eval-2']);
assert.ok(directory.evaluators.every((item) => item.email === ''));
assert.ok(directory.evaluators.every((item) => !('username' in item) && !('passwordHash' in item)));

console.log('PASS: teacher bootstrap is restricted to the signed-in teacher records');
console.log('PASS: school administrators retain school-wide bootstrap access');
console.log('PASS: database health checks are read-only and detect missing sheets/access');
console.log('PASS: public evaluator directory filters account status, role, and school without exposing credentials');

function makeMutableSheet(headers, records) {
  const values = () => [headers].concat(records.map((record) => headers.map((header) => record[header] ?? '')));
  return {
    records,
    getLastRow: () => records.length + 1,
    getLastColumn: () => headers.length,
    getDataRange: () => ({ getValues: values }),
    appendRow: (row) => records.push(Object.fromEntries(headers.map((header, index) => [header, row[index]]))),
    deleteRow: (rowNumber) => records.splice(rowNumber - 2, 1),
    getRange: (rowNumber, columnNumber, numRows, numColumns) => ({
      getValues: () => rowNumber === 1 ? [headers.slice(columnNumber - 1, columnNumber - 1 + (numColumns || 1))] : [],
      setValue: (value) => {
        if (rowNumber === 1 && columnNumber > headers.length) { headers.push(String(value)); return; }
        const record = records[rowNumber - 2];
        if (record) record[headers[columnNumber - 1]] = value;
      }
    })
  };
}

const planHeaders = ['id', 'schoolId', 'teacherId', 'teacherName', 'goal', 'status', 'followUpDate', 'evaluatorId', 'evaluatorName', 'createdAt'];
const planRecords = [
  { id: 'plan-owned-by-other', schoolId, teacherId: 'teacher-1', goal: 'خطة المقيم الآخر', status: 'in_progress', evaluatorId: 'evaluator-other', evaluatorName: 'مقيم آخر' },
  { id: 'plan-owned-by-current', schoolId, teacherId: 'teacher-1', goal: 'خطتي', status: 'in_progress', evaluatorId: 'evaluator-current', evaluatorName: 'المقيم الحالي' },
  { id: 'plan-legacy', schoolId, teacherId: 'teacher-2', goal: 'خطة قديمة بلا مالك', status: 'in_progress' }
];
const planSheet = makeMutableSheet(planHeaders, planRecords);
const followUpSheet = makeMutableSheet(['id', 'planId', 'followUpDate', 'createdBy', 'result', 'notes', 'status', 'recordedAt'], []);
const teacherSheet = sheet([{ id: 'teacher-1', schoolId, fullName: 'المعلم الأول' }, { id: 'teacher-2', schoolId, fullName: 'المعلم الثاني' }]);
const mutableSheets = { Teachers: teacherSheet, ImprovementPlans: planSheet, PlanFollowUps: followUpSheet };
sandbox.getDatabaseSpreadsheet_ = () => ({ getSheetByName: (name) => mutableSheets[name] || null });
sandbox.rowsAsObjects_ = (value) => value && Array.isArray(value.records) ? value.records : [];
sandbox.requireRole_ = (session, roles) => roles.includes(session.role);
sandbox.Utilities = { getUuid: () => 'generated-plan-id' };
sandbox.logAuditAction = () => {};
sandbox.upsertObjectRow_ = (sheetName, object, idKey, targetSchoolId) => {
  const target = mutableSheets[sheetName];
  const existing = target.records.find((item) => String(item[idKey]) === String(object[idKey]));
  if (existing && String(existing.schoolId) !== String(targetSchoolId)) return { success: false, error: 'wrong school' };
  if (existing) Object.assign(existing, object);
  else target.records.push({ ...object });
  return { success: true, id: object[idKey] };
};

const evaluatorSession = { id: 'evaluator-current', schoolId, role: 'evaluator', name: 'المقيم الحالي' };
const deniedForeignEdit = sandbox.dispatchApiAction_('savePlan', {
  id: 'plan-owned-by-other', teacherId: 'teacher-1', goal: 'محاولة تعديل'
}, evaluatorSession);
assert.equal(deniedForeignEdit.success, false);
const deniedLegacyEdit = sandbox.dispatchApiAction_('savePlan', {
  id: 'plan-legacy', teacherId: 'teacher-2', goal: 'محاولة تعديل قديمة'
}, evaluatorSession);
assert.equal(deniedLegacyEdit.success, false);
const allowedOwnEdit = sandbox.dispatchApiAction_('savePlan', {
  id: 'plan-owned-by-current', teacherId: 'teacher-1', goal: 'تحديث خطتي'
}, evaluatorSession);
assert.equal(allowedOwnEdit.success, true);
const createdOwnPlan = sandbox.dispatchApiAction_('savePlan', {
  teacherId: 'teacher-2', goal: 'خطة جديدة'
}, evaluatorSession);
assert.equal(createdOwnPlan.success, true);
assert.equal(planRecords.find((item) => item.id === 'generated-plan-id').evaluatorId, evaluatorSession.id);

const deniedForeignFollowUp = sandbox.dispatchApiAction_('savePlanFollowUp', {
  planId: 'plan-owned-by-other', followUpNotes: 'محاولة متابعة'
}, evaluatorSession);
assert.equal(deniedForeignFollowUp.success, false);
const allowedOwnFollowUp = sandbox.dispatchApiAction_('savePlanFollowUp', {
  planId: 'plan-owned-by-current', followUpNotes: 'متابعة خطتي'
}, evaluatorSession);
assert.equal(allowedOwnFollowUp.success, true);

const deniedForeignDelete = sandbox.dispatchApiAction_('deletePlans', {
  ids: ['plan-owned-by-other']
}, evaluatorSession);
assert.equal(deniedForeignDelete.success, false);
const deniedBulkDelete = sandbox.dispatchApiAction_('deletePlans', { ids: [] }, evaluatorSession);
assert.equal(deniedBulkDelete.success, false);
const allowedOwnDelete = sandbox.dispatchApiAction_('deletePlans', {
  ids: ['generated-plan-id']
}, evaluatorSession);
assert.equal(allowedOwnDelete.success, true);
assert.equal(planRecords.some((item) => item.id === 'generated-plan-id'), false);

const adminDeleteAll = sandbox.dispatchApiAction_('deletePlans', {
  ids: []
}, { id: 'admin-1', schoolId, role: 'school_admin', name: 'مدير المدرسة' });
assert.equal(adminDeleteAll.success, true);
assert.equal(planRecords.length, 0);

// Existing school sheets may predate ownership fields. Verify a safe additive migration.
const legacyPlanHeaders = ['id', 'schoolId', 'teacherId', 'goal', 'status'];
const legacyPlanSheet = makeMutableSheet(legacyPlanHeaders, [
  { id: 'legacy-existing', schoolId, teacherId: 'teacher-1', goal: 'سجل محفوظ', status: 'in_progress' }
]);
const migrationResult = sandbox.ensureImprovementPlanOwnershipColumns_(legacyPlanSheet);
assert.equal(migrationResult.success, true);
assert.deepEqual(Array.from(migrationResult.added), ['evaluatorId', 'evaluatorName']);
assert.deepEqual(Array.from(legacyPlanSheet.records, (item) => item.goal), ['سجل محفوظ']);
assert.equal(legacyPlanHeaders.includes('evaluatorId'), true);
assert.equal(legacyPlanHeaders.includes('evaluatorName'), true);

console.log('PASS: evaluators can edit only plans they own; legacy plans remain management-editable');
console.log('PASS: evaluator plan creation records the authenticated owner, not a client-supplied owner');
console.log('PASS: evaluators can follow up only their own plans');
console.log('PASS: evaluators cannot delete other plans or invoke bulk school-wide deletion');
console.log('PASS: administrators retain school-wide plan deletion');

const declaredPublicFunctions = Array.from(
  fs.readFileSync('gas/Code.gs', 'utf8').matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm),
  (match) => match[1]
).filter((name) => !name.endsWith('_'));
for (const privateHelper of ['saveClassroomVisit', 'saveTeacher', 'logAuditAction', 'determineUserRole', 'authorizeMailOnce']) {
  assert.equal(declaredPublicFunctions.includes(privateHelper), false, `Sensitive helper ${privateHelper} must not be callable directly from google.script.run`);
}

mockDatabase({
  Teachers: [{ id: 'teacher-1', schoolId, fullName: 'المعلم الأول' }],
  Visits: [{ id: 'approved-visit', schoolId, teacherId: 'teacher-1', evaluatorId: 'evaluator-current', status: 'approved' }]
});
let capturedVisitPayload = null;
sandbox.saveClassroomVisit_ = (payload) => {
  capturedVisitPayload = { ...payload };
  return { success: true, visitId: payload.id };
};
const evaluatorSessionForVisit = { id: 'evaluator-current', schoolId, role: 'evaluator', name: 'المقيم الحالي' };
const deniedApprovedEdit = sandbox.dispatchApiAction_('saveVisit', {
  id: 'approved-visit', teacherId: 'teacher-1', status: 'completed'
}, evaluatorSessionForVisit);
assert.equal(deniedApprovedEdit.success, false);
const deniedClientApproval = sandbox.dispatchApiAction_('saveVisit', {
  id: 'new-unapproved-visit', teacherId: 'teacher-1', status: 'approved'
}, evaluatorSessionForVisit);
assert.equal(deniedClientApproval.success, true);
assert.equal(capturedVisitPayload.status, 'completed');

console.log('PASS: sensitive Apps Script write helpers are private from direct google.script.run calls');
console.log('PASS: evaluators cannot edit approved visits or approve a visit by forging the save status');

function loginWithStatus(status) {
  const headers = ['id', 'schoolId', 'name', 'email', 'username', 'role', 'jobNumber', 'specialization', 'status', 'passwordSalt', 'passwordHash', 'teacherId'];
  const row = ['login-user', schoolId, 'مستخدم اختبار', '', 'test.user', 'evaluator', '', '', status, 'salt', 'expected-hash', ''];
  const usersSheet = {
    getLastRow: () => 2,
    getDataRange: () => ({ getValues: () => [headers, row] })
  };
  sandbox.getDatabaseSpreadsheet_ = () => ({ getSheetByName: (name) => name === 'Users' ? usersSheet : null });
  sandbox.passwordHash_ = () => 'expected-hash';
  sandbox.logAuditAction_ = () => {};
  sandbox.Utilities = { getUuid: () => 'test-token' };
  sandbox.CacheService = { getScriptCache: () => ({ put: () => {} }) };
  return sandbox.apiLogin_({ username: 'test.user', password: 'valid-password' });
}
assert.equal(loginWithStatus(' INACTIVE ').success, false);
assert.equal(loginWithStatus('disabled').success, false);
assert.equal(loginWithStatus('pending').success, false);
assert.equal(loginWithStatus('suspended').success, false);
assert.equal(loginWithStatus('active').success, true);
assert.equal(loginWithStatus('').success, true);

console.log('PASS: login fails closed for inactive, pending, suspended, and unknown account states');



