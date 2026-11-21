import React, { useState, useEffect } from 'react';
import { 
  User, 
  Teacher, 
  ClassroomVisit, 
  ImprovementPlan, 
  AcademicSettings, 
  PlatformSettings,
  AuditLogEntry,
  RegisteredVisitor,
  normalizeUserRole
} from './types';
import { DEFAULT_ACADEMIC_SETTINGS, DEFAULT_PLATFORM_SETTINGS, DEFAULT_USERS } from './data/defaultData';
import { clearAtharRemoteSession } from './services/gasBridgeClient';
import { loadCentralData, changeVisitStatusCentral, archiveVisitsCentral, restoreVisitsCentral } from './services/centralDataService';
import { Header } from './components/Header';
import { PublicHome } from './components/PublicHome';
import { Dashboard } from './components/Dashboard';
import { MonitoringDashboard } from './components/MonitoringDashboard';
import { TeachersList } from './components/TeachersList';
import { VisitsList } from './components/VisitsList';
import { VisitForm } from './components/VisitForm';
import { VisitReportModal } from './components/VisitReportModal';
import { TeacherReportView } from './components/TeacherReportView';
import { ImprovementPlansList } from './components/ImprovementPlansList';
import { AcademicSettingsView } from './components/AcademicSettingsView';
import { PlatformSettingsView } from './components/PlatformSettingsView';
import { GasIntegrationHub } from './components/GasIntegrationHub';
import { ReportsView } from './components/ReportsView';
import { LoginModal } from './components/LoginModal';
import { 
  Shield, 
  CheckCircle, 
  UserCheck, 
  X, 
  Sparkles,
  School,
  Database
} from 'lucide-react';
import { translations, Language } from './i18n/translations';

