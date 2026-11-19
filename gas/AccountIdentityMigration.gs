/**
 * أدوات تصحيح هويات حسابات أَثَر.
 *
 * آمنة افتراضياً:
 * - previewAccountIdentityMigration_() قراءة فقط.
 * - applyAccountIdentityMigration_(confirmation) يكتب فقط عند تمرير عبارة التأكيد الدقيقة.
 * - لا تحذف أي صف، ولا تعدّل CentralUsers، ولا تنسخ كلمات مرور أو hashes.
 *
 * يجب مراجعة نتيجة المعاينة قبل التطبيق على قاعدة البيانات.
 */
var ATHAR_ACCOUNT_MIGRATION_CONFIRMATION_ = 'أوافق على تصحيح هويات حسابات أَثَر';

function atharAccountMigrationConfig_() {
  return {
    spreadsheetId: '1AbFN87suCPIJL5-mqmAQIEgpvon2pXMri9L9b8AwcYLM',
    schoolId: 'sch_alsadara_01',
    people: [
      { name: 'مريم محمد سيف سالم النيادي', username: 'principal', role: 'school_admin', visitorRole: 'principal' },
      { name: 'صالحه مبارك محمد عبدالله البلوشي', username: 'arabic', role: 'evaluator', visitorRole: 'evaluator' },
      { name: 'الأستاذة: عائشة الغفلي', username: 'aisha', role: 'evaluator', visitorRole: 'evaluator' },
      { name: 'طلال معتوق على سعيد النعيمي', username: 'vp', role: 'vice_principal', visitorRole: 'vice_principal' }
    ],
    platformAdmin: {
      name: 'مسؤول منصة أَثَر',
      username: 'ather',
      role: 'platform_admin',
      schoolId: 'sch_alsadara_01',
      status: 'inactive'
    }
  };
}

function atharMigrationHeaderIndex_(headers, name) {
  return headers.indexOf(name);
}

function atharMigrationCell_(row, headers, name) {
  var i = atharMigrationHeaderIndex_(headers, name);
  return i < 0 ? '' : String(row[i] == null ? '' : row[i]).trim();
}

