/**
 * @file Code.gs
 * @description خادم منصة «أَثَر» - منظومة التميز والتطوير التعليمي
 * «نَرْصُدُ الأَدَاءَ... وَنَصْنَعُ الأَثَرَ»
 * Google Apps Script Web App Backend & Google Sheets Database Architecture
 */

// ==========================================
// 1. الدخول وعرض واجهة الويب (Web App Entry)
// ==========================================

function doGet(e) {
  if (e && e.parameter && e.parameter.bridge === '1') {
    return HtmlService.createHtmlOutputFromFile('Bridge')
      .setTitle('Athar Secure Bridge')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  var template = HtmlService.createTemplateFromFile('Index');
  template.platformTitle = "أَثَر | منظومة التميز والتطوير التعليمي";
  template.schoolName = "مدرسة الصدارة بنين - الحلقة الثانية";
  
  return template.evaluate()
    .setTitle('أَثَر | منظومة التميز والتطوير التعليمي')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Returns the single persistent database spreadsheet for this Apps Script project.
 * Web apps do not reliably have an active spreadsheet, so the created spreadsheet ID
 * must be stored in Script Properties and reopened by ID on every request.
 */
function getDatabaseSpreadsheet_() {
  var properties = PropertiesService.getScriptProperties();
  var spreadsheetId = properties.getProperty('ATHAR_DATABASE_SPREADSHEET_ID');
  if (!spreadsheetId) {
    // Use the existing school database rather than silently creating a second database.
    spreadsheetId = '1AbFN87suCPIJL5-mqmAQIEgpvon2pXMriL9b8AwcYLM';
    properties.setProperty('ATHAR_DATABASE_SPREADSHEET_ID', spreadsheetId);
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

// ====================================================
// 2. تهيئة قاعدة البيانات وأوراق العمل (19 ورقة عمل)
// ====================================================

function initializeDatabase() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: 'قاعدة البيانات مشغولة حالياً. حاول مرة أخرى.' }; // 30 seconds wait
  
  try {
    var ss = getDatabaseSpreadsheet_();
    if (!ss) {
      ss = SpreadsheetApp.create("أَثَر - قاعدة بيانات منظومة التميز والتطوير التعليمي");
      PropertiesService.getScriptProperties().setProperty('ATHAR_DATABASE_SPREADSHEET_ID', ss.getId());
    }
    
    var sheetsSchema = {
      'Users': ['id', 'schoolId', 'name', 'email', 'role', 'jobNumber', 'specialization', 'status', 'createdAt', 'username', 'teacherId', 'roleTitle', 'department', 'profileSummary', 'avatarUrl'],
      'RegisteredVisitors': ['id', 'schoolId', 'name', 'role', 'roleTitle', 'department', 'jobNumber', 'email', 'phone', 'username', 'status', 'createdAt'],
      'Schools': ['id', 'name', 'code', 'stage', 'welcomeMessage', 'primaryColor', 'secondaryColor', 'contactEmail', 'contactPhone'],
      'Teachers': ['id', 'schoolId', 'fullName', 'jobNumber', 'specialization', 'status', 'email', 'phone', 'dateAdded'],
      'Visits': ['id', 'schoolId', 'academicYear', 'term', 'visitType', 'teacherId', 'teacherName', 'teacherJobNumber', 'teacherSpecialization', 'grade', 'section', 'subject', 'evaluatorId', 'evaluatorName', 'date', 'time', 'visitGoal', 'status', 'achievementPercentage', 'observedCount', 'totalCount', 'eLearningMaturity', 'strengths', 'improvementAreas', 'recommendations', 'createdAt', 'updatedAt'],
      'VisitIndicators': ['id', 'visitId', 'indicatorId', 'indicatorText', 'group', 'rating', 'notes', 'timestamp'],
      'VisitDomains': ['id', 'visitId', 'domainId', 'domainName', 'rating'],
      'IndicatorLibrary': ['id', 'code', 'group', 'text', 'description', 'isActive'],
      'EvaluationDomains': ['id', 'code', 'name', 'description'],
      'Subjects': ['id', 'schoolId', 'name', 'isActive'],
      'Grades': ['id', 'schoolId', 'name', 'isActive'],
      'Sections': ['id', 'schoolId', 'name', 'isActive'],
      'AcademicYears': ['id', 'schoolId', 'yearLabel', 'isCurrent'],
      'Terms': ['id', 'schoolId', 'termName', 'isCurrent'],
      'ImprovementPlans': ['id', 'schoolId', 'teacherId', 'teacherName', 'teacherJobNumber', 'improvementArea', 'relatedIndicator', 'goal', 'procedure', 'responsible', 'duration', 'followUpDate', 'status', 'createdAt'],
      'PlanFollowUps': ['id', 'planId', 'followUpDate', 'evaluatorName', 'result', 'notes', 'newStatus', 'recordedAt'],
      'Settings': ['key', 'value', 'updatedAt', 'updatedBy'],
      'AuditLog': ['id', 'schoolId', 'timestamp', 'userName', 'userRole', 'action', 'details'],
      'ReportTemplates': ['id', 'templateName', 'layoutJson', 'isDefault'],
      'InternalNotes': ['id', 'schoolId', 'teacherId', 'teacherName', 'visitId', 'noteText', 'createdBy', 'createdByRole', 'createdAt', 'updatedBy', 'updatedByRole', 'updatedAt', 'status'],
      'InternalNoteHistory': ['id', 'schoolId', 'noteId', 'changedBy', 'changedByRole', 'changedAt', 'oldText', 'newText'],
      'AdministrativeFollowUps': ['id', 'schoolId', 'teacherId', 'teacherName', 'visitId', 'followUpDate', 'action', 'notes', 'recommendations', 'result', 'nextAction', 'nextDate', 'status', 'createdBy', 'createdByRole', 'createdAt', 'updatedAt'],
      'VisitHistory': ['id', 'schoolId', 'visitId', 'changedBy', 'changedByRole', 'changedAt', 'action', 'snapshotJson']
    };

    var results = [];
    for (var sheetName in sheetsSchema) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        var headers = sheetsSchema[sheetName];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        // تجميد وتنسيق الصف الأول
        sheet.setFrozenRows(1);
        sheet.getRange(1, 1, 1, headers.length)
          .setBackground('#172C40')
          .setFontColor('#FFFFFF')
          .setFontWeight('bold');
        results.push("تم إنشاء ورقة العمل: " + sheetName);
      } else {
        results.push("ورقة العمل موجودة مسبقاً: " + sheetName);
      }
    }
    
    // Ensure the destination has password columns before importing legacy account hashes.
    migrateUserPasswordColumns();

    // Import existing central users once, without deleting or modifying the source sheet.
    var userMigration = migrateCentralUsersToUsers_(ss);

    // إدخال البيانات الأولية إذا كانت ورقة المؤشرات فارغة
    seedInitialDataIfEmpty(ss);
    
    return {
      success: true,
      message: "تمت تهيئة قاعدة بيانات أَثَر وأوراق العمل المطلوبة بنجاح.",
      userMigration: userMigration,
      spreadsheetUrl: ss.getUrl(),
      details: results
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
/**
 * Copies existing CentralUsers accounts into the normalized Users table.
 * Source rows are preserved. Unknown roles are skipped and reported.
 * Password hashes are copied only when both hash and salt exist.
 */
function migrateCentralUsersToUsers_(ss) {
  var source = ss.getSheetByName('CentralUsers');
  var target = ss.getSheetByName('Users');
  if (!source || !target || source.getLastRow() < 2) return { imported: 0, skipped: 0, reason: 'لا توجد حسابات مصدر للترحيل.' };
  var src = source.getDataRange().getValues();
  var sh = src[0].map(function(x) { return String(x).trim(); });
  var dst = target.getDataRange().getValues();
  var dh = dst[0].map(function(x) { return String(x).trim(); });
  function ix(headers, name) { return headers.indexOf(name); }
  var required = ['userId', 'username', 'name', 'role', 'schoolId'];
  if (required.some(function(k) { return ix(sh, k) < 0; })) {
    return { imported: 0, skipped: src.length - 1, reason: 'أعمدة CentralUsers لا تطابق مخطط الترحيل المتوقع.' };
  }
  var known = {
    platform_admin: 'platform_admin', admin: 'platform_admin',
    school_admin: 'school_admin', principal: 'school_admin',
    vice_principal: 'vice_principal', assistant_principal: 'vice_principal',
    evaluator: 'evaluator', observer: 'evaluator', teacher: 'teacher'
  };
  var existing = {};
  dst.slice(1).forEach(function(row) {
    var u = String(row[ix(dh, 'username')] || '').trim().toLowerCase();
    if (u) existing[u] = true;
  });
  var imported = 0, skipped = 0, rows = [];
  for (var i = 1; i < src.length; i++) {
    var row = src[i];
    var username = String(row[ix(sh, 'username')] || '').trim();
    if (!username || existing[username.toLowerCase()]) { skipped++; continue; }
    var rawRole = String(row[ix(sh, 'role')] || '').trim().toLowerCase();
    var role = known[rawRole];
    if (!role) { skipped++; continue; }
    var obj = {
      id: String(row[ix(sh, 'userId')] || Utilities.getUuid()),
      schoolId: String(row[ix(sh, 'schoolId')] || 'sch_alsadara_01'),
      name: String(row[ix(sh, 'name')] || ''),
      email: '',
      role: role,
      jobNumber: ix(sh, 'jobNumber') >= 0 ? String(row[ix(sh, 'jobNumber')] || '') : '',
      specialization: '',
      status: 'active',
      createdAt: new Date().toISOString(),
      username: username,
      teacherId: '',
      passwordSalt: ix(sh, 'salt') >= 0 ? String(row[ix(sh, 'salt')] || '') : '',
      passwordHash: ix(sh, 'passwordHash') >= 0 ? String(row[ix(sh, 'passwordHash')] || '') : ''
    };
    rows.push(dh.map(function(h) { return Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : ''; }));
    existing[username.toLowerCase()] = true;
    imported++;
  }
  if (rows.length) target.getRange(target.getLastRow() + 1, 1, rows.length, dh.length).setValues(rows);
  return { imported: imported, skipped: skipped, source: 'CentralUsers' };
}

// 3. بذر البيانات الأولية (Seeding)
// ==========================================

function seedInitialDataIfEmpty(ss) {
  var indSheet = ss.getSheetByName('IndicatorLibrary');
  if (indSheet && indSheet.getLastRow() <= 1) {
    var indicators = [
      ['IND-01', 'التخطيط والاستعداد', 'مشاركة القوانين الصفية.', 'إيضاح وتفعيل القواعد الإيجابية', true],
      ['IND-02', 'التخطيط والاستعداد', 'مشاركة المخرجات التعليمية مع الطلبة بوضوح.', 'صياغة وعرض نواتج التعلم', true],
      ['IND-03', 'التخطيط والاستعداد', 'التهيئة الحافزة.', 'إثارة دافعية الطلبة', true],
      ['IND-04', 'المشاركة والتفاعل', 'إعطاء جميع الطلبة فرصة للمشاركة.', 'إتاحة فرص متكافئة', true],
      ['IND-05', 'التخطيط والاستعداد', 'مشاركة المفاهيم والمفردات الأساسية في الدرس.', 'استيعاب المفردات الجديدة', true],
      ['IND-06', 'المشاركة والتفاعل', 'تشجيع الطلبة على طرح الأسئلة.', 'تحفيز الفضول والتفكير', true],
      ['IND-07', 'الممارسات التدريسية', 'طرح أسئلة مختلفة المستويات.', 'التدرج المعرفي وفق بلوم', true],
      ['IND-08', 'الممارسات التدريسية', 'استخدام تقييم الأقران.', 'مراجعة الطلبة لأعمال زملائهم', true],
      ['IND-09', 'الممارسات التدريسية', 'وجود أنشطة تلبي احتياجات الطلبة المختلفة.', 'تمايز التعليم', true],
      ['IND-10', 'المشاركة والتفاعل', 'تحفيز الطلبة بطرق مختلفة.', 'تنويع أساليب التعزيز', true],
      ['IND-11', 'المشاركة والتفاعل', 'إعطاء الطلبة فرصة للقراءة خلال الحصة.', 'ممارسة القراءة الصامتة والجهرية', true],
      ['IND-12', 'المشاركة والتفاعل', 'إعطاء الطلبة فرصة للكتابة خلال الحصة.', 'الكتابة والتدوين التفسيري', true],
      ['IND-13', 'الممارسات التدريسية', 'استخدام مصادر تعلم مختلفة.', 'وسائط ونصوص ومجسمات إثرائية', true],
      ['IND-14', 'الممارسات التدريسية', 'توظيف التكنولوجيا من قبل المعلم.', 'شاشات ومنصات تفاعلية', true],
      ['IND-15', 'الممارسات التدريسية', 'وجود خاتمة للدرس.', 'غلق الدرس وتلخيص المعرفة', true],
      ['IND-16', 'الربط والتكامل', 'الربط بالحياة الواقعية للطلبة والخبرات التعليمية السابقة والمواد الأخرى.', 'أمثلة واقعية إماراتية', true],
      ['IND-17', 'بيئة التعلم', 'وجود روتين لإدارة البيئة الصفية.', 'سلاسة الحركة والنظام', true],
      ['IND-18', 'بيئة التعلم', 'توظيف التكنولوجيا من قبل الطلبة.', 'استخدام الأجهزة اللوحية', true],
      ['IND-19', 'بيئة التعلم', 'إدارة وقت الحصة بفعالية.', 'التوازن الدقيق بين الأنشطة', true],
      ['IND-20', 'الممارسات التدريسية', 'كيف كان تقدم الطلبة؟', 'رصد التطور الفعلي للفهم', true],
      ['IND-21', 'الممارسات التدريسية', 'كيف كانت التغذية الراجعة التي قام المعلم بتزويدها للطلبة؟', 'توجيهات نوعية فورية', true],
      ['IND-22', 'الربط والتكامل', 'الربط بالهوية الوطنية.', 'ترسيخ قيم التسامح والانتماء', true]
    ];
    
    var rows = indicators.map(function(row, idx) {
      return [Utilities.getUuid(), row[0], row[1], row[2], row[3], row[4]];
    });
    indSheet.getRange(2, 1, rows.length, 6).setValues(rows);
  }
}

// ==========================================
// 4. استرجاع البيانات المبدئية (Bootstrap)
// ==========================================

function getBootstrapData() {
  try {
    var ss = getDatabaseSpreadsheet_();
    if (!ss) {
      return { success: false, error: 'لم يتم العثور على جدول البيانات النشط. يُرجى تشغيل initializeDatabase().' };
    }

    var userEmail = Session.getActiveUser().getEmail();
    var userRole = determineUserRole(userEmail);
    if (!userRole) {
      return { success: false, error: 'تعذر التحقق من هوية المستخدم أو لا يوجد حساب معتمد لهذا البريد. لم يتم منح أي صلاحية.' };
    }

    var teachersSheet = ss.getSheetByName('Teachers');
    var visitsSheet = ss.getSheetByName('Visits');
    var plansSheet = ss.getSheetByName('ImprovementPlans');
    var indicatorsSheet = ss.getSheetByName('IndicatorLibrary');
    var settingsSheet = ss.getSheetByName('Settings');
    return {
      success: true,
      currentUser: {
        email: userEmail,
        role: userRole,
        name: userEmail.split('@')[0]
      },
      schoolName: 'مدرسة الصدارة بنين - الحلقة الثانية',
      platformName: 'أَثَر',
      slogan: '«نَرْصُدُ الأَدَاءَ... وَنَصْنَعُ الأَثَرَ»',
      data: {
        teachersCount: teachersSheet ? Math.max(0, teachersSheet.getLastRow() - 1) : 0,
        visitsCount: visitsSheet ? Math.max(0, visitsSheet.getLastRow() - 1) : 0,
        plansCount: plansSheet ? Math.max(0, plansSheet.getLastRow() - 1) : 0,
        indicatorsCount: indicatorsSheet ? Math.max(0, indicatorsSheet.getLastRow() - 1) : 0,
        settingsConfigured: !!(settingsSheet && settingsSheet.getLastRow() > 1)
      }
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function determineUserRole(email) {
  // Fail closed: an absent, unlisted, or disabled account never receives admin rights.
  if (!email || typeof email !== 'string') return null;
  var ss = getDatabaseSpreadsheet_();
  if (!ss) return null;
  var usersSheet = ss.getSheetByName('Users');
  if (!usersSheet || usersSheet.getLastRow() <= 1) return null;

  var data = usersSheet.getDataRange().getValues();
  var normalizedEmail = email.trim().toLowerCase();
  for (var i = 1; i < data.length; i++) {
    var storedEmail = data[i][3] ? data[i][3].toString().trim().toLowerCase() : '';
    var status = data[i][7] ? data[i][7].toString().trim().toLowerCase() : 'active';
    if (storedEmail && storedEmail === normalizedEmail && status !== 'inactive' && status !== 'disabled') {
      var role = data[i][4] ? data[i][4].toString().trim() : '';
      var allowedRoles = ['platform_admin', 'school_admin', 'vice_principal', 'evaluator', 'teacher'];
      return allowedRoles.indexOf(role) >= 0 ? role : null;
    }
  }
  return null;
}

// ====================================================
// 5. حفظ واسترجاع الزيارات (Visits Management)
// ====================================================

function saveClassroomVisit(visitData) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { success: false, error: 'هناك عملية حفظ أخرى قيد التنفيذ. حاول مرة أخرى.' };
  
  try {
    var ss = getDatabaseSpreadsheet_();
    if (!ss) {
      throw new Error('قاعدة البيانات غير مهيأة. شغّل initializeDatabase() مرة واحدة من محرر Apps Script قبل استخدام المنصة.');
    }
    var visitsSheet = ss.getSheetByName('Visits');
    var indSheet = ss.getSheetByName('VisitIndicators');
    
    if (!visitsSheet || !indSheet) {
      throw new Error('أوراق الزيارات غير موجودة. شغّل initializeDatabase() من محرر Apps Script.');
    }

    // حساب نسبة الإنجاز مع استبعاد "لم يُشاهد" تماماً
    var indicators = visitData.indicators || [];
    var scoreTotal = 0;
    var observedCount = 0;
    var ratingScores = { outstanding: 5, very_good: 4, good: 3, acceptable: 2, needs_improvement: 2, weak: 1, no: 1, yes: 5 };
    for (var i = 0; i < indicators.length; i++) {
      var rating = String(indicators[i].rating || '');
      if (rating === 'not_observed') continue;
      if (Object.prototype.hasOwnProperty.call(ratingScores, rating)) {
        scoreTotal += ratingScores[rating];
        observedCount++;
      }
    }
    var achPct = observedCount > 0 ? Math.round((scoreTotal / (observedCount * 5)) * 1000) / 10 : 0;

    var visitId = visitData.id || ('VST-' + new Date().getFullYear() + '-' + Utilities.getUuid().substring(0, 5).toUpperCase());
    var timestamp = new Date().toISOString();

    var visitRow = [
      visitId,
      visitData.schoolId || 'sch_alsadara_01',
      visitData.academicYear,
      visitData.term,
      visitData.visitType,
      visitData.teacherId,
      visitData.teacherName,
      visitData.teacherJobNumber,
      visitData.teacherSpecialization,
      visitData.grade,
      visitData.section,
      visitData.subject,
      visitData.evaluatorId,
      visitData.evaluatorName,
      visitData.date,
      visitData.time,
      visitData.visitGoal,
      visitData.status || 'completed',
      achPct,
      observedCount,
      indicators.length,
      visitData.eLearningMaturity || 'good',
      JSON.stringify(visitData.strengths || []),
      JSON.stringify(visitData.improvementAreas || []),
      visitData.practicalRecommendations || '',
      timestamp,
      timestamp
    ];

    // التحقق هل الزيارة موجودة للتعديل
    var data = visitsSheet.getDataRange().getValues();
    var existingRowIndex = -1;
    for (var r = 1; r < data.length; r++) {
      if (data[r][0] === visitId) {
        existingRowIndex = r + 1;
        break;
      }
    }

    if (existingRowIndex > 0) {
      if (String(data[existingRowIndex - 1][1]) !== String(visitData.schoolId || 'sch_alsadara_01')) {
        throw new Error('لا يمكن تعديل زيارة لا تتبع المدرسة المرتبطة بحسابك.');
      }
      visitRow[25] = data[existingRowIndex - 1][25]; // keep original createdAt
      recordVisitSnapshot_(ss, visitId, data[existingRowIndex - 1], data[0].map(String), String(visitData.schoolId || 'sch_alsadara_01'), visitData.actorName || visitData.evaluatorName, visitData.actorRole || visitData.evaluatorRole, 'تعديل التقرير');
      visitsSheet.getRange(existingRowIndex, 1, 1, visitRow.length).setValues([visitRow]);
    } else {
      visitsSheet.appendRow(visitRow);
    }

    // عند تعديل زيارة موجودة، احذف تفاصيل مؤشرّاتها السابقة أولاً حتى لا تتكرر.
    if (existingRowIndex > 0 && indSheet.getLastRow() > 1) {
      var indicatorRows = indSheet.getDataRange().getValues();
      for (var ir = indicatorRows.length - 1; ir >= 1; ir--) {
        if (indicatorRows[ir][1] === visitId) {
          indSheet.deleteRow(ir + 1);
        }
      }
    }

    // حفظ تفاصيل المؤشرات الحالية
    for (var k = 0; k < indicators.length; k++) {
      var ind = indicators[k];
      var indRow = [Utilities.getUuid(), visitId, ind.indicatorId, ind.indicatorText, ind.indicatorGroup, ind.rating, ind.notes || '', timestamp];
      indSheet.appendRow(indRow);
    }

    // حفظ تقييمات المجالات العشرة المرتبطة بالزيارة.
    var domainsSheet = ss.getSheetByName('VisitDomains');
    if (domainsSheet && existingRowIndex > 0 && domainsSheet.getLastRow() > 1) {
      var oldDomainRows = domainsSheet.getDataRange().getValues();
      for (var di = oldDomainRows.length - 1; di >= 1; di--) if (String(oldDomainRows[di][1]) === String(visitId)) domainsSheet.deleteRow(di + 1);
    }
    if (domainsSheet && visitData.domains && visitData.domains.length) {
      var domainRows = visitData.domains.map(function(domain) {
        return [Utilities.getUuid(), visitId, domain.domainId, domain.domainName, domain.rating];
      });
      domainsSheet.getRange(domainsSheet.getLastRow() + 1, 1, domainRows.length, 5).setValues(domainRows);
    }

    // تسجيل العملية في AuditLog
    logAuditAction(visitData.schoolId || 'sch_alsadara_01', visitData.actorName || visitData.evaluatorName, 'حفظ زيارة صفية', 'حفظ زيارة للمعلم: ' + visitData.teacherName + ' بنسبة إنجاز ' + achPct + '%', visitData.actorRole || visitData.evaluatorRole);

    return {
      success: true,
      visitId: visitId,
      achievementPercentage: achPct,
      message: 'تم حفظ الزيارة بنجاح في Google Sheets.'
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 6. إضافة المعلم والتحقق من التكرار
// ==========================================

function saveTeacher(teacherData) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { success: false, error: 'هناك عملية حفظ أخرى قيد التنفيذ. حاول مرة أخرى.' };
  
  try {
    var ss = getDatabaseSpreadsheet_();
    if (!ss) {
      throw new Error('قاعدة البيانات غير مهيأة. شغّل initializeDatabase() يدويًا مرة واحدة من محرر Apps Script، ثم أعد المحاولة.');
    }
    var sheet = ss.getSheetByName('Teachers');
    if (!sheet) {
      throw new Error('ورقة المعلمين غير موجودة. شغّل initializeDatabase() من محرر Apps Script.');
    }

    var jobNumber = teacherData.jobNumber.toString().trim();
    var fullName = teacherData.fullName.trim();
    var specialization = teacherData.specialization.trim();

    if (!jobNumber || !fullName || !specialization) {
      return { success: false, error: 'الاسم والرقم الوظيفي والتخصص حقول إلزامية.' };
    }

    var data = sheet.getDataRange().getValues();
    var targetSchoolId = String(teacherData.schoolId || 'sch_alsadara_01');
    var existingRowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) !== targetSchoolId) continue;
      if (teacherData.id && String(data[i][0]) === String(teacherData.id)) existingRowIndex = i + 1;
      if (data[i][3] && String(data[i][3]).trim() === jobNumber && String(data[i][0]) !== String(teacherData.id || '')) {
        return { success: false, error: 'الرقم الوظيفي (' + jobNumber + ') مستخدم مسبقاً لمعلم آخر في المدرسة.' };
      }
    }
    if (teacherData.id && existingRowIndex < 0) {
      return { success: false, error: 'لا يمكن تعديل معلم غير موجود في المدرسة المرتبطة بالحساب.' };
    }

    var teacherId = teacherData.id || ('tch_' + Utilities.getUuid().substring(0, 8));
    var dateAdded = teacherData.dateAdded || new Date().toISOString().split('T')[0];

    var newRow = [
      teacherId,
      targetSchoolId,
      fullName,
      jobNumber,
      specialization,
      teacherData.status || 'active',
      teacherData.email || '',
      teacherData.phone || '',
      dateAdded
    ];

    if (existingRowIndex > 0) {
      sheet.getRange(existingRowIndex, 1, 1, newRow.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }

    logAuditAction(teacherData.schoolId || 'sch_alsadara_01', teacherData.actorName || 'مسؤول النظام', 'حفظ بيانات معلم', 'تم حفظ المعلم: ' + fullName + ' (' + jobNumber + ')', teacherData.actorRole);

    return {
      success: true,
      teacherId: teacherId,
      message: 'تم حفظ بيانات المعلم بنجاح.'
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 7. سجل التدقيق والأمان
// ==========================================

function logAuditAction(schoolId, userName, action, details, userRole) {
  try {
    var ss = getDatabaseSpreadsheet_();
    var sheet = ss.getSheetByName('AuditLog');
    if (sheet) {
      var row = [
        Utilities.getUuid(),
        schoolId,
        new Date().toISOString(),
        userName,
        userRole || 'مستخدم المنصة',
        action,
        details
      ];
      sheet.appendRow(row);
    }
  } catch (e) {
    console.error("Audit log error:", e);
  }
}


// ====================================================
// 8. واجهة API مركزية للمنصة الخارجية (React)
// ====================================================
// ملاحظة أمنية: لا تُفعّل هذه الواجهة قبل إعداد كلمات مرور المستخدمين.
// لا تُرجع كلمات المرور أو بصماتها مطلقاً إلى المتصفح.

function doPost(e) {
  try {
    var raw = e && e.parameter && e.parameter.payload
      ? e.parameter.payload
      : (e && e.postData && e.postData.contents ? e.postData.contents : '{}');
    var request = JSON.parse(raw);
    var action = String(request.action || '');
    var payload = request.payload || {};

    if (action === 'login') return jsonResponse_(apiLogin_(payload));
    if (action === 'health') return jsonResponse_({ success: true, service: 'athar-api', timestamp: new Date().toISOString() });
    // Public, read-only evaluator directory. Never expose usernames, emails, passwords, or account identifiers.
    if (action === 'publicEvaluators') {
      var publicSs = getDatabaseSpreadsheet_();
      var publicUsers = rowsAsObjects_(publicSs.getSheetByName('Users'));
      var publicSchoolId = 'sch_alsadara_01';
      var publicEvaluators = publicUsers.filter(function(u) {
        return String(u.schoolId || publicSchoolId) === publicSchoolId &&
          String(u.role || '') === 'evaluator' &&
          String(u.status || 'active').toLowerCase() === 'active';
      }).map(function(u) {
        return {
          id: String(u.id || ''),
          name: String(u.name || ''),
          email: '',
          role: 'evaluator',
          status: 'active',
          schoolId: publicSchoolId,
          roleTitle: String(u.roleTitle || u.jobTitle || 'مقيّم معتمد'),
          specialization: String(u.specialization || ''),
          department: String(u.department || ''),
          profileSummary: String(u.profileSummary || u.bio || ''),
          avatarUrl: String(u.avatarUrl || '')
        };
      }).filter(function(u) { return u.id && u.name; });
      return jsonResponse_({ success: true, evaluators: publicEvaluators });
    }

    var session = validateSession_(request.token);
    if (!session) return jsonResponse_({ success: false, error: 'انتهت الجلسة أو لم يتم تسجيل الدخول. يرجى تسجيل الدخول مجدداً.' });

    return jsonResponse_(dispatchApiAction_(action, payload, session));
  } catch (err) {
    return jsonResponse_({ success: false, error: 'تعذر تنفيذ الطلب: ' + err.message });
  }
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function apiLogin_(payload) {
  var identifier = String(payload.username || payload.email || '').trim().toLowerCase();
  var password = String(payload.password || '');
  if (!identifier || !password) return { success: false, error: 'أدخل اسم المستخدم وكلمة المرور.' };

  var ss = getDatabaseSpreadsheet_();
  if (!ss) return { success: false, error: 'قاعدة البيانات غير مهيأة.' };
  var sheet = ss.getSheetByName('Users');
  if (!sheet || sheet.getLastRow() < 2) return { success: false, error: 'لا توجد حسابات معتمدة في قاعدة البيانات.' };

  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function(v) { return String(v); });
  var emailCol = headers.indexOf('email');
  var usernameCol = headers.indexOf('username');
  var roleCol = headers.indexOf('role');
  var statusCol = headers.indexOf('status');
  var saltCol = headers.indexOf('passwordSalt');
  var hashCol = headers.indexOf('passwordHash');
  if ([emailCol, usernameCol, roleCol, statusCol, saltCol, hashCol].some(function(i) { return i < 0; })) {
    return { success: false, error: 'يلزم تحديث بنية ورقة Users وإعداد كلمات مرور الحسابات من مسؤول النظام.' };
  }

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var rowEmail = String(row[emailCol] || '').trim().toLowerCase();
    var rowUsername = String(row[usernameCol] || '').trim().toLowerCase();
    if (rowEmail !== identifier && rowUsername !== identifier) continue;
    var status = String(row[statusCol] || 'active').toLowerCase();
    if (status === 'inactive' || status === 'disabled') return { success: false, error: 'هذا الحساب معطّل.' };
    var salt = String(row[saltCol] || '');
    var expected = String(row[hashCol] || '');
    if (!salt || !expected || !constantTimeEquals_(passwordHash_(password, salt), expected)) {
      return { success: false, error: 'بيانات الدخول غير صحيحة.' };
    }

    var role = String(row[roleCol] || '');
    var allowed = ['platform_admin', 'school_admin', 'vice_principal', 'evaluator', 'teacher'];
    if (allowed.indexOf(role) < 0) return { success: false, error: 'دور الحساب غير معتمد.' };

    var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
    var user = {
      id: String(row[headers.indexOf('id')] || ''),
      schoolId: String(row[headers.indexOf('schoolId')] || 'sch_alsadara_01'),
      name: String(row[headers.indexOf('name')] || ''),
      email: rowEmail,
      username: rowUsername,
      role: role,
      teacherId: String(row[headers.indexOf('teacherId')] || ''),
      jobNumber: String(row[headers.indexOf('jobNumber')] || ''),
      specialization: String(row[headers.indexOf('specialization')] || ''),
      status: status
    };
    // Resolve a teacher account to its actual Teachers.id using the employee number.
    if (role === 'teacher' && !user.teacherId && user.jobNumber) {
      var teacherRows = rowsAsObjects_(ss.getSheetByName('Teachers'));
      var matchedTeacher = teacherRows.filter(function(t) {
        return String(t.schoolId || '') === user.schoolId && String(t.jobNumber || '') === user.jobNumber;
      })[0];
      if (matchedTeacher) user.teacherId = String(matchedTeacher.id || '');
    }
    CacheService.getScriptCache().put('ATHAR_SESSION_' + token, JSON.stringify(user), 21600);
    logAuditAction(user.schoolId, user.name, 'تسجيل دخول', 'تم تسجيل الدخول إلى منصة أَثَر.', user.role);
    return { success: true, token: token, user: user, expiresIn: 21600 };
  }
  return { success: false, error: 'اسم المستخدم غير مسجل ضمن الحسابات المعتمدة.' };
}

function passwordHash_(password, salt) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + ':' + password,
    Utilities.Charset.UTF_8
  );
  return digest.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function constantTimeEquals_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function validateSession_(token) {
  if (!token || typeof token !== 'string') return null;
  var raw = CacheService.getScriptCache().get('ATHAR_SESSION_' + token);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function requireRole_(session, roles) {
  return !!session && roles.indexOf(session.role) >= 0;
}

function ensureRegisteredVisitorsSheet_() {
  var ss = getDatabaseSpreadsheet_();
  var sheet = ss.getSheetByName('RegisteredVisitors');
  if (!sheet) {
    sheet = ss.insertSheet('RegisteredVisitors');
    var headers = ['id', 'schoolId', 'name', 'role', 'roleTitle', 'department', 'jobNumber', 'email', 'phone', 'username', 'status', 'createdAt'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#172C40').setFontColor('#FFFFFF').setFontWeight('bold');
  }
  return sheet;
}

function rowsAsObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function(h) { return String(h); });
  return values.slice(1).filter(function(row) { return row[0] !== ''; }).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i]; });
    return obj;
  });
}

function dispatchApiAction_(action, payload, session) {
  var ss = getDatabaseSpreadsheet_();
  if (!ss) return { success: false, error: 'قاعدة البيانات غير مهيأة.' };
  var schoolId = session.schoolId || 'sch_alsadara_01';
  var adminRoles = ['platform_admin', 'school_admin'];
  var managementRoles = ['platform_admin', 'school_admin', 'vice_principal'];
  var evaluatorRoles = ['platform_admin', 'school_admin', 'vice_principal', 'evaluator'];

  if (action === 'bootstrap') {
    var teachers = rowsAsObjects_(ss.getSheetByName('Teachers')).filter(function(x) { return String(x.schoolId) === String(schoolId); });
    var visits = rowsAsObjects_(ss.getSheetByName('Visits')).filter(function(x) { return String(x.schoolId) === String(schoolId); });
    var plans = rowsAsObjects_(ss.getSheetByName('ImprovementPlans')).filter(function(x) { return String(x.schoolId) === String(schoolId); });
    var indicators = rowsAsObjects_(ss.getSheetByName('IndicatorLibrary'));
    var settings = rowsAsObjects_(ss.getSheetByName('Settings'));
    var visitIndicators = rowsAsObjects_(ss.getSheetByName('VisitIndicators'));
    var domains = rowsAsObjects_(ss.getSheetByName('VisitDomains'));
    var followUps = rowsAsObjects_(ss.getSheetByName('PlanFollowUps'));
    var internalNotes = [];
    var administrativeFollowUps = [];
    var visitHistory = [];
    var internalNoteHistory = [];
    if (['platform_admin', 'school_admin', 'vice_principal', 'evaluator'].indexOf(session.role) >= 0) {
      internalNotes = rowsAsObjects_(ss.getSheetByName('InternalNotes')).filter(function(x) { return String(x.schoolId) === String(schoolId) && String(x.status || 'active') !== 'archived'; });
      internalNoteHistory = rowsAsObjects_(ss.getSheetByName('InternalNoteHistory')).filter(function(x) { return String(x.schoolId) === String(schoolId); }).sort(function(a,b) { return String(b.changedAt).localeCompare(String(a.changedAt)); }).slice(0, 1000);
    }
    if (['platform_admin', 'school_admin', 'vice_principal'].indexOf(session.role) >= 0) {
      administrativeFollowUps = rowsAsObjects_(ss.getSheetByName('AdministrativeFollowUps')).filter(function(x) { return String(x.schoolId) === String(schoolId); });
      visitHistory = rowsAsObjects_(ss.getSheetByName('VisitHistory')).filter(function(x) { return String(x.schoolId) === String(schoolId); }).sort(function(a,b) { return String(b.changedAt).localeCompare(String(a.changedAt)); }).slice(0, 500);
    }
    var visitorRows = rowsAsObjects_(ensureRegisteredVisitorsSheet_()).filter(function(x) { return String(x.schoolId) === String(schoolId); });
    var auditLogs = [];
    if (['platform_admin', 'school_admin', 'vice_principal'].indexOf(session.role) >= 0) {
      auditLogs = rowsAsObjects_(ss.getSheetByName('AuditLog'))
        .filter(function(x) { return String(x.schoolId) === String(schoolId); })
        .sort(function(a, b) { return String(b.timestamp).localeCompare(String(a.timestamp)); })
        .slice(0, 300);
    }
    var users = [];
    if (requireRole_(session, adminRoles)) {
      users = rowsAsObjects_(ss.getSheetByName('Users'))
        .filter(function(x) { return String(x.schoolId) === String(schoolId); })
        .map(function(x) {
          return { id: x.id, schoolId: x.schoolId, name: x.name, email: x.email, username: x.username,
            role: x.role, jobNumber: x.jobNumber, specialization: x.specialization, status: x.status,
            teacherId: x.teacherId, createdAt: x.createdAt };
        });
    }
    visits = visits.map(function(v) {
      v.indicators = visitIndicators.filter(function(x) { return String(x.visitId) === String(v.id); }).map(function(x) {
        return { indicatorId: x.indicatorId, indicatorText: x.indicatorText, indicatorGroup: x.group, rating: x.rating, notes: x.notes };
      });
      v.domains = domains.filter(function(x) { return String(x.visitId) === String(v.id); }).map(function(x) {
        return { domainId: x.domainId, domainName: x.domainName, rating: x.rating };
      });
      try { v.strengths = JSON.parse(v.strengths || '[]'); } catch (e) { v.strengths = []; }
      try { v.improvementAreas = JSON.parse(v.improvementAreas || '[]'); } catch (e) { v.improvementAreas = []; }
      return v;
    });
    plans = plans.map(function(p) {
      p.relatedIndicatorText = p.relatedIndicator || '';
      p.developmentalGoal = p.goal || '';
      p.actionProcedure = p.procedure || '';
      p.responsiblePerson = p.responsible || '';
      var latest = followUps.filter(function(x) { return String(x.planId) === String(p.id); }).sort(function(a,b) { return String(b.recordedAt).localeCompare(String(a.recordedAt)); })[0];
      if (latest) {
        p.followUpResult = latest.result || '';
        p.followUpNotes = latest.notes || '';
        p.status = latest.newStatus || p.status;
      }
      return p;
    });
    if (session.role === 'teacher') {
      teachers = teachers.filter(function(x) { return String(x.id) === String(session.teacherId); });
      visits = visits.filter(function(x) { return String(x.teacherId) === String(session.teacherId) && String(x.status || '') !== 'archived'; });
      plans = plans.filter(function(x) { return String(x.teacherId) === String(session.teacherId); });
    }
    return { success: true, user: session, teachers: teachers, visits: visits, plans: plans, indicators: indicators,
      settings: settings, auditLogs: auditLogs, users: users, visitors: requireRole_(session, adminRoles) ? visitorRows : [],
      internalNotes: internalNotes, internalNoteHistory: internalNoteHistory, administrativeFollowUps: administrativeFollowUps, visitHistory: visitHistory };
  }

  if (action === 'importTeachers') {
    if (!requireRole_(session, managementRoles)) return { success: false, error: 'ليست لديك صلاحية استيراد المعلمين.' };
    var importLock = LockService.getScriptLock();
    if (!importLock.tryLock(20000)) return { success: false, error: 'هناك عملية أخرى قيد التنفيذ. أعد المحاولة بعد قليل.' };
    try {
      var importSheet = ss.getSheetByName('Teachers');
      if (!importSheet || importSheet.getLastColumn() < 1) return { success: false, error: 'ورقة المعلمين غير موجودة أو لا تحتوي على عناوين.' };
      var importHeaders = importSheet.getRange(1, 1, 1, importSheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).trim(); });
      var requiredHeaders = ['id', 'schoolId', 'fullName', 'jobNumber', 'specialization', 'status', 'email', 'phone', 'dateAdded'];
      if (requiredHeaders.some(function(h) { return importHeaders.indexOf(h) < 0; })) return { success: false, error: 'بنية ورقة المعلمين لا تطابق الأعمدة المطلوبة؛ لم يتم تغيير أي بيانات.' };
      var importSchoolId = String(schoolId || 'sch_alsadara_01');
      var currentRows = importSheet.getLastRow() > 1 ? importSheet.getRange(2, 1, importSheet.getLastRow() - 1, importSheet.getLastColumn()).getValues() : [];
      var jobCol = importHeaders.indexOf('jobNumber'), schoolCol = importHeaders.indexOf('schoolId');
      var existingNumbers = {};
      currentRows.forEach(function(row) {
        if (String(row[schoolCol]) === importSchoolId) {
          var number = String(row[jobCol] || '').trim();
          if (number) existingNumbers[number] = true;
        }
      });
      var batchNumbers = {};
      var incoming = Array.isArray(payload.teachers) ? payload.teachers : [];
      var acceptedRows = [], rejected = [];
      incoming.forEach(function(item, index) {
        var fullName = String(item.fullName || '').trim();
        var jobNumber = String(item.jobNumber || '').trim();
        var specialization = String(item.specialization || '').trim();
        var reasons = [];
        if (!fullName) reasons.push('الاسم الكامل مفقود');
        if (!jobNumber) reasons.push('الرقم الوظيفي مفقود');
        if (!specialization) reasons.push('التخصص مفقود');
        if (jobNumber && existingNumbers[jobNumber]) reasons.push('الرقم الوظيفي مسجل مسبقاً في قاعدة البيانات');
        if (jobNumber && batchNumbers[jobNumber]) reasons.push('الرقم الوظيفي مكرر داخل ملف الاستيراد');
        if (jobNumber) batchNumbers[jobNumber] = true;
        if (reasons.length) {
          rejected.push({ lineNum: Number(item.lineNum || index + 2), jobNumber: jobNumber, reasons: reasons });
          return;
        }
        var teacher = {
          id: 'tch_' + Utilities.getUuid().substring(0, 12),
          schoolId: importSchoolId,
          fullName: fullName,
          jobNumber: jobNumber,
          specialization: specialization,
          status: 'active',
          email: String(item.email || '').trim(),
          phone: String(item.phone || '').trim(),
          dateAdded: new Date().toISOString().split('T')[0]
        };
        acceptedRows.push(importHeaders.map(function(header) {
          return teacher[header] === undefined ? '' : teacher[header];
        }));
        existingNumbers[jobNumber] = true;
      });
      if (acceptedRows.length) {
        importSheet.getRange(importSheet.getLastRow() + 1, 1, acceptedRows.length, importHeaders.length).setValues(acceptedRows);
        logAuditAction(importSchoolId, session.name, 'استيراد جماعي للمعلمين', 'تم استيراد ' + acceptedRows.length + ' معلم، واستبعاد ' + rejected.length + ' سجل.', session.role);
      }
      return { success: true, importedCount: acceptedRows.length, rejectedCount: rejected.length, errors: rejected,
        message: 'اكتملت مراجعة الاستيراد والحفظ المركزي.' };
    } catch (importError) {
      return { success: false, error: 'تعذر استيراد المعلمين: ' + importError.message };
    } finally {
      importLock.releaseLock();
    }
  }
  if (action === 'saveTeacher') {
    if (!requireRole_(session, managementRoles)) return { success: false, error: 'ليست لديك صلاحية إدارة المعلمين.' };
    payload.schoolId = schoolId;
    payload.actorName = session.name;
    payload.actorRole = session.role;
    return saveTeacher(payload);
  }
  if (action === 'toggleTeacherStatus') {
    if (!requireRole_(session, managementRoles)) return { success: false, error: 'ليست لديك صلاحية تغيير حالة المعلم.' };
    var teacherSheet = ss.getSheetByName('Teachers');
    var teacherRows = rowsAsObjects_(teacherSheet);
    var teacher = teacherRows.filter(function(t) { return String(t.id) === String(payload.id) && String(t.schoolId) === String(schoolId); })[0];
    if (!teacher) return { success: false, error: 'المعلم غير موجود في المدرسة المرتبطة بالحساب.' };
    teacher.status = payload.status === 'active' ? 'active' : 'inactive';
    teacher.actorName = session.name;
    teacher.actorRole = session.role;
    var saveTeacherResult = saveTeacher(teacher);
    return saveTeacherResult.success ? { success: true, id: teacher.id, status: teacher.status } : saveTeacherResult;
  }
  if (action === 'saveVisit') {
    if (!requireRole_(session, evaluatorRoles)) return { success: false, error: 'ليست لديك صلاحية تسجيل الزيارة.' };
    var existingVisitForEdit = null;
    if (payload.id) {
      // The form assigns a visit ID before the first autosave. A new ID is
      // therefore expected not to exist yet; only enforce edit rules when
      // the ID is already present in the Visits sheet.
      var visitWithSameId = rowsAsObjects_(ss.getSheetByName('Visits')).filter(function(v) {
        return String(v.id) === String(payload.id);
      })[0] || null;

      if (visitWithSameId && String(visitWithSameId.schoolId) !== String(schoolId)) {
        return { success: false, error: 'رقم الزيارة مرتبط بسجل في مدرسة أخرى.' };
      }

      if (visitWithSameId) {
        existingVisitForEdit = visitWithSameId;
        if (String(existingVisitForEdit.status || '') === 'archived') return { success: false, error: 'لا يمكن تعديل تقرير مؤرشف. استعد التقرير من الأرشيف أولاً.' };
        if (session.role === 'evaluator' && String(existingVisitForEdit.evaluatorId) !== String(session.id)) {
          return { success: false, error: 'لا يمكنك تعديل زيارة سجّلها مقيم آخر.' };
        }
      }
    }
    var teacherForVisit = rowsAsObjects_(ss.getSheetByName('Teachers')).filter(function(t) {
      return String(t.id) === String(payload.teacherId) && String(t.schoolId) === String(schoolId);
    })[0];
    if (!teacherForVisit) return { success: false, error: 'المعلم المحدد غير موجود ضمن المدرسة.' };
    payload.schoolId = schoolId;
    payload.actorName = session.name;
    payload.actorRole = session.role;
    if (existingVisitForEdit && ['platform_admin', 'school_admin', 'vice_principal'].indexOf(session.role) >= 0) {
      payload.evaluatorId = existingVisitForEdit.evaluatorId;
      payload.evaluatorName = existingVisitForEdit.evaluatorName;
      payload.evaluatorRole = existingVisitForEdit.evaluatorRole || 'evaluator';
    } else {
      payload.evaluatorId = session.id;
      payload.evaluatorName = session.name;
      payload.evaluatorRole = session.role;
    }
    payload.teacherName = teacherForVisit.fullName;
    payload.teacherJobNumber = teacherForVisit.jobNumber;
    payload.teacherSpecialization = teacherForVisit.specialization;
    return saveClassroomVisit(payload);
  }
  if (action === 'approveVisit') {
    if (!requireRole_(session, managementRoles)) return { success: false, error: 'اعتماد الزيارات مقتصر على الإدارة المخولة.' };
    var visitSheet = ss.getSheetByName('Visits');
    if (!visitSheet) return { success: false, error: 'ورقة الزيارات غير موجودة.' };
    var visitRows = visitSheet.getDataRange().getValues();
    var visitHeaders = visitRows[0].map(String);
    var visitStatusCol = visitHeaders.indexOf('status');
    for (var vi = 1; vi < visitRows.length; vi++) {
      if (String(visitRows[vi][0]) === String(payload.id) && String(visitRows[vi][1]) === String(schoolId)) {
        if (visitStatusCol < 0) return { success: false, error: 'عمود حالة الزيارة غير موجود.' };
        visitSheet.getRange(vi + 1, visitStatusCol + 1).setValue('approved');
        logAuditAction(schoolId, session.name, 'اعتماد زيارة صفية', 'تم اعتماد الزيارة ' + payload.id, session.role);
        return { success: true, id: payload.id, status: 'approved' };
      }
    }
    return { success: false, error: 'الزيارة غير موجودة في المدرسة المرتبطة بالحساب.' };
  }
  if (action === 'sendApprovedVisitReport') {
    if (!requireRole_(session, managementRoles)) return { success: false, error: 'إرسال التقارير للمعلمين مقتصر على الإدارة المخولة.' };
    return sendApprovedVisitReport_(payload, session, schoolId);
  }
  if (action === 'savePlan') {
    if (!requireRole_(session, evaluatorRoles)) return { success: false, error: 'ليست لديك صلاحية إدارة خطط التطوير.' };
    var planTeacher = rowsAsObjects_(ss.getSheetByName('Teachers')).filter(function(t) {
      return String(t.id) === String(payload.teacherId) && String(t.schoolId) === String(schoolId);
    })[0];
    if (!planTeacher) return { success: false, error: 'المعلم المحدد غير موجود ضمن المدرسة.' };
    var planRow = {
      id: payload.id || Utilities.getUuid(),
      schoolId: schoolId,
      teacherId: planTeacher.id,
      teacherName: planTeacher.fullName,
      teacherJobNumber: planTeacher.jobNumber,
      improvementArea: payload.improvementArea,
      relatedIndicator: payload.relatedIndicatorText || payload.relatedIndicator,
      goal: payload.developmentalGoal || payload.goal,
      procedure: payload.actionProcedure || payload.procedure,
      responsible: payload.responsiblePerson || payload.responsible,
      duration: payload.duration,
      followUpDate: payload.followUpDate,
      status: payload.status || 'in_progress',
      createdAt: payload.createdAt || new Date().toISOString()
    };
    var savedPlan = upsertObjectRow_('ImprovementPlans', planRow, 'id', schoolId);
    if (savedPlan.success) logAuditAction(schoolId, session.name, 'حفظ خطة تطوير', 'تم حفظ خطة تطوير للمعلم: ' + planTeacher.fullName, session.role);
    return savedPlan;
  }
  if (action === 'deletePlans') {
    if (!requireRole_(session, evaluatorRoles)) return { success: false, error: 'حذف خطط التطوير مقتصر على الإدارة والمقيمين المخولين.' };
    var plansSheet = ss.getSheetByName('ImprovementPlans');
    if (!plansSheet || plansSheet.getLastRow() < 2) return { success: true, deletedCount: 0 };
    var planValues = plansSheet.getDataRange().getValues();
    var planHeaders = planValues[0].map(String);
    var planIdCol = planHeaders.indexOf('id');
    var planSchoolCol = planHeaders.indexOf('schoolId');
    if (planIdCol < 0 || planSchoolCol < 0) return { success: false, error: 'تعذر تحديد أعمدة خطط التطوير.' };
    var requestedPlanIds = Array.isArray(payload.ids) ? payload.ids.map(String) : [];
    var deleteAllPlans = requestedPlanIds.length === 0;
    var planIdsToDelete = [];
    var planRowsToDelete = [];
    for (var planRow = 1; planRow < planValues.length; planRow++) {
      var belongsToCurrentSchool = String(planValues[planRow][planSchoolCol]) === String(schoolId);
      var isRequestedPlan = deleteAllPlans || requestedPlanIds.indexOf(String(planValues[planRow][planIdCol])) >= 0;
      if (belongsToCurrentSchool && isRequestedPlan) {
        planIdsToDelete.push(String(planValues[planRow][planIdCol]));
        planRowsToDelete.push(planRow + 1);
      }
    }
    if (!deleteAllPlans && planIdsToDelete.length !== requestedPlanIds.length) {
      return { success: false, error: 'بعض الخطط المحددة غير موجودة أو لا تتبع المدرسة الحالية. لم يُحذف أي سجل.' };
    }
    var followSheet = ss.getSheetByName('PlanFollowUps');
    if (followSheet && followSheet.getLastRow() > 1 && planIdsToDelete.length) {
      var followValues = followSheet.getDataRange().getValues();
      var followRowsToDelete = [];
      for (var followRow = 1; followRow < followValues.length; followRow++) {
        if (planIdsToDelete.indexOf(String(followValues[followRow][1])) >= 0) followRowsToDelete.push(followRow + 1);
      }
      for (var followDeleteIndex = followRowsToDelete.length - 1; followDeleteIndex >= 0; followDeleteIndex--) followSheet.deleteRow(followRowsToDelete[followDeleteIndex]);
    }
    for (var planDeleteIndex = planRowsToDelete.length - 1; planDeleteIndex >= 0; planDeleteIndex--) plansSheet.deleteRow(planRowsToDelete[planDeleteIndex]);
    if (planRowsToDelete.length) logAuditAction(schoolId, session.name, 'حذف خطط تطوير', 'تم حذف ' + planRowsToDelete.length + ' خطة تطوير.', session.role);
    return { success: true, deletedCount: planRowsToDelete.length };
  }
  if (action === 'savePlanFollowUp') {
    if (!requireRole_(session, evaluatorRoles)) return { success: false, error: 'ليست لديك صلاحية متابعة خطط التطوير.' };
    var planSheet = ss.getSheetByName('ImprovementPlans');
    var planData = planSheet.getDataRange().getValues();
    var planHeaders = planData[0].map(String);
    var planIndex = -1;
    for (var pi = 1; pi < planData.length; pi++) {
      if (String(planData[pi][0]) === String(payload.planId) && String(planData[pi][1]) === String(schoolId)) { planIndex = pi + 1; break; }
    }
    if (planIndex < 0) return { success: false, error: 'خطة التطوير غير موجودة في المدرسة.' };
    var followSheet = ss.getSheetByName('PlanFollowUps');
    if (!followSheet) return { success: false, error: 'ورقة متابعة الخطط غير موجودة.' };
    var followId = Utilities.getUuid();
    followSheet.appendRow([followId, payload.planId, payload.followUpDate || new Date().toISOString(), session.name, payload.followUpResult || '', payload.followUpNotes || '', payload.status || 'in_progress', new Date().toISOString()]);
    var statusCol = planHeaders.indexOf('status');
    var dateCol = planHeaders.indexOf('followUpDate');
    if (statusCol >= 0) planSheet.getRange(planIndex, statusCol + 1).setValue(payload.status || 'in_progress');
    if (dateCol >= 0) planSheet.getRange(planIndex, dateCol + 1).setValue(payload.followUpDate || new Date().toISOString());
    logAuditAction(schoolId, session.name, 'متابعة خطة تطوير', 'تم تسجيل متابعة للخطة ' + payload.planId, session.role);
    return { success: true, id: followId };
  }
  if (action === 'saveSettings') {
    if (!requireRole_(session, adminRoles)) return { success: false, error: 'تعديل الإعدادات مقتصر على إدارة المنصة والمدرسة.' };
    var settingsPayload = {};
    if (payload.platformSettings) settingsPayload.platformSettings = payload.platformSettings;
    if (payload.academicSettings) settingsPayload.academicSettings = payload.academicSettings;
    if (Object.keys(settingsPayload).length === 0) return { success: false, error: 'لا توجد إعدادات صالحة للحفظ.' };
    var settingsResult = saveSettingsRows_(settingsPayload, session.name);
    if (settingsResult.success) logAuditAction(schoolId, session.name, 'تحديث إعدادات المنصة', 'تم تحديث إعدادات المنصة أو الإعدادات الأكاديمية.', session.role);
    return settingsResult;
  }
  if (action === 'saveUserAccount') {
    if (!requireRole_(session, adminRoles)) return { success: false, error: 'إدارة الحسابات مقتصرة على مسؤول المنصة أو إدارة المدرسة.' };
    return saveUserAccount_(payload, session);
  }
  if (action === 'setUserStatus') {
    if (!requireRole_(session, adminRoles)) return { success: false, error: 'تغيير حالة الحساب مقتصر على الإدارة.' };
    return setUserStatus_(payload, session);
  }
  if (action === 'saveVisitor') {
    if (!requireRole_(session, adminRoles)) return { success: false, error: 'إدارة دليل الزائرين مقتصرة على الإدارة.' };
    return saveVisitor_(payload, session);
  }
  if (action === 'deleteVisitor') {
    if (!requireRole_(session, adminRoles)) return { success: false, error: 'حذف بيانات الزائرين مقتصر على الإدارة.' };
    var deletedVisitor = deleteById_('RegisteredVisitors', payload.id, schoolId);
    if (deletedVisitor.success) logAuditAction(schoolId, session.name, 'حذف زائر', 'تم حذف سجل الزائر ' + payload.id, session.role);
    return deletedVisitor;
  }
  if (action === 'deleteAuditLogs') {
    if (!requireRole_(session, adminRoles)) return { success: false, error: 'حذف سجل العمليات مقتصر على مسؤول المنصة أو إدارة المدرسة.' };
    var auditSheet = ss.getSheetByName('AuditLog');
    if (!auditSheet || auditSheet.getLastRow() < 2) return { success: true, deletedCount: 0 };
    var auditValues = auditSheet.getDataRange().getValues();
    var auditHeaders = auditValues[0].map(String);
    var auditSchoolCol = auditHeaders.indexOf('schoolId');
    var auditIdCol = auditHeaders.indexOf('id');
    if (auditSchoolCol < 0 || auditIdCol < 0) return { success: false, error: 'تعذر تحديد أعمدة سجل العمليات.' };
    var requestedAuditIds = Array.isArray(payload.ids) ? payload.ids.map(String) : [];
    var deleteAllAuditLogs = requestedAuditIds.length === 0;
    var auditRowsToDelete = [];
    for (var auditRow = 1; auditRow < auditValues.length; auditRow++) {
      var belongsToSchool = String(auditValues[auditRow][auditSchoolCol]) === String(schoolId);
      var isRequested = deleteAllAuditLogs || requestedAuditIds.indexOf(String(auditValues[auditRow][auditIdCol])) >= 0;
      if (belongsToSchool && isRequested) auditRowsToDelete.push(auditRow + 1);
    }
    for (var deleteIndex = auditRowsToDelete.length - 1; deleteIndex >= 0; deleteIndex--) auditSheet.deleteRow(auditRowsToDelete[deleteIndex]);
    return { success: true, deletedCount: auditRowsToDelete.length };
  }
  if (action === 'deleteTeacher') {
    if (!requireRole_(session, adminRoles)) return { success: false, error: 'ليست لديك صلاحية حذف المعلمين.' };
    var deletedTeacher = deleteById_('Teachers', payload.id, schoolId);
    if (deletedTeacher.success) logAuditAction(schoolId, session.name, 'حذف معلم', 'تم حذف المعلم ' + payload.id, session.role);
    return deletedTeacher;
  }
  if (action === 'saveInternalNote') {
    if (!requireRole_(session, ['platform_admin', 'school_admin', 'vice_principal', 'evaluator'])) return { success: false, error: 'ليست لديك صلاحية الاطلاع على الملاحظات الإدارية الداخلية.' };
    return saveInternalNote_(payload, session, schoolId);
  }
  if (action === 'saveAdministrativeFollowUp') {
    if (!requireRole_(session, managementRoles)) return { success: false, error: 'تسجيل المتابعة الإدارية مقتصر على الإدارة المدرسية.' };
    return saveAdministrativeFollowUp_(payload, session, schoolId);
  }
  if (action === 'archiveVisit') {
    if (!requireRole_(session, managementRoles)) return { success: false, error: 'أرشفة التقارير مقتصرة على الإدارة المخولة.' };
    return archiveVisit_(payload.id, session, schoolId);
  }
  if (action === 'unapproveVisit') {
    if (!requireRole_(session, managementRoles)) return { success: false, error: 'إلغاء اعتماد التقارير مقتصر على الإدارة المخولة.' };
    return unapproveVisit_(payload.id, session, schoolId);
  }
  if (action === 'restoreVisit') {
    if (!requireRole_(session, managementRoles)) return { success: false, error: 'استعادة التقارير المؤرشفة مقتصرة على الإدارة المخولة.' };
    return restoreVisit_(payload.id, session, schoolId);
  }
  if (action === 'deleteVisit') {
    return { success: false, error: 'الحذف النهائي للتقارير غير متاح. استخدم إجراء الأرشفة للاحتفاظ بالسجل التاريخي.' };
  }
  return { success: false, error: 'عملية API غير مدعومة: ' + action };
}

