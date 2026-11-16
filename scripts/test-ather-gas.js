'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

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