function previewAccountIdentityMigration_() {
  var cfg = atharAccountMigrationConfig_();
  var ss = SpreadsheetApp.openById(cfg.spreadsheetId);
  var users = ss.getSheetByName('Users');
  var visitors = ss.getSheetByName('RegisteredVisitors');
  if (!users || !visitors) {
    return { success: false, blockers: ['ورقة Users أو RegisteredVisitors غير موجودة.'] };
  }

  var userValues = users.getDataRange().getValues();
  var visitorValues = visitors.getDataRange().getValues();
  if (userValues.length < 1 || visitorValues.length < 1) {
    return { success: false, blockers: ['تعذر قراءة عناوين الأعمدة.'] };
  }
  var uh = userValues[0].map(function(v) { return String(v).trim(); });
  var vh = visitorValues[0].map(function(v) { return String(v).trim(); });
  var requiredUsers = ['id', 'schoolId', 'name', 'role', 'status', 'username'];
  var requiredVisitors = ['id', 'schoolId', 'name', 'role', 'username'];
  var blockers = [];
  requiredUsers.forEach(function(k) { if (uh.indexOf(k) < 0) blockers.push('عمود Users مفقود: ' + k); });
  requiredVisitors.forEach(function(k) { if (vh.indexOf(k) < 0) blockers.push('عمود RegisteredVisitors مفقود: ' + k); });
  if (blockers.length) return { success: false, blockers: blockers };

  var userRows = userValues.slice(1);
  var idCounts = {};
  var usernameRows = {};
  userRows.forEach(function(row, i) {
    var id = atharMigrationCell_(row, uh, 'id');
    var username = atharMigrationCell_(row, uh, 'username').toLowerCase();
    if (id) idCounts[id] = (idCounts[id] || 0) + 1;
    if (username) {
      if (!usernameRows[username]) usernameRows[username] = [];
      usernameRows[username].push({ rowNumber: i + 2, name: atharMigrationCell_(row, uh, 'name'), id: id });
    }
  });
  Object.keys(idCounts).forEach(function(id) {
    if (idCounts[id] > 1) blockers.push('معرّف مستخدم مكرر في Users: ' + id);
  });
  Object.keys(usernameRows).forEach(function(username) {
    if (usernameRows[username].length > 1) blockers.push('اسم مستخدم مكرر في Users: ' + username);
  });

  var plannedUserUpdates = [];
  var plannedUserCreates = [];
  cfg.people.forEach(function(person) {
    var matches = [];
    userRows.forEach(function(row, i) {
      if (atharMigrationCell_(row, uh, 'name') === person.name &&
          atharMigrationCell_(row, uh, 'schoolId') === cfg.schoolId) {
        matches.push({ row: row, rowNumber: i + 2 });
      }
    });
    if (person.username === 'vp' && matches.length === 0) {
      plannedUserCreates.push({ name: person.name, username: person.username, role: person.role, status: 'inactive', reason: 'إنشاء حساب مستقل بلا كلمة مرور' });
    } else if (matches.length !== 1) {
      blockers.push('يجب أن يوجد سجل Users واحد فقط للاسم "' + person.name + '"؛ الموجود: ' + matches.length);
    } else {
      var match = matches[0];
      var occupied = usernameRows[person.username] || [];
      occupied.forEach(function(entry) {
        if (entry.rowNumber !== match.rowNumber && entry.name !== 'صالحه مبارك محمد عبدالله البلوشي') {
          blockers.push('اسم المستخدم المستهدف "' + person.username + '" محجوز لسجل آخر: ' + entry.name);
        }
      });
      plannedUserUpdates.push({
        rowNumber: match.rowNumber,
        name: person.name,
        fromUsername: atharMigrationCell_(match.row, uh, 'username'),
        toUsername: person.username,
        fromRole: atharMigrationCell_(match.row, uh, 'role'),
        toRole: person.role
      });
    }
  });

  var adminMatches = [];
  userRows.forEach(function(row, i) {
    if (atharMigrationCell_(row, uh, 'name') === cfg.platformAdmin.name &&
        atharMigrationCell_(row, uh, 'schoolId') === cfg.schoolId) {
      adminMatches.push({ row: row, rowNumber: i + 2 });
    }
  });
  var adminUsernameRows = usernameRows[cfg.platformAdmin.username] || [];
  if (adminMatches.length > 1) {
    blockers.push('يوجد أكثر من سجل لمسؤول المنصة في Users.');
  } else if (adminMatches.length === 1) {
    plannedUserUpdates.push({
      rowNumber: adminMatches[0].rowNumber,
      name: cfg.platformAdmin.name,
      fromUsername: atharMigrationCell_(adminMatches[0].row, uh, 'username'),
      toUsername: cfg.platformAdmin.username,
      fromRole: atharMigrationCell_(adminMatches[0].row, uh, 'role'),
      toRole: cfg.platformAdmin.role
    });
  } else {
    adminUsernameRows.forEach(function(entry) {
      if (entry.name !== 'صالحه مبارك محمد عبدالله البلوشي') {
        blockers.push('اسم المستخدم ather محجوز لسجل غير متوقع: ' + entry.name);
      }
    });
    plannedUserCreates.push({
      name: cfg.platformAdmin.name,
      username: cfg.platformAdmin.username,
      role: cfg.platformAdmin.role,
      status: 'inactive',
      reason: 'حساب مستقل جديد؛ لا تُنسخ إليه بيانات اعتماد CentralUsers المتعارضة'
    });
  }

  var visitorUpdates = [];
  visitorValues.slice(1).forEach(function(row, i) {
    if (atharMigrationCell_(row, vh, 'schoolId') !== cfg.schoolId) return;
    var name = atharMigrationCell_(row, vh, 'name');
    var person = cfg.people.filter(function(p) { return p.name === name; })[0];
    if (!person) return;
    visitorUpdates.push({
      rowNumber: i + 2,
      id: atharMigrationCell_(row, vh, 'id'),
      name: name,
      fromUsername: atharMigrationCell_(row, vh, 'username'),
      toUsername: person.username,
      fromRole: atharMigrationCell_(row, vh, 'role'),
      toRole: person.visitorRole
    });
  });

  return {
    success: blockers.length === 0,
    readOnly: true,
    blockers: blockers,
    userUpdates: plannedUserUpdates,
    userCreates: plannedUserCreates,
    visitorUpdates: visitorUpdates,
    preserved: ['جميع الصفوف الحالية', 'قيم كلمات المرور وpasswordSalt وpasswordHash', 'سجلات CentralUsers', 'سجلات الزيارات والتقييمات'],
    note: 'الحسابات الجديدة ستكون inactive حتى يعيّن المسؤول كلمة مرور آمنة. لا يتم تفعيلها تلقائياً.'
  };
}