function saveUserAccount_(payload, session) {
  var ss = getDatabaseSpreadsheet_();
  var sheet = ss.getSheetByName('Users');
  if (!sheet) return { success: false, error: 'ورقة الحسابات غير موجودة.' };
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var rows = rowsAsObjects_(sheet);
  var id = String(payload.id || Utilities.getUuid());
  var username = String(payload.username || '').trim().toLowerCase();
  var name = String(payload.name || '').trim();
  var role = String(payload.role || 'evaluator').trim();
  var allowedRoles = session.role === 'platform_admin'
    ? ['school_admin', 'vice_principal', 'evaluator', 'teacher']
    : ['vice_principal', 'evaluator', 'teacher'];
  if (!name || !username) return { success: false, error: 'الاسم واسم المستخدم مطلوبان.' };
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return { success: false, error: 'اسم المستخدم يجب أن يتكون من 3 إلى 40 حرفًا إنجليزيًا أو رقمًا أو . _ -' };
  if (allowedRoles.indexOf(role) < 0) return { success: false, error: 'الدور المطلوب غير مسموح لهذا الحساب الإداري.' };
  var existing = rows.filter(function(x) { return String(x.id) === id && String(x.schoolId) === String(session.schoolId); })[0];
  if (payload.id && !existing) return { success: false, error: 'الحساب غير موجود في المدرسة المرتبطة بك.' };
  // Usernames are global login identifiers, so they must be unique across all schools.
  if (rows.some(function(x) { return String(x.username || '').toLowerCase() === username && String(x.id) !== id; })) {
    return { success: false, error: 'اسم المستخدم مستخدم بالفعل في هذه المدرسة.' };
  }
  var password = String(payload.password || '');
  if (!existing && password.length < 10) return { success: false, error: 'كلمة المرور الأولية يجب ألا تقل عن 10 أحرف.' };
  if (password && password.length < 10) return { success: false, error: 'كلمة المرور يجب ألا تقل عن 10 أحرف.' };
  var obj = {
    id: id, schoolId: session.schoolId || 'sch_alsadara_01', name: name,
    email: String(payload.email || ''), role: role, jobNumber: String(payload.jobNumber || ''),
    specialization: String(payload.specialization || ''), status: String(payload.status || (existing ? existing.status : 'active')),
    createdAt: existing ? existing.createdAt : new Date().toISOString(), username: username,
    teacherId: String(payload.teacherId || (existing ? existing.teacherId : ''))
  };
  var row = headers.map(function(h) {
    if (h === 'passwordSalt' || h === 'passwordHash') return existing ? (existing[h] || '') : '';
    return obj[h] === undefined || obj[h] === null ? '' : obj[h];
  });
  var rowIndex = -1;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) if (String(data[i][0]) === id) { rowIndex = i + 1; break; }
  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else { sheet.appendRow(row); rowIndex = sheet.getLastRow(); }
  if (password) {
    var salt = Utilities.getUuid() + Utilities.getUuid();
    var saltCol = headers.indexOf('passwordSalt'), hashCol = headers.indexOf('passwordHash');
    if (saltCol < 0 || hashCol < 0) return { success: false, error: 'أعمدة تشفير كلمات المرور غير مهيأة. تواصل مع مسؤول النظام.' };
    sheet.getRange(rowIndex, saltCol + 1).setValue(salt);
    sheet.getRange(rowIndex, hashCol + 1).setValue(passwordHash_(password, salt));
  }
  logAuditAction(obj.schoolId, session.name, existing ? 'تعديل حساب مستخدم' : 'إنشاء حساب مستخدم', 'الحساب: ' + name + ' (' + role + ')', session.role);
  return { success: true, user: { id: id, schoolId: obj.schoolId, name: name, username: username, email: obj.email,
    role: role, jobNumber: obj.jobNumber, specialization: obj.specialization, status: obj.status, teacherId: obj.teacherId } };
}

