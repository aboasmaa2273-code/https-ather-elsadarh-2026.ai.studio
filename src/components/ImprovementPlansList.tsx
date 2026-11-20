import React, { useState } from 'react';
import { ImprovementPlan, Teacher, User } from '../types';
import { AtharStorageService } from '../services/storageService';
import { savePlanCentral, savePlanFollowUpCentral, archivePlansCentral, restorePlansCentral } from '../services/centralDataService';
import { OFFICIAL_INDICATORS } from '../data/defaultData';
import { 
  PlusCircle, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  TrendingUp, 
  X,
  FileCheck,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { translations, Language } from '../i18n/translations';

interface ImprovementPlansListProps {
  plans: ImprovementPlan[];
  archivedPlans?: ImprovementPlan[];
  teachers: Teacher[];
  currentUser: User;
  onRefreshPlans: () => void;
  initiallyOpenCreate?: boolean;
  language?: Language;
}

export const ImprovementPlansList: React.FC<ImprovementPlansListProps> = ({
  plans,
  archivedPlans = [],
  teachers,
  currentUser,
  onRefreshPlans,
  initiallyOpenCreate = false,
  language = 'ar'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(initiallyOpenCreate);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [selectedPlanForFollowUp, setSelectedPlanForFollowUp] = useState<ImprovementPlan | null>(null);

  const t = translations[language];
  const isEn = language === 'en';

  // New Plan form fields
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || '');
  const [improvementArea, setImprovementArea] = useState(isEn ? 'Teaching Practices & Formative Assessment' : 'الممارسات التدريسية والتقويم الصفي');
  const [relatedIndicatorText, setRelatedIndicatorText] = useState(
    isEn ? (OFFICIAL_INDICATORS[7]?.textEn || OFFICIAL_INDICATORS[7]?.text || '') : OFFICIAL_INDICATORS[7]?.text || ''
  );
  const [developmentalGoal, setDevelopmentalGoal] = useState('');
  const [actionProcedure, setActionProcedure] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState(currentUser.name);
  const [duration, setDuration] = useState(isEn ? '2 Weeks' : 'أسبوعان');
  const [followUpDate, setFollowUpDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Follow-up modal fields
  const [followUpStatus, setFollowUpStatus] = useState<ImprovementPlan['status']>('completed');
  const [followUpResult, setFollowUpResult] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  const isTeacher = currentUser.role === 'teacher';
  const canCreate = AtharStorageService.canCreatePlan(currentUser);
  const canManagePlanArchive = ['platform_admin', 'school_admin', 'vice_principal', 'evaluator'].includes(currentUser.role);

  // Filter plans based on role and query
  const visiblePlans = (showArchived ? archivedPlans : plans).filter(p => {
    if (isTeacher && p.teacherJobNumber !== currentUser.jobNumber && p.teacherName !== currentUser.name) {
      return false;
    }

    const matchesSearch = 
      p.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.improvementArea.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleArchivePlans = async (ids: string[]) => {
    if (!ids.length) return;
    if (!confirm(isEn ? `Archive ${ids.length} selected plan(s)? They can be restored later.` : `هل تريد أرشفة ${ids.length} خطة محددة؟ يمكن استعادتها لاحقًا.`)) return;
    try {
      await archivePlansCentral(ids);
      setSelectedPlanIds([]);
      await onRefreshPlans();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر أرشفة خطط التطوير.');
    }
  };

  const handleRestorePlans = async (ids: string[]) => {
    if (!ids.length) return;
    if (!confirm(isEn ? `Restore ${ids.length} selected plan(s)?` : `هل تريد استعادة ${ids.length} خطة محددة؟`)) return;
    try {
      await restorePlansCentral(ids);
      setSelectedPlanIds([]);
      await onRefreshPlans();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر استعادة خطط التطوير.');
    }
  };

  const toggleAllVisiblePlans = () => {
    const visibleIds = visiblePlans.map(plan => plan.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedPlanIds.includes(id));
    setSelectedPlanIds(current => allSelected
      ? current.filter(id => !visibleIds.includes(id))
      : Array.from(new Set([...current, ...visibleIds])));
  };

  const handleCreatePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tch = teachers.find(t => t.id === teacherId);
    if (!tch) return;

    try {
      await savePlanCentral({
      schoolId: 'sch_alsadara_01',
      teacherId: tch.id,
      teacherName: tch.fullName,
      teacherJobNumber: tch.jobNumber,
      improvementArea,
      relatedIndicatorText,
      developmentalGoal,
      actionProcedure,
      responsiblePerson,
      duration,
      followUpDate,
      status: 'in_progress'
      });
      setIsCreateModalOpen(false);
      await onRefreshPlans();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حفظ خطة التطوير.');
    }
  };

  const handleOpenFollowUp = (plan: ImprovementPlan) => {
    setSelectedPlanForFollowUp(plan);
    setFollowUpStatus(plan.status === 'completed' ? 'completed' : 'completed');
    setFollowUpResult(plan.followUpResult || '');
    setFollowUpNotes(plan.followUpNotes || '');
    setIsFollowUpModalOpen(true);
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForFollowUp) return;

    try {
      await savePlanFollowUpCentral(selectedPlanForFollowUp.id, {
        status: followUpStatus,
        followUpResult,
        followUpNotes,
        followUpDate: new Date().toISOString().slice(0, 10)
      });
      setIsFollowUpModalOpen(false);
      await onRefreshPlans();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حفظ متابعة خطة التطوير.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#172C40] font-['Tajawal']">{t.plans.title}</h2>
          <p className="text-xs text-[#64748B] mt-1">
            {t.plans.subtitle}
          </p>
        </div>

        {canCreate && !showArchived && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-[#172C40] text-white rounded-lg text-xs font-bold hover:bg-[#101F2D] transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-[#C6A66A]" />
            <span>{t.plans.addNewPlan}</span>
          </button>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className={`w-4 h-4 text-slate-400 absolute ${isEn ? 'left-3' : 'right-3'} top-2.5`} />
          <input
            type="text"
            placeholder={t.plans.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full ${isEn ? 'pl-9 pr-3' : 'pr-9 pl-3'} py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#172C40]`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button type="button" onClick={() => { setShowArchived(false); setSelectedPlanIds([]); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${!showArchived ? 'bg-[#172C40] text-white border-[#172C40]' : 'bg-white text-slate-600 border-slate-200'}`}>
            {isEn ? 'Active plans' : 'الخطط النشطة'}
          </button>
          <button type="button" onClick={() => { setShowArchived(true); setSelectedPlanIds([]); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${showArchived ? 'bg-[#172C40] text-white border-[#172C40]' : 'bg-white text-slate-600 border-slate-200'}`}>
            {isEn ? 'Archive' : 'الأرشيف'}
          </button>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="ALL">{t.common.all}</option>
            <option value="in_progress">{t.status.in_progress}</option>
            <option value="needs_follow_up">{t.status.needs_follow_up}</option>
            <option value="completed">{t.status.completed}</option>
          </select>
        </div>
      </div>

      {canManagePlanArchive && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={toggleAllVisiblePlans} disabled={!visiblePlans.length} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer">
            {isEn ? 'Select all visible' : 'تحديد كل الخطط الظاهرة'}
          </button>
          {showArchived ? (
            <button type="button" onClick={() => handleRestorePlans(selectedPlanIds)} disabled={!selectedPlanIds.length} className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> {isEn ? 'Restore selected' : `استعادة المحدد (${selectedPlanIds.length})`}
            </button>
          ) : (
            <button type="button" onClick={() => handleArchivePlans(selectedPlanIds)} disabled={!selectedPlanIds.length} className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> {isEn ? 'Archive selected' : `أرشفة المحدد (${selectedPlanIds.length})`}
            </button>
          )}
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visiblePlans.length > 0 ? (
          visiblePlans.map((plan) => (
            <div key={plan.id} className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4 hover:border-[#C6A66A] transition-all">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-[10px] text-slate-400 block">{plan.id}</span>
                  <h3 className="font-bold text-sm text-[#172C40] mt-0.5">{plan.teacherName}</h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {t.teachers.colJobNumber}: {plan.teacherJobNumber}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {canManagePlanArchive && <input aria-label={`Select plan ${plan.id}`} type="checkbox" checked={selectedPlanIds.includes(plan.id)} onChange={() => setSelectedPlanIds(current => current.includes(plan.id) ? current.filter(id => id !== plan.id) : [...current, plan.id])} />}
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                    plan.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                    plan.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    plan.status === 'needs_follow_up' ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {AtharStorageService.getPlanStatusLabel(plan.status, language)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                <div>
                  <span className="text-slate-400 text-[10px] block">
                    {isEn ? 'Growth Area & Targeted Indicator:' : 'مجال التحسين والمؤشر المرتبط:'}
                  </span>
                  <span className="font-bold text-[#172C40]">{plan.improvementArea}</span>
                  <span className="text-[11px] text-[#668575] block mt-0.5">{plan.relatedIndicatorText}</span>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-400 text-[10px] block">
                    {isEn ? 'Developmental Goal:' : 'الهدف التطويري:'}
                  </span>
                  <p className="text-slate-800 font-medium">{plan.developmentalGoal}</p>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-400 text-[10px] block">{t.plans.colProcedure}:</span>
                  <p className="text-slate-700">{plan.actionProcedure}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                <div>
                  <span>{isEn ? 'Responsible:' : 'المسؤول:'} <strong className="text-slate-800">{plan.responsiblePerson}</strong></span>
                  <span className="mx-1.5">·</span>
                  <span>{isEn ? 'Duration:' : 'المدة:'} <strong>{plan.duration}</strong></span>
                </div>
                <div className="font-mono">
                  <span>{t.plans.colFollowUpDate}: <strong className="text-[#172C40]">{plan.followUpDate}</strong></span>
                </div>
              </div>

              {plan.followUpResult && (
                <div className="p-2.5 rounded bg-emerald-50/70 border border-emerald-100 text-[11px]">
                  <strong className="text-emerald-900">{isEn ? 'Follow-Up Result: ' : 'نتيجة المتابعة: '}</strong>
                  <span className="text-emerald-950">{plan.followUpResult}</span>
                  {plan.followUpNotes && (
                    <p className="text-slate-600 mt-1">{plan.followUpNotes}</p>
                  )}
                </div>
              )}

              {/* Action buttons (evaluator / admin) */}
              {!isTeacher && (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                  {!showArchived && (
                    <button
                      onClick={() => handleOpenFollowUp(plan)}
                      className="px-3 py-1 bg-[#F2EBDD] text-[#172C40] hover:bg-[#e4d7bf] rounded text-xs font-bold transition-colors cursor-pointer"
                    >
                      {t.plans.followUpBtn}
                    </button>
                  )}
                  {canManagePlanArchive && (showArchived ? (
                    <button type="button" onClick={() => handleRestorePlans([plan.id])} className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-bold cursor-pointer flex items-center gap-1">
                      <RotateCcw className="w-3.5 h-3.5" /> {isEn ? 'Restore' : 'استعادة'}
                    </button>
                  ) : (
                    <button type="button" onClick={() => handleArchivePlans([plan.id])} className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs font-bold cursor-pointer flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> {isEn ? 'Archive' : 'أرشفة'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-2 p-12 bg-white border border-dashed rounded-xl text-center text-slate-400 text-xs">
            {isEn ? 'No professional development plans match your query.' : 'لا توجد خطط تطوير مهني مسجلة تطابق البحث.'}
          </div>
        )}
      </div>

      {/* Create Plan Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#172C40]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#172C40] text-white">
              <h3 className="font-bold text-sm font-['Tajawal']">{t.plans.addNewPlan}</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg text-white/80 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlanSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#172C40] mb-1">{t.visits.teacherLabel} *</label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  {teachers.map(tch => (
                    <option key={tch.id} value={tch.id}>{tch.fullName} ({tch.jobNumber} - {tch.specialization})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#172C40] mb-1">{isEn ? 'Growth / Improvement Area *' : 'مجال التحسين *'}</label>
                <input
                  type="text"
                  required
                  placeholder={isEn ? 'e.g. Teaching Practices & Formative Assessment' : 'مثال: الممارسات التدريسية والتقويم الصفي'}
                  value={improvementArea}
                  onChange={(e) => setImprovementArea(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-[#172C40] mb-1">{t.plans.colIndicator} *</label>
                <select
                  value={relatedIndicatorText}
                  onChange={(e) => setRelatedIndicatorText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {OFFICIAL_INDICATORS.map(ind => (
                    <option key={ind.id} value={`${isEn ? (ind.textEn || ind.text) : ind.text} (${isEn ? 'Indicator' : 'مؤشر'} ${ind.id})`}>
                      {ind.id}. {isEn ? (ind.textEn || ind.text) : ind.text}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#172C40] mb-1">{isEn ? 'Measurable Developmental Goal *' : 'الهدف التطويري القابل للقياس *'}</label>
                <textarea
                  required
                  rows={2}
                  placeholder={isEn ? 'Specific observable outcome targeted in the next observation...' : 'صياغة هدف عملي محدد وقابل للملاحظة المباشرة في الزيارة القادمة...'}
                  value={developmentalGoal}
                  onChange={(e) => setDevelopmentalGoal(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-[#172C40] mb-1">{t.plans.colProcedure} *</label>
                <textarea
                  required
                  rows={2}
                  placeholder={isEn ? 'Workshop attendance, peer modeling, sample rubrics creation...' : 'حضور ورشة تخصصية، تبادل زيارات مع زميل متميز، تصميم أنشطة متمايزة...'}
                  value={actionProcedure}
                  onChange={(e) => setActionProcedure(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#172C40] mb-1">{isEn ? 'Duration' : 'المدة المقترحة'}</label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#172C40] mb-1">{t.plans.colFollowUpDate} *</label>
                  <input
                    type="date"
                    required
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#172C40] text-white rounded-lg font-bold hover:bg-[#101F2D] cursor-pointer"
                >
                  {isEn ? 'Assign Plan' : 'إسناد الخطة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {isFollowUpModalOpen && selectedPlanForFollowUp && (
        <div className="fixed inset-0 z-50 bg-[#172C40]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#172C40] text-white">
              <h3 className="font-bold text-sm font-['Tajawal']">{t.plans.followUpModalTitle}</h3>
              <button onClick={() => setIsFollowUpModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg text-white/80 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFollowUpSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-bold text-[#172C40]">{selectedPlanForFollowUp.teacherName}</div>
                <div className="text-[11px] text-[#668575] mt-0.5">{selectedPlanForFollowUp.developmentalGoal}</div>
              </div>

              <div>
                <label className="block font-bold text-[#172C40] mb-1">{t.plans.changeStatusLabel} *</label>
                <select
                  value={followUpStatus}
                  onChange={(e) => setFollowUpStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="completed">{t.status.completed}</option>
                  <option value="in_progress">{t.status.in_progress}</option>
                  <option value="needs_follow_up">{t.status.needs_follow_up}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#172C40] mb-1">{t.plans.resultLabel} *</label>
                <textarea
                  required
                  rows={3}
                  placeholder={isEn ? 'Document verified pedagogical growth in next visit...' : 'توثيق مدى تحقق الهدف في الزيارة اللاحقة والشواهد المشاهدة...'}
                  value={followUpResult}
                  onChange={(e) => setFollowUpResult(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-[#172C40] mb-1">{t.plans.notesLabel}</label>
                <input
                  type="text"
                  placeholder={isEn ? 'Additional recommendations or next milestones...' : 'توصيات أو خطوات إضافية (اختياري)...'}
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#172C40] text-white rounded-lg font-bold hover:bg-[#101F2D] cursor-pointer"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
