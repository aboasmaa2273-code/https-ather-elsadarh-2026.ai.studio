import React, { useState, useEffect } from 'react';
import { 
  User, 
  Teacher, 
  ClassroomVisit, 
  ImprovementPlan, 
  AcademicSettings, 
  PlatformSettings,
  AuditLogEntry
} from './types';
import { AtharStorageService } from './services/storageService';
import { atharRemoteBootstrap, atharRemoteAction, clearAtharRemoteSession } from './services/gasBridgeClient';
import { Header } from './components/Header';
import { PublicHome } from './components/PublicHome';
import { PublicConnectionSetup } from './components/PublicConnectionSetup';
import { Dashboard } from './components/Dashboard';
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
import { DEFAULT_ACADEMIC_SETTINGS, DEFAULT_PLATFORM_SETTINGS } from './data/defaultData';

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
  const [currentUser, setCurrentUser] = useState<User>(() => AtharStorageService.getCurrentUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Active Navigation Tab - Starts on the Home page with the hero picture
  const [activeTab, setActiveTab] = useState<string>('home');

  // Application Data State
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [visits, setVisits] = useState<ClassroomVisit[]>([]);
  const [plans, setPlans] = useState<ImprovementPlan[]>([]);
  const [academicSettings, setAcademicSettings] = useState<AcademicSettings>(DEFAULT_ACADEMIC_SETTINGS);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [dataConnectionError, setDataConnectionError] = useState<string>('');

  // Selected sub-views state
  const [selectedVisitForReport, setSelectedVisitForReport] = useState<ClassroomVisit | null>(null);
  const [selectedTeacherForReport, setSelectedTeacherForReport] = useState<Teacher | null>(null);
  const [editingVisit, setEditingVisit] = useState<ClassroomVisit | null>(null);

  // Load initial data
  const refreshAllData = async (requireCentral = isLoggedIn) => {
    setAcademicSettings(DEFAULT_ACADEMIC_SETTINGS);
    setPlatformSettings(DEFAULT_PLATFORM_SETTINGS);
    setAuditLogs([]);
    try {
      const remote = await atharRemoteBootstrap() as any;
      setTeachers(Array.isArray(remote.teachers) ? remote.teachers : []);
      setVisits(Array.isArray(remote.visits) ? remote.visits : []);
      setPlans(Array.isArray(remote.plans) ? remote.plans : []);
      setAuditLogs(Array.isArray(remote.auditLogs) ? remote.auditLogs : []);
      const centralSettings: Record<string, any> = {};
      (Array.isArray(remote.settings) ? remote.settings : []).forEach((item: any) => {
        if (!item || !item.key) return;
        try { centralSettings[String(item.key)] = typeof item.value === 'string' ? JSON.parse(item.value) : item.value; }
        catch { centralSettings[String(item.key)] = item.value; }
      });
      if (centralSettings.academicSettings) setAcademicSettings(centralSettings.academicSettings);
      if (centralSettings.platformSettings) setPlatformSettings(centralSettings.platformSettings);
      setDataConnectionError('');
    } catch (error) {
      // Public landing remains usable; once authenticated, show the actual connection error.
      console.warn('Athar central data load:', error);
      if (requireCentral) {
        setTeachers([]);
        setVisits([]);
        setPlans([]);
        setDataConnectionError(error instanceof Error ? error.message : 'تعذر تحميل البيانات المركزية.');
      } else {
        setTeachers([]);
        setVisits([]);
        setPlans([]);
      }
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Handle user switch
  const handleUserChange = (newUser: User) => {
    AtharStorageService.setCurrentUser(newUser);
    setCurrentUser(newUser);
    // If switched to teacher, make sure they aren't on admin-only tabs
    if (newUser.role === 'teacher' && ['settings', 'new-visit'].includes(activeTab)) {
      setActiveTab('dashboard');
    }
  };

  // Login handler
  const handleSelectRoleToLogin = (user: User) => {
    handleUserChange(user);
    setIsLoggedIn(true);
    void refreshAllData(true);
    setIsLoginModalOpen(false);
    setActiveTab('dashboard');
  };

  // Logout handler
  const handleLogout = () => {
    clearAtharRemoteSession();
    setIsLoggedIn(false);
    setActiveTab('home');
  };

  // Navigation router
  const handleNavigate = (tab: string, param?: any) => {
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
        onTabChange={setActiveTab}
        platformSettings={platformSettings}
        isLoggedIn={isLoggedIn}
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogoutClick={handleLogout}
        language={language}
        onLanguageChange={setLanguage}
      />

      {dataConnectionError && isLoggedIn && (
        <div role="alert" className="mx-auto mt-3 w-full max-w-7xl px-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            تعذر الاتصال بقاعدة بيانات أَثَر المركزية. لم نعرض بيانات الجهاز المحلية بدلاً منها، حتى لا تظهر سجلات غير محدثة أو تخص مستخدمًا آخر. التفاصيل: {dataConnectionError}
          </div>
        </div>
      )}

            {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!isLoggedIn && <PublicConnectionSetup language={language} />}
        
        {/* View 1: Public Homepage */}
        {(!isLoggedIn || activeTab === 'home') && (
          <PublicHome
            platformSettings={platformSettings}
            onLoginClick={() => setIsLoginModalOpen(true)}
            onSelectEvaluator={() => {
              // Public evaluator cards are directory information only; authentication
              // must always be completed against the central Users table.
              setIsLoginModalOpen(true);
            }}
            language={language}
          />
        )}

        {/* When Logged In: Core Educational Modules */}
        {isLoggedIn && activeTab === 'dashboard' && (
          <Dashboard
            currentUser={currentUser}
            visits={visits}
            teachers={teachers}
            plans={plans}
            onNavigate={handleNavigate}
            onOpenVisitReport={(v) => setSelectedVisitForReport(v)}
            language={language}
          />
        )}

        {isLoggedIn && activeTab === 'teachers' && (
          <TeachersList
            teachers={teachers}
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
            visits={visits}
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

        {isLoggedIn && activeTab === 'new-visit' && (
          <VisitForm
            currentUser={currentUser}
            teachers={teachers}
            academicSettings={academicSettings}
            editingVisit={editingVisit}
            onSaveSuccess={(saved) => {
              refreshAllData();
              setSelectedVisitForReport(saved);
              setActiveTab('visits');
            }}
            onCancel={() => setActiveTab('visits')}
            language={language}
          />
        )}

        {isLoggedIn && activeTab === 'plans' && (
          <ImprovementPlansList
            plans={plans}
            teachers={teachers}
            currentUser={currentUser}
            onRefreshPlans={refreshAllData}
            language={language}
          />
        )}

        {isLoggedIn && activeTab === 'reports' && (
          <ReportsView
            visits={visits}
            teachers={teachers}
            plans={plans}
            platformSettings={platformSettings}
            onOpenVisitReport={(v) => setSelectedVisitForReport(v)}
            onOpenTeacherReport={(t) => {
              setSelectedTeacherForReport(t);
              setActiveTab('teacher-report');
            }}
            language={language}
          />
        )}

        {isLoggedIn && activeTab === 'teacher-report' && selectedTeacherForReport && (
          <TeacherReportView
            teacher={selectedTeacherForReport}
            visits={visits}
            plans={plans}
            platformSettings={platformSettings}
            onBack={() => setActiveTab('teachers')}
            onOpenVisitReport={(v) => setSelectedVisitForReport(v)}
            language={language}
          />
        )}

        {isLoggedIn && activeTab === 'gas-hub' && (
          <GasIntegrationHub language={language} />
        )}

        {isLoggedIn && activeTab === 'settings' && (
          <div className="space-y-8">
            <PlatformSettingsView
              settings={platformSettings}
              currentUser={currentUser}
              auditLogs={auditLogs}
              onRefreshSettings={refreshAllData}
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
          canDelete={['school_admin', 'platform_admin'].includes(currentUser.role)}
          onDeleteReport={async (visitId) => {
            try {
              await atharRemoteAction('deleteVisit', { id: visitId });
              await refreshAllData(true);
            } catch (error) {
              alert(error instanceof Error ? error.message : 'تعذر حذف الزيارة من قاعدة البيانات المركزية.');
            }
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
            void refreshAllData(true);
            setIsLoggedIn(true);
            setIsLoginModalOpen(false);
            setActiveTab('dashboard');
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