function setUserStatus_(payload, session) {
  var id = String(payload.id || '');
  if (!id || id === String(session.id)) return { success: false, error: 'لا يمكن تعطيل الحساب الحالي أو أن المعرّف غير صالح.' };
  var sheet = getDatabaseSpreadsheet_().getSheetByName('Users');
  if (!sheet) return { success: false, error: 'ورقة الحسابات غير موجودة.' };
  var data = sheet.getDataRange().getValues(), headers = data[0].map(String);
  var schoolCol = headers.indexOf('schoolId'), statusCol = headers.indexOf('status'), idCol = headers.indexOf('id');
  var roleCol = headers.indexOf('role');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === id && String(data[i][schoolCol]) === String(session.schoolId)) {
      var targetRole = String(data[i][roleCol] || '');
      if (session.role !== 'platform_admin' && ['platform_admin', 'school_admin'].indexOf(targetRole) >= 0) {
        return { success: false, error: 'لا يمكن لإدارة المدرسة تعطيل حساب مسؤول المنصة أو حساب إدارة المدرسة.' };
      }
      var next = payload.status === 'active' ? 'active' : 'inactive';
      sheet.getRange(i + 1, statusCol + 1).setValue(next);
      logAuditAction(session.schoolId, session.name, 'تغيير حالة حساب', 'الحساب ' + id + ' أصبح ' + next, session.role);
      return { success: true, id: id, status: next };
    }
  }
  return { success: false, error: 'الحساب غير موجود في المدرسة المرتبطة بك.' };
}

