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
// 2. تهيئة قاعدة البيانات وأوراق العمل (18 ورقة عمل)
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
      'Users': ['id', 'schoolId', 'name', 'email', 'role', 'jobNumber', 'specialization', 'status', 'createdAt', 'username', 'teacherId'],
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
      'ReportTemplates': ['id', 'templateName', 'layoutJson', 'isDefault']
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
    
    // Import existing central users once, without deleting or modifying the source sheet.
    var userMigration = migrateCentralUsersToUsers_(ss);

    // إدخال البيانات الأولية إذا كانت ورقة المؤشرات فارغة
    seedInitialDataIfEmpty(ss);
    
    return {
      success: true,
      message: "تمت تهيئة قاعدة البيانات بنجاح (18 ورقة عمل).",
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
    var yesCount = 0;
    var needsImpCount = 0;
    var noCount = 0;
    var notObservedCount = 0;

    for (var i = 0; i < indicators.length; i++) {
      var r = indicators[i].rating;
      if (r === 'yes') yesCount++;
      else if (r === 'needs_improvement') needsImpCount++;
      else if (r === 'no') noCount++;
      else if (r === 'not_observed') notObservedCount++;
    }

    var observedCount = yesCount + needsImpCount + noCount;
    var achPct = 0;
    if (observedCount > 0) {
      achPct = Math.round(((yesCount * 1.0 + needsImpCount * 0.5) / observedCount) * 1000) / 10;
    }

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
    logAuditAction(visitData.schoolId || 'sch_alsadara_01', visitData.evaluatorName, 'حفظ زيارة صفية', 'حفظ زيارة للمعلم: ' + visitData.teacherName + ' بنسبة إنجاز ' + achPct + '%');

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
    for (var i = 1; i < data.length; i++) {
      if (data[i][3] && data[i][3].toString().trim() === jobNumber) {
        if (!teacherData.id || data[i][0] !== teacherData.id) {
          return { success: false, error: 'الرقم الوظيفي (' + jobNumber + ') مستخدم مسبقاً لمعلم آخر.' };
        }
      }
    }

    var teacherId = teacherData.id || ('tch_' + Utilities.getUuid().substring(0, 8));
    var dateAdded = teacherData.dateAdded || new Date().toISOString().split('T')[0];

    var newRow = [
      teacherId,
      teacherData.schoolId || 'sch_alsadara_01',
      fullName,
      jobNumber,
      specialization,
      teacherData.status || 'active',
      teacherData.email || '',
      teacherData.phone || '',
      dateAdded
    ];

    if (teacherData.id) {
      for (var r = 1; r < data.length; r++) {
        if (data[r][0] === teacherData.id) {
          sheet.getRange(r + 1, 1, 1, newRow.length).setValues([newRow]);
          break;
        }
      }
    } else {
      sheet.appendRow(newRow);
    }

    logAuditAction(teacherData.schoolId || 'sch_alsadara_01', 'مسؤول النظام', 'حفظ بيانات معلم', 'تم حفظ المعلم: ' + fullName + ' (' + jobNumber + ')');

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

function logAuditAction(schoolId, userName, action, details) {
  try {
    var ss = getDatabaseSpreadsheet_();
    var sheet = ss.getSheetByName('AuditLog');
    if (sheet) {
      var row = [
        Utilities.getUuid(),
        schoolId,
        new Date().toLocaleString('ar-AE'),
        userName,
        'نظام أَثَر',
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
      teacherId: String(row[headers.indexOf('teacherId')] || '')
    };
    CacheService.getScriptCache().put('ATHAR_SESSION_' + token, JSON.stringify(user), 21600);
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

  if (action === 'bootstrap') {
    var teachers = rowsAsObjects_(ss.getSheetByName('Teachers')).filter(function(x) { return x.schoolId === schoolId; });
    var visits = rowsAsObjects_(ss.getSheetByName('Visits')).filter(function(x) { return x.schoolId === schoolId; });
    var plans = rowsAsObjects_(ss.getSheetByName('ImprovementPlans')).filter(function(x) { return x.schoolId === schoolId; }).map(function(p) {
      p.relatedIndicatorText = p.relatedIndicator || '';
      p.developmentalGoal = p.goal || '';
      p.actionProcedure = p.procedure || '';
      p.responsiblePerson = p.responsible || '';
      return p;
    });
    if (session.role === 'teacher') {
      teachers = teachers.filter(function(x) { return x.id === session.teacherId; });
      visits = visits.filter(function(x) { return x.teacherId === session.teacherId; });
      plans = plans.filter(function(x) { return x.teacherId === session.teacherId; });
    }
    var indicators = rowsAsObjects_(ss.getSheetByName('IndicatorLibrary'));
    var settings = rowsAsObjects_(ss.getSheetByName('Settings'));
    var visitIndicators = rowsAsObjects_(ss.getSheetByName('VisitIndicators'));
    var domains = rowsAsObjects_(ss.getSheetByName('VisitDomains'));
    visits = visits.map(function(v) {
      v.indicators = visitIndicators.filter(function(x) { return x.visitId === v.id; }).map(function(x) {
        return { indicatorId: x.indicatorId, indicatorText: x.indicatorText, indicatorGroup: x.group, rating: x.rating, notes: x.notes };
      });
      v.domains = domains.filter(function(x) { return x.visitId === v.id; }).map(function(x) {
        return { domainId: x.domainId, domainName: x.domainName, rating: x.rating };
      });
      try { v.strengths = JSON.parse(v.strengths || '[]'); } catch (e) { v.strengths = []; }
      try { v.improvementAreas = JSON.parse(v.improvementAreas || '[]'); } catch (e) { v.improvementAreas = []; }
      return v;
    });
    return { success: true, user: session, teachers: teachers, visits: visits, plans: plans, indicators: indicators, settings: settings };
  }

  if (action === 'saveTeacher') {
    if (!requireRole_(session, ['platform_admin', 'school_admin', 'vice_principal'])) return { success: false, error: 'ليست لديك صلاحية إدارة المعلمين.' };
    payload.schoolId = schoolId;
    return saveTeacher(payload);
  }
  if (action === 'saveVisit') {
    if (!requireRole_(session, ['platform_admin', 'school_admin', 'vice_principal', 'evaluator'])) return { success: false, error: 'ليست لديك صلاحية تسجيل الزيارة.' };
    payload.schoolId = schoolId;
    if (session.role === 'teacher') return { success: false, error: 'لا يحق للمعلم إنشاء زيارة.' };
    return saveClassroomVisit(payload);
  }
  if (action === 'savePlan') {
    if (!requireRole_(session, ['platform_admin', 'school_admin', 'vice_principal', 'evaluator'])) return { success: false, error: 'ليست لديك صلاحية إدارة خطط التطوير.' };
    var planRow = {
      id: payload.id,
      teacherId: payload.teacherId,
      teacherName: payload.teacherName,
      teacherJobNumber: payload.teacherJobNumber,
      improvementArea: payload.improvementArea,
      relatedIndicator: payload.relatedIndicatorText || payload.relatedIndicator,
      goal: payload.developmentalGoal || payload.goal,
      procedure: payload.actionProcedure || payload.procedure,
      responsible: payload.responsiblePerson || payload.responsible,
      duration: payload.duration,
      followUpDate: payload.followUpDate,
      status: payload.status,
      createdAt: payload.createdAt || new Date().toISOString()
    };
    return upsertObjectRow_('ImprovementPlans', planRow, 'id', schoolId);
  }
  if (action === 'saveSettings') {
    if (!requireRole_(session, ['platform_admin', 'school_admin'])) return { success: false, error: 'تعديل الإعدادات مقتصر على إدارة المنصة والمدرسة.' };
    return saveSettingsRows_(payload, session.name);
  }
  if (action === 'deleteTeacher') {
    if (!requireRole_(session, ['platform_admin', 'school_admin'])) return { success: false, error: 'ليست لديك صلاحية حذف المعلمين.' };
    return deleteById_('Teachers', payload.id, schoolId);
  }
  if (action === 'deleteVisit') {
    if (!requireRole_(session, ['platform_admin', 'school_admin'])) return { success: false, error: 'ليست لديك صلاحية حذف الزيارات.' };
    return deleteVisitRows_(payload.id, schoolId);
  }
  return { success: false, error: 'عملية API غير مدعومة: ' + action };
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