function applyAccountIdentityMigration_(confirmation) {
  if (confirmation !== ATHAR_ACCOUNT_MIGRATION_CONFIRMATION_) {
    return { success: false, error: 'لم يتم التطبيق: عبارة التأكيد غير مطابقة.' };
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return { success: false, error: 'تعذر الحصول على قفل قاعدة البيانات؛ لم يتم إجراء أي تعديل.' };
  }
  try {
    var preview = previewAccountIdentityMigration_();
    if (!preview.success) {
      return { success: false, applied: false, blockers: preview.blockers, message: 'أُوقف التطبيق بسبب تعارضات يجب مراجعتها.' };
    }

    var cfg = atharAccountMigrationConfig_();
    var ss = SpreadsheetApp.openById(cfg.spreadsheetId);
    var users = ss.getSheetByName('Users');
    var visitors = ss.getSheetByName('RegisteredVisitors');
    var uh = users.getRange(1, 1, 1, users.getLastColumn()).getValues()[0].map(function(v) { return String(v).trim(); });
    var vh = visitors.getRange(1, 1, 1, visitors.getLastColumn()).getValues()[0].map(function(v) { return String(v).trim(); });

    function setByHeader(sheet, headers, rowNumber, key, value) {
      var col = headers.indexOf(key);
      if (col >= 0) sheet.getRange(rowNumber, col + 1).setValue(value);
    }

    preview.userUpdates.forEach(function(item) {
      setByHeader(users, uh, item.rowNumber, 'username', item.toUsername);
      setByHeader(users, uh, item.rowNumber, 'role', item.toRole);
    });

    preview.userCreates.forEach(function(item) {
      var newRow = new Array(uh.length).fill('');
      function put(key, value) { var col = uh.indexOf(key); if (col >= 0) newRow[col] = value; }
      put('id', Utilities.getUuid());
      put('schoolId', cfg.schoolId);
      put('name', item.name);
      put('role', item.role);
      put('status', 'inactive');
      put('createdAt', new Date());
      put('username', item.username);
      // Deliberately leave email, teacherId, passwordSalt and passwordHash empty.
      users.appendRow(newRow);
    });

    preview.visitorUpdates.forEach(function(item) {
      setByHeader(visitors, vh, item.rowNumber, 'username', item.toUsername);
      setByHeader(visitors, vh, item.rowNumber, 'role', item.toRole);
    });

    if (typeof invalidatePublicEvaluatorCache_ === 'function') invalidatePublicEvaluatorCache_();
    return {
      success: true,
      applied: true,
      userAccountsUpdated: preview.userUpdates.length,
      userAccountsCreatedInactive: preview.userCreates.length,
      visitorRowsUpdated: preview.visitorUpdates.length,
      message: 'اكتمل تحديث الهويات دون حذف صفوف أو تغيير بيانات كلمات المرور. الحسابات الجديدة غير مفعّلة.'
    };
  } catch (err) {
    return { success: false, applied: false, error: String(err && err.message ? err.message : err) };
  } finally {
    lock.releaseLock();
  }
}