function saveInternalNote_(payload, session, schoolId) {
  var text = String(payload.noteText || '').trim();
  if (!text) return { success: false, error: 'نص الملاحظة مطلوب.' };
  var teacher = rowsAsObjects_(getDatabaseSpreadsheet_().getSheetByName('Teachers')).filter(function(t) {
    return String(t.id) === String(payload.teacherId) && String(t.schoolId) === String(schoolId);
  })[0];
  if (!teacher) return { success: false, error: 'المعلم المحدد غير موجود في المدرسة.' };
  var now = new Date().toISOString();
  var sheet = getDatabaseSpreadsheet_().getSheetByName('InternalNotes');
  var noteId = String(payload.id || Utilities.getUuid());
  var existing = rowsAsObjects_(sheet).filter(function(n) { return String(n.id) === noteId && String(n.schoolId) === String(schoolId); })[0];
  if (payload.id && !existing) return { success: false, error: 'الملاحظة غير موجودة أو لا تتبع المدرسة.' };
  if (existing && ['platform_admin', 'school_admin', 'vice_principal'].indexOf(session.role) < 0 && String(existing.createdBy || '') !== String(session.name || '')) {
    return { success: false, error: 'يمكنك تعديل ملاحظاتك التي كتبتها فقط. يمكن للإدارة تعديل جميع الملاحظات.' };
  }
  if (payload.visitId) {
    var linkedVisit = rowsAsObjects_(getDatabaseSpreadsheet_().getSheetByName('Visits')).filter(function(v) { return String(v.id) === String(payload.visitId) && String(v.schoolId) === String(schoolId) && String(v.teacherId) === String(teacher.id); })[0];
    if (!linkedVisit) return { success: false, error: 'التقرير المرتبط لا يتبع المعلم المحدد أو غير موجود.' };
  }
  if (existing) {
    getDatabaseSpreadsheet_().getSheetByName('InternalNoteHistory').appendRow([
      Utilities.getUuid(), schoolId, noteId, session.name, session.role, now, String(existing.noteText || ''), text
    ]);
  }
  var note = {
    id: noteId, schoolId: schoolId, teacherId: teacher.id, teacherName: teacher.fullName,
    visitId: String(payload.visitId || ''), noteText: text,
    createdBy: existing ? existing.createdBy : session.name,
    createdByRole: existing ? existing.createdByRole : session.role,
    createdAt: existing ? existing.createdAt : now,
    updatedBy: session.name, updatedByRole: session.role, updatedAt: now, status: 'active'
  };
  var result = upsertObjectRow_('InternalNotes', note, 'id', schoolId);
  if (result.success) logAuditAction(schoolId, session.name, existing ? 'تعديل ملاحظة إدارية داخلية' : 'إضافة ملاحظة إدارية داخلية', 'المعلم: ' + teacher.fullName, session.role);
  return result;
}