export default function App() {
  // Language State with persistence
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('athar_language_pref') as Language) || 'ar';
  });

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    localStorage.setItem('athar_language_pref', language);
  }, [language]);

  // Authentication & Current User - Defaults to logged-out on start to open on the Public Homepage
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USERS[0]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Active Navigation Tab - Starts on the Home page with the hero picture
  const [activeTab, setActiveTab] = useState<string>('home');

  // Application Data State
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [visits, setVisits] = useState<ClassroomVisit[]>([]);
  const [plans, setPlans] = useState<ImprovementPlan[]>([]);
  const [archivedPlans, setArchivedPlans] = useState<ImprovementPlan[]>([]);
  const [academicSettings, setAcademicSettings] = useState<AcademicSettings>(DEFAULT_ACADEMIC_SETTINGS);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [registeredVisitors, setRegisteredVisitors] = useState<RegisteredVisitor[]>([]);

  // Selected sub-views state
  const [selectedVisitForReport, setSelectedVisitForReport] = useState<ClassroomVisit | null>(null);
  const [selectedTeacherForReport, setSelectedTeacherForReport] = useState<Teacher | null>(null);
  const [editingVisit, setEditingVisit] = useState<ClassroomVisit | null>(null);

  // Load all operational data from the authenticated central database.
  const refreshAllData = async () => {
    try {
      const data = await loadCentralData();
      setTeachers(data.teachers);
      setVisits(data.visits);
      setPlans(data.plans);
      setArchivedPlans(data.archivedPlans);
      setAcademicSettings(data.academicSettings);
      setPlatformSettings(data.platformSettings);
      setAuditLogs(data.auditLogs);
      setRegisteredVisitors(data.registeredVisitors);
    } catch (error) {
      console.error('تعذر تحميل بيانات أَثَر المركزية:', error);
      throw error;
    }
  };

  // Handle user switch
  const handleUserChange = (newUser: User) => {
    const normalizedRole = normalizeUserRole(newUser.role);
    const safeUser = normalizedRole ? { ...newUser, role: normalizedRole } : newUser;
    setCurrentUser(safeUser);
    // Never carry a previously selected teacher/visit across account changes.
    setSelectedVisitForReport(null);
    setSelectedTeacherForReport(null);
    setEditingVisit(null);
    // If switched to teacher, make sure they aren't on admin-only tabs
    if (safeUser.role === 'teacher' && ['settings', 'new-visit'].includes(activeTab)) {
      setActiveTab('dashboard');
    }
  };

  // Logout handler
  const handleLogout = () => {
    clearAtharRemoteSession();
    setIsLoggedIn(false);
    setCurrentUser(DEFAULT_USERS[0]);
    setSelectedVisitForReport(null);
    setSelectedTeacherForReport(null);
    setEditingVisit(null);
    setTeachers([]);
    setVisits([]);
    setPlans([]);
    setArchivedPlans([]);
    setAuditLogs([]);
    setRegisteredVisitors([]);
    setActiveTab('home');
  };

  // Administrative views are guarded here as well as in the navigation.
  const canAccessAdminTools = ['platform_admin', 'school_admin'].includes(normalizeUserRole(currentUser.role) || '');

  const isCurrentTeacherRecord = (record: { teacherJobNumber?: string; jobNumber?: string; teacherName?: string; fullName?: string }) => {
    if (currentUser.role !== 'teacher') return true;
    const recordJobNumber = record.teacherJobNumber || record.jobNumber || '';
    if (currentUser.jobNumber) return recordJobNumber === currentUser.jobNumber;
    const recordName = record.teacherName || record.fullName || '';
    return Boolean(currentUser.name && recordName === currentUser.name);
  };
  const visibleTeachers = currentUser.role === 'teacher'
    ? teachers.filter(teacher => isCurrentTeacherRecord(teacher))
    : teachers;
  const visibleVisits = currentUser.role === 'teacher'
    ? visits.filter(visit => isCurrentTeacherRecord(visit))
    : visits;
  const visiblePlans = currentUser.role === 'teacher'
    ? plans.filter(plan => isCurrentTeacherRecord(plan))
    : plans;
  const visibleArchivedPlans = currentUser.role === 'teacher'
    ? archivedPlans.filter(plan => isCurrentTeacherRecord(plan))
    : archivedPlans;

  // Navigation router
  const handleNavigate = (tab: string, param?: any) => {
    if ((tab === 'settings' || tab === 'gas-hub') && !canAccessAdminTools) {
      setActiveTab('dashboard');
      return;
    }
    if (tab === 'new-visit' && currentUser.role === 'teacher') {
      setActiveTab('dashboard');
      return;
    }
    if (tab === 'new-visit') {
      setEditingVisit(null);
    }
    setActiveTab(tab);
  };

  return (
    <div 
      className={`min-h-screen bg-[#F2EBDD]/20 text-[#172C40] flex flex-col ${language === 'ar' ? "font-['Cairo',sans-serif]" : "font-sans"}`} 
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        onUserChange={handleUserChange}
        activeTab={activeTab}
        onTabChange={handleNavigate}
        platformSettings={platformSettings}
        isLoggedIn={isLoggedIn}
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogoutClick={handleLogout}
        language={language}
        onLanguageChange={setLanguage}
      />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* View 1: Public Homepage */}
        {(!isLoggedIn || activeTab === 'home') && (
          <PublicHome
            platformSettings={platformSettings}
            onLoginClick={() => setIsLoginModalOpen(true)}
            language={language}
          />
        )}

        {/* When Logged In: Core Educational Modules */}
        {isLoggedIn && activeTab === 'dashboard' && (
          <Dashboard
            currentUser={currentUser}
            visits={visibleVisits}
            teachers={visibleTeachers}
            plans={visiblePlans}
            onNavigate={handleNavigate}
            onOpenVisitReport={(v) => setSelectedVisitForReport(v)}
            language={language}
          />
        )}

        {isLoggedIn && activeTab === 'monitoring' && ['platform_admin', 'school_admin', 'vice_principal'].includes(normalizeUserRole(currentUser.role) || '') && (
          <MonitoringDashboard
            currentUser={currentUser}
            visits={visits}
            teachers={teachers}
            plans={plans}
            auditLogs={auditLogs}
            onOpenVisitReport={(v) => setSelectedVisitForReport(v)}
            language={language}
          />
        )}

        {isLoggedIn && activeTab === 'teachers' && (
          <TeachersList
            teachers={visibleTeachers}
            currentUser={currentUser}
            onRefreshTeachers={refreshAllData}
            onOpenTeacherReport={(teacher) => {
              setSelectedTeacherForReport(teacher);
              setActiveTab('teacher-report');
            }}
            language={language}
          />
        )}

        {isLoggedIn && activeTab === 'visits' && (
          <VisitsList
            visits={visibleVisits}
            currentUser={currentUser}
            onOpenReport={(v) => setSelectedVisitForReport(v)}
            onEditVisit={(v) => {
              setEditingVisit(v);
              setActiveTab('new-visit');
            }}
            onCreateNewVisit={() => {
              setEditingVisit(null);
              setActiveTab('new-visit');
            }}
            onRefreshVisits={refreshAllData}
            language={language}
          />
        )}

        {isLoggedIn && currentUser.role !== 'teacher' && activeTab === 'new-visit' && (
          <VisitForm
            currentUser={currentUser}
            teachers={teachers}
            academicSettings={academicSettings}
            registeredVisitors={registeredVisitors}
            editingVisit={editingVisit}
            onSaveSuccess={async (saved) => {
              try {
                await refreshAllData();
                setSelectedVisitForReport(saved);
                setActiveTab('visits');
              } catch (error) {
                alert(error instanceof Error ? `تم حفظ الزيارة، لكن تعذر تحديث البيانات المعروضة: ${error.message}` : 'تم حفظ الزيارة، لكن تعذر تحديث البيانات المعروضة. أعد تحميل الصفحة.');
              }
            }}
            onCancel={() => setActiveTab('visits')}
            onRefreshData={refreshAllData}
            language={language}
          />
        )}

        {isLoggedIn && activeTab === 'plans' && (
          <ImprovementPlansList
            plans={visiblePlans}
            archivedPlans={visibleArchivedPlans}
            teachers={visibleTeachers}
            currentUser={currentUser}
            onRefreshPlans={refreshAllData}
            language={language}
          />
        )}

        {isLoggedIn && activeTab === 'reports' && (
          <ReportsView
            visits={visibleVisits}
            teachers={visibleTeachers}
            plans={visiblePlans}
            platformSettings={platformSettings}
            onOpenVisitReport={(v) => setSelectedVisitForReport(v)}
            onOpenTeacherReport={(t) => {
              setSelectedTeacherForReport(t);
              setActiveTab('teacher-report');
            }}
            canManageReports={['platform_admin', 'school_admin', 'vice_principal'].includes(currentUser.role)}
            onArchiveReports={async (ids) => {
              await archiveVisitsCentral(ids);
              await refreshAllData();
            }}
            onRestoreReports={async (ids) => {
              await restoreVisitsCentral(ids);
              await refreshAllData();
            }}
            language={language}
          />
        )}

        {isLoggedIn && activeTab === 'teacher-report' && selectedTeacherForReport && (
          <TeacherReportView
            teacher={selectedTeacherForReport}
            visits={visibleVisits}
            plans={visiblePlans}
            platformSettings={platformSettings}
            onBack={() => setActiveTab('teachers')}
            onOpenVisitReport={(v) => setSelectedVisitForReport(v)}
            language={language}
          />
        )}

        {isLoggedIn && canAccessAdminTools && activeTab === 'gas-hub' && (
          <GasIntegrationHub language={language} />
        )}

        {isLoggedIn && canAccessAdminTools && activeTab === 'settings' && (
          <div className="space-y-8">
            <PlatformSettingsView
              settings={platformSettings}
              currentUser={currentUser}
              auditLogs={auditLogs}
              onRefreshSettings={refreshAllData}
              onCurrentUserUpdate={handleUserChange}
              language={language}
            />
            <AcademicSettingsView
              settings={academicSettings}
              currentUser={currentUser}
              onRefreshSettings={refreshAllData}
              language={language}
            />
          </div>
        )}

      </main>

      {/* Official Printable Visit Report Modal */}
      {selectedVisitForReport && (
        <VisitReportModal
          visit={selectedVisitForReport}
          platformSettings={platformSettings}
          onClose={() => setSelectedVisitForReport(null)}
          language={language}
          canDelete={['platform_admin', 'school_admin', 'vice_principal'].includes(currentUser.role)}
          onDeleteReport={async (visitId) => {
            await changeVisitStatusCentral(visitId, 'archived');
            await refreshAllData();
          }}
        />
      )}

      {/* Username & Password Login Modal */}
      {isLoginModalOpen && (
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={(user) => {
            handleUserChange(user);
            setIsLoginModalOpen(false);
            void refreshAllData()
              .then(() => {
                setIsLoggedIn(true);
                setActiveTab('dashboard');
              })
              .catch((error) => {
                clearAtharRemoteSession();
                setIsLoggedIn(false);
                setCurrentUser(DEFAULT_USERS[0]);
                setTeachers([]);
                setVisits([]);
                setPlans([]);
    setArchivedPlans([]);
                setAuditLogs([]);
                setRegisteredVisitors([]);
                setActiveTab('home');
                alert(error instanceof Error ? error.message : 'تعذر تحميل بيانات المنصة. أُغلقت الجلسة لحماية سلامة البيانات.');
              });
          }}
          language={language}
        />
      )}

      {/* Footer (No telemetry, clean institutional branding) */}
      <footer className="no-print bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{language === 'ar' ? `${platformSettings.platformName} — ${platformSettings.platformTitle}` : `${translations.en.platformName} — ${translations.en.platformTitle}`}</span>
          <span className="text-[#C6A66A] font-bold">{language === 'ar' ? platformSettings.slogan : translations.en.slogan}</span>
          <span>{language === 'ar' ? platformSettings.schoolName : translations.en.schoolName}</span>
        </div>
      </footer>

    </div>
  );
}