function saveAdministrativeFollowUp_(payload, session, schoolId) {
  var teacher = rowsAsObjects_(getDatabaseSpreadsheet_().getSheetByName('Teachers')).filter(function(t) {
    return String(t.id) === String(payload.teacherId) && String(t.schoolId) === String(schoolId);
  })[0];
  if (!teacher) return { success: false, error: 'المعلم المحدد غير موجود في المدرسة.' };
  if (payload.visitId) {
    var linkedVisit = rowsAsObjects_(getDatabaseSpreadsheet_().getSheetByName('Visits')).filter(function(v) { return String(v.id) === String(payload.visitId) && String(v.schoolId) === String(schoolId) && String(v.teacherId) === String(teacher.id); })[0];
    if (!linkedVisit) return { success: false, error: 'التقرير المرتبط لا يتبع المعلم المحدد أو غير موجود.' };
  }
  var now = new Date().toISOString();
  var id = String(payload.id || Utilities.getUuid());
  var sheet = getDatabaseSpreadsheet_().getSheetByName('AdministrativeFollowUps');
  var existing = rowsAsObjects_(sheet).filter(function(x) { return String(x.id) === id && String(x.schoolId) === String(schoolId); })[0];
  if (payload.id && !existing) return { success: false, error: 'سجل المتابعة غير موجود أو لا يتبع المدرسة.' };
  var item = {
    id: id, schoolId: schoolId, teacherId: teacher.id, teacherName: teacher.fullName,
    visitId: String(payload.visitId || ''), followUpDate: String(payload.followUpDate || now.slice(0,10)),
    action: String(payload.action || ''), notes: String(payload.notes || ''),
    recommendations: String(payload.recommendations || ''), result: String(payload.result || ''),
    nextAction: String(payload.nextAction || ''), nextDate: String(payload.nextDate || ''),
    status: String(payload.status || 'in_progress'), createdBy: existing ? existing.createdBy : session.name,
    createdByRole: existing ? existing.createdByRole : session.role,
    createdAt: existing ? existing.createdAt : now, updatedAt: now
  };
  var result = upsertObjectRow_('AdministrativeFollowUps', item, 'id', schoolId);
  if (result.success) logAuditAction(schoolId, session.name, existing ? 'تعديل متابعة إدارية' : 'إضافة متابعة إدارية', 'المعلم: ' + teacher.fullName, session.role);
  return result;
}

function recordVisitSnapshot_(ss, visitId, oldVisitRow, visitHeaders, schoolId, actorName, actorRole, action) {
  var visitObject = {};
  visitHeaders.forEach(function(h, i) { visitObject[h] = oldVisitRow[i]; });
  var indicators = rowsAsObjects_(ss.getSheetByName('VisitIndicators')).filter(function(x) { return String(x.visitId) === String(visitId); });
  var domains = rowsAsObjects_(ss.getSheetByName('VisitDomains')).filter(function(x) { return String(x.visitId) === String(visitId); });
  var snapshot = { visit: visitObject, indicators: indicators, domains: domains };
  // Older production databases may not yet contain the optional visit-history sheet.
  // Create only this missing history sheet; never reinitialize or alter existing data.
  var historySheet = ss.getSheetByName('VisitHistory');
  if (!historySheet) {
    historySheet = ss.insertSheet('VisitHistory');
    historySheet.getRange(1, 1, 1, 8).setValues([[
      'id', 'schoolId', 'visitId', 'changedBy', 'changedByRole', 'changedAt', 'action', 'snapshotJson'
    ]]);
    historySheet.setFrozenRows(1);
  }
  historySheet.appendRow([
    Utilities.getUuid(), schoolId, visitId, actorName || '', actorRole || '', new Date().toISOString(), action || 'تعديل التقرير', JSON.stringify(snapshot)
  ]);
}

function archiveVisit_(visitId, session, schoolId) {
  if (!visitId) return { success: false, error: 'رقم التقرير مطلوب.' };
  var ss = getDatabaseSpreadsheet_();
  var sheet = ss.getSheetByName('Visits');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var statusCol = headers.indexOf('status'), updatedCol = headers.indexOf('updatedAt');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(visitId) || String(data[i][1]) !== String(schoolId)) continue;
    recordVisitSnapshot_(ss, visitId, data[i], headers, schoolId, session.name, session.role, 'أرشفة التقرير');
    sheet.getRange(i + 1, statusCol + 1).setValue('archived');
    if (updatedCol >= 0) sheet.getRange(i + 1, updatedCol + 1).setValue(new Date().toISOString());
    logAuditAction(schoolId, session.name, 'أرشفة تقرير زيارة', 'تمت أرشفة التقرير ' + visitId, session.role);
    return { success: true, id: visitId, status: 'archived' };
  }
  return { success: false, error: 'التقرير غير موجود في المدرسة.' };
}

function unapproveVisit_(visitId, session, schoolId) {
  if (!visitId) return { success: false, error: 'رقم التقرير مطلوب.' };
  var ss = getDatabaseSpreadsheet_();
  var sheet = ss.getSheetByName('Visits');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var statusCol = headers.indexOf('status'), updatedCol = headers.indexOf('updatedAt');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(visitId) || String(data[i][1]) !== String(schoolId)) continue;
    recordVisitSnapshot_(ss, visitId, data[i], headers, schoolId, session.name, session.role, 'إلغاء اعتماد التقرير');
    sheet.getRange(i + 1, statusCol + 1).setValue('completed');
    if (updatedCol >= 0) sheet.getRange(i + 1, updatedCol + 1).setValue(new Date().toISOString());
    logAuditAction(schoolId, session.name, 'إلغاء اعتماد تقرير', 'تم إلغاء اعتماد التقرير ' + visitId, session.role);
    return { success: true, id: visitId, status: 'completed' };
  }
  return { success: false, error: 'التقرير غير موجود في المدرسة.' };
}

function restoreVisit_(visitId, session, schoolId) {
  if (!visitId) return { success: false, error: 'رقم التقرير مطلوب.' };
  var ss = getDatabaseSpreadsheet_();
  var sheet = ss.getSheetByName('Visits');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var statusCol = headers.indexOf('status'), updatedCol = headers.indexOf('updatedAt');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(visitId) || String(data[i][1]) !== String(schoolId)) continue;
    if (String(data[i][statusCol]) !== 'archived') return { success: false, error: 'هذا التقرير ليس مؤرشفًا.' };
    recordVisitSnapshot_(ss, visitId, data[i], headers, schoolId, session.name, session.role, 'استعادة التقرير من الأرشيف');
    sheet.getRange(i + 1, statusCol + 1).setValue('completed');
    if (updatedCol >= 0) sheet.getRange(i + 1, updatedCol + 1).setValue(new Date().toISOString());
    logAuditAction(schoolId, session.name, 'استعادة تقرير من الأرشيف', 'تمت استعادة التقرير ' + visitId, session.role);
    return { success: true, id: visitId, status: 'completed' };
  }
  return { success: false, error: 'التقرير غير موجود في المدرسة.' };
}

function saveVisitor_(payload, session) {
  var sheet = ensureRegisteredVisitorsSheet_();
  var name = String(payload.name || '').trim();
  if (!name) return { success: false, error: 'اسم الزائر مطلوب.' };
  var visitor = {
    id: String(payload.id || Utilities.getUuid()),
    schoolId: session.schoolId || 'sch_alsadara_01',
    name: name,
    role: String(payload.role || 'evaluator'),
    roleTitle: String(payload.roleTitle || ''),
    department: String(payload.department || ''),
    jobNumber: String(payload.jobNumber || ''),
    email: String(payload.email || ''),
    phone: String(payload.phone || ''),
    username: String(payload.username || '').trim().toLowerCase(),
    status: String(payload.status || 'active'),
    createdAt: String(payload.createdAt || new Date().toISOString())
  };
  var result = upsertObjectRow_('RegisteredVisitors', visitor, 'id', visitor.schoolId);
  if (result.success) logAuditAction(visitor.schoolId, session.name, 'حفظ بيانات زائر', 'تم حفظ بيانات الزائر: ' + name, session.role);
  return result;
}

function upsertObjectRow_(sheetName, obj, idKey, schoolId) {
  var ss = getDatabaseSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'ورقة البيانات غير موجودة: ' + sheetName };
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var id = String(obj[idKey] || Utilities.getUuid());
  var row = headers.map(function(h) {
    var value = h === 'id' ? id : (h === 'schoolId' ? schoolId : obj[h]);
    return value === undefined || value === null ? '' : (typeof value === 'object' ? JSON.stringify(value) : value);
  });
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      var schoolCol = headers.indexOf('schoolId');
      if (schoolCol >= 0 && String(data[i][schoolCol]) !== String(schoolId)) {
        return { success: false, error: 'لا يمكن تعديل سجل تابع لمدرسة أخرى.' };
      }
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return { success: true, id: id };
    }
  }
  sheet.appendRow(row);
  return { success: true, id: id };
}

function saveSettingsRows_(settings, userName) {
  var ss = getDatabaseSpreadsheet_();
  var sheet = ss.getSheetByName('Settings');
  if (!sheet) return { success: false, error: 'ورقة الإعدادات غير موجودة.' };
  var now = new Date().toISOString();
  Object.keys(settings || {}).forEach(function(key) {
    var data = sheet.getDataRange().getValues();
    var found = -1;
    for (var i = 1; i < data.length; i++) if (String(data[i][0]) === key) found = i + 1;
    var row = [key, typeof settings[key] === 'object' ? JSON.stringify(settings[key]) : settings[key], now, userName];
    if (found > 0) sheet.getRange(found, 1, 1, 4).setValues([row]); else sheet.appendRow(row);
  });
  return { success: true };
}

function deleteById_(sheetName, id, schoolId) {
  if (!id) return { success: false, error: 'المعرّف مطلوب.' };
  var sheet = getDatabaseSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'ورقة البيانات غير موجودة.' };
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(id) && String(data[i][1]) === String(schoolId)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'السجل غير موجود في هذه المدرسة.' };
}

function deleteVisitRows_(visitId, schoolId) {
  var result = deleteById_('Visits', visitId, schoolId);
  if (!result.success) return result;
  ['VisitIndicators', 'VisitDomains'].forEach(function(name) {
    var sheet = getDatabaseSpreadsheet_().getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) return;
    var rows = sheet.getDataRange().getValues();
    for (var i = rows.length - 1; i >= 1; i--) if (String(rows[i][1]) === String(visitId)) sheet.deleteRow(i + 1);
  });
  return { success: true };
}

// تُشغّل مرة واحدة من محرر Apps Script بواسطة مسؤول النظام لتوسيع أعمدة Users.
// لا تنشئ كلمة مرور افتراضية ولا تمنح صلاحية تلقائية لأي مستخدم.
function migrateUserPasswordColumns() {
  var ss = getDatabaseSpreadsheet_();
  if (!ss) throw new Error('شغّل initializeDatabase() أولاً.');
  var sheet = ss.getSheetByName('Users');
  if (!sheet) throw new Error('ورقة Users غير موجودة.');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  ['username', 'teacherId', 'passwordSalt', 'passwordHash'].forEach(function(h) {
    if (headers.indexOf(h) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
      headers.push(h);
    }
  });
  return { success: true, message: 'تم تجهيز أعمدة كلمات المرور. عيّن كلمات المرور للحسابات المعتمدة قبل تفعيل الدخول.' };
}

// تعيين كلمة مرور لحساب موجود فقط؛ لا تنشئ مستخدمين ولا تغيّر أدوارهم.
function setUserPassword(identifier, password) {
  if (!identifier || !password || String(password).length < 10) throw new Error('أدخل اسم المستخدم أو البريد وكلمة مرور لا تقل عن 10 أحرف.');
  var ss = getDatabaseSpreadsheet_();
  var sheet = ss && ss.getSheetByName('Users');
  if (!sheet) throw new Error('ورقة Users غير موجودة.');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var emailCol = headers.indexOf('email');
  var usernameCol = headers.indexOf('username');
  var saltCol = headers.indexOf('passwordSalt');
  var hashCol = headers.indexOf('passwordHash');
  if (emailCol < 0 || usernameCol < 0 || saltCol < 0 || hashCol < 0) throw new Error('نفّذ migrateUserPasswordColumns() أولاً.');
  var normalized = String(identifier).trim().toLowerCase();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][emailCol] || '').trim().toLowerCase() === normalized || String(data[i][usernameCol] || '').trim().toLowerCase() === normalized) {
      var salt = Utilities.getUuid() + Utilities.getUuid();
      sheet.getRange(i + 1, saltCol + 1).setValue(salt);
      sheet.getRange(i + 1, hashCol + 1).setValue(passwordHash_(String(password), salt));
      return { success: true, message: 'تم تحديث كلمة مرور الحساب.' };
    }
  }
  throw new Error('لم يتم العثور على اسم مستخدم أو بريد مطابق في قائمة Users.');
}


// نقطة دخول موحدة لطلبات الجسر داخل iframe؛ تستدعيها google.script.run.
function dispatchBridgeRequest(request) {
  try {
    if (!request || typeof request !== 'object') return { success: false, error: 'طلب غير صالح.' };
    var action = String(request.action || '');
    var payload = request.payload || {};
    if (action === 'login') return apiLogin_(payload);
    if (action === 'health') return { success: true, service: 'athar-api', timestamp: new Date().toISOString() };
    var session = validateSession_(request.token);
    if (!session) return { success: false, error: 'انتهت الجلسة أو لم يتم تسجيل الدخول. يرجى تسجيل الدخول مجدداً.' };
    return dispatchApiAction_(action, payload, session);
  } catch (err) {
    return { success: false, error: 'تعذر تنفيذ الطلب: ' + err.message };
  }
}


// إرسال التقرير المعتمد للمعلم فقط، مع إنشاء سجل مراسلات آمن عند الحاجة.
// تُشغّل مرة واحدة من محرر Apps Script بواسطة مالك النشر لمنح صلاحية إرسال البريد.
function authorizeMailOnce() {
  var remaining = MailApp.getRemainingDailyQuota();
  return { success: true, remainingDailyQuota: remaining, message: 'تم التحقق من صلاحية إرسال البريد.' };
}

function ensureCommunicationLogSheet_() {
  var ss = getDatabaseSpreadsheet_();
  var sheet = ss.getSheetByName('CommunicationLog');
  if (!sheet) {
    sheet = ss.insertSheet('CommunicationLog');
    var headers = ['id', 'schoolId', 'visitId', 'teacherId', 'teacherName', 'recipientEmail', 'sentBy', 'sentByRole', 'sentAt', 'status', 'subject', 'message'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#172C40').setFontColor('#FFFFFF').setFontWeight('bold');
  }
  return sheet;
}

function escapeMailHtml_(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sendApprovedVisitReport_(payload, session, schoolId) {
  var visitId = String(payload.id || '');
  if (!visitId) return { success: false, error: 'رقم تقرير الزيارة مطلوب.' };
  var ss = getDatabaseSpreadsheet_();
  var visit = rowsAsObjects_(ss.getSheetByName('Visits')).filter(function(v) {
    return String(v.id) === visitId && String(v.schoolId) === String(schoolId);
  })[0];
  if (!visit) return { success: false, error: 'التقرير غير موجود في المدرسة المرتبطة بالحساب.' };
  if (String(visit.status || '') !== 'approved') return { success: false, error: 'لا يمكن إرسال التقرير قبل اعتماده من الإدارة.' };

  var teacher = rowsAsObjects_(ss.getSheetByName('Teachers')).filter(function(t) {
    return String(t.id) === String(visit.teacherId) && String(t.schoolId) === String(schoolId);
  })[0];
  if (!teacher) return { success: false, error: 'تعذر العثور على بيانات المعلم المرتبط بالتقرير.' };
  var recipient = String(teacher.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { success: false, error: 'لا يوجد بريد إلكتروني صحيح مسجل لهذا المعلم. حدّث بيانات المعلم أولاً.' };
  }

  var logSheet = ensureCommunicationLogSheet_();
  var logRows = rowsAsObjects_(logSheet);
  var previousSent = logRows.some(function(row) {
    return String(row.schoolId) === String(schoolId) && String(row.visitId) === visitId && String(row.status) === 'sent';
  });
  if (previousSent && payload.confirmResend !== true) {
    return { success: false, error: 'سبق إرسال هذا التقرير. أكّد إعادة الإرسال إذا رغبت في إرساله مرة أخرى.' };
  }
  if (MailApp.getRemainingDailyQuota() < 1) {
    return { success: false, error: 'تم بلوغ الحد اليومي المتاح لإرسال البريد. حاول في يوم عمل لاحق.' };
  }

  var indicators = rowsAsObjects_(ss.getSheetByName('VisitIndicators')).filter(function(x) {
    return String(x.visitId) === visitId;
  });
  var domainsSheet = ss.getSheetByName('VisitDomains');
  var domains = rowsAsObjects_(domainsSheet).filter(function(x) { return String(x.visitId) === visitId; });
  var strengths = [], improvementAreas = [];
  try { strengths = JSON.parse(visit.strengths || '[]'); } catch (e) {}
  try { improvementAreas = JSON.parse(visit.improvementAreas || '[]'); } catch (e) {}
  var message = String(payload.message || '').trim().substring(0, 2000);
  var subject = 'تقرير الزيارة الصفية المعتمد – ' + String(visit.teacherName || teacher.fullName || '');
  var ratingLabels = {
    outstanding: 'متميز', very_good: 'جيد جدًا', good: 'جيد', acceptable: 'مقبول',
    weak: 'ضعيف', not_observed: 'لم يُشاهد', yes: 'متحقق', no: 'غير متحقق',
    needs_improvement: 'يحتاج إلى تحسين'
  };
  var indicatorRows = indicators.map(function(item) {
    return '<tr><td>' + escapeMailHtml_(item.indicatorText) + '</td><td>' +
      escapeMailHtml_(ratingLabels[String(item.rating)] || item.rating) + '</td><td>' +
      escapeMailHtml_(item.notes || '—') + '</td></tr>';
  }).join('');
  var domainRows = domains.map(function(item) {
    return '<tr><td>' + escapeMailHtml_(item.domainName) + '</td><td>' +
      escapeMailHtml_(ratingLabels[String(item.rating)] || item.rating) + '</td></tr>';
  }).join('');
  var listHtml = function(items) {
    return (items || []).length ? '<ul>' + items.map(function(x) { return '<li>' + escapeMailHtml_(x) + '</li>'; }).join('') + '</ul>' : '<p>—</p>';
  };
  var html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><style>' +
    'body{font-family:Arial,sans-serif;color:#172c40;line-height:1.7;direction:rtl}h1,h2{color:#172c40}' +
    'table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #ccd3da;padding:7px;text-align:right}' +
    'th{background:#f2ebdd}.meta{background:#f7f8fa;padding:12px;border:1px solid #e2e8f0}' +
    '</style></head><body><h1>منظومة أَثَر للتميز والتطوير التعليمي</h1>' +
    '<h2>تقرير زيارة صفية معتمد</h2><div class="meta">' +
    '<b>المعلم:</b> ' + escapeMailHtml_(visit.teacherName) + ' &nbsp; | &nbsp; <b>الرقم الوظيفي:</b> ' + escapeMailHtml_(visit.teacherJobNumber) +
    '<br><b>المادة:</b> ' + escapeMailHtml_(visit.subject) + ' &nbsp; | &nbsp; <b>الصف والشعبة:</b> ' + escapeMailHtml_(visit.grade + ' / ' + visit.section) +
    '<br><b>تاريخ الزيارة:</b> ' + escapeMailHtml_(visit.date) + ' &nbsp; | &nbsp; <b>المقيم:</b> ' + escapeMailHtml_(visit.evaluatorName) +
    '<br><b>نسبة الإنجاز:</b> ' + escapeMailHtml_(visit.achievementPercentage) + '%</div>' +
    '<h2>هدف الزيارة</h2><p>' + escapeMailHtml_(visit.visitGoal || '—') + '</p>' +
    '<h2>مؤشرات الزيارة وملاحظاتها</h2><table><thead><tr><th>المؤشر</th><th>التقدير</th><th>الملاحظة</th></tr></thead><tbody>' + indicatorRows + '</tbody></table>' +
    '<h2>تقييم المجالات</h2><table><thead><tr><th>المجال</th><th>التقدير</th></tr></thead><tbody>' + domainRows + '</tbody></table>' +
    '<h2>جوانب التميز</h2>' + listHtml(strengths) +
    '<h2>فرص التحسين</h2>' + listHtml(improvementAreas) +
    '<h2>التوصيات العملية</h2><p>' + escapeMailHtml_(visit.recommendations || '—') + '</p>' +
    (message ? '<h2>رسالة من الإدارة</h2><p>' + escapeMailHtml_(message).replace(/\n/g, '<br>') + '</p>' : '') +
    '<hr><p>هذا التقرير أُرسل من منظومة أَثَر بعد اعتماده من الإدارة.</p></body></html>';
  var pdf = Utilities.newBlob(html, MimeType.HTML, 'Athar_Visit_Report_' + visitId + '.html').getAs(MimeType.PDF)
    .setName('Athar_Visit_Report_' + visitId + '.pdf');
  var body = 'الأستاذ/ ' + String(teacher.fullName || visit.teacherName) + ' المحترم،\n\n' +
    'نرفق لكم تقرير الزيارة الصفية بعد اعتماده من الإدارة. نأمل الاطلاع عليه والاستفادة من جوانب التميز وفرص التحسين والتوصيات الواردة فيه.' +
    (message ? '\n\nرسالة الإدارة:\n' + message : '') +
    '\n\nمع خالص التقدير،\nإدارة المدرسة – منظومة أَثَر';
  MailApp.sendEmail({ to: recipient, subject: subject, body: body, htmlBody: html, attachments: [pdf], name: 'منظومة أَثَر' });

  var sentAt = new Date().toISOString();
  logSheet.appendRow([Utilities.getUuid(), schoolId, visitId, teacher.id, teacher.fullName, recipient,
    session.name, session.role, sentAt, 'sent', subject, message]);
  logAuditAction(schoolId, session.name, 'إرسال تقرير زيارة للمعلم', 'تم إرسال التقرير ' + visitId + ' إلى ' + recipient, session.role);
  return { success: true, visitId: visitId, recipient: recipient, sentAt: sentAt, message: 'تم إرسال التقرير المعتمد إلى بريد المعلم بنجاح.' };
}
