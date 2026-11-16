import React, { useMemo, useState } from 'react';
import { ClassroomVisit, Teacher, ImprovementPlan, User, AdministrativeFollowUp, VisitHistoryEntry } from '../types';
import { AdministrativeFollowUpsPanel } from './AdministrativeFollowUpsPanel';
import { Search, Filter, RotateCcw, ClipboardList, Users, CheckCircle2, Clock3, CalendarDays, Eye, Download, Printer } from 'lucide-react';

interface FollowUpDashboardProps {
  currentUser: User;
  visits: ClassroomVisit[];
  teachers: Teacher[];
  plans: ImprovementPlan[];
  followUps: AdministrativeFollowUp[];
  visitHistory: VisitHistoryEntry[];
  onRefresh: () => void;
  onOpenVisitReport: (visit: ClassroomVisit) => void;
}

const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#172C40] outline-none focus:border-[#C6A66A] focus:ring-2 focus:ring-[#C6A66A]/20";

export const FollowUpDashboard: React.FC<FollowUpDashboardProps> = ({
  currentUser, visits, teachers, plans, followUps, visitHistory, onRefresh, onOpenVisitReport
}) => {
  const [search, setSearch] = useState('');
  const [teacherId, setTeacherId] = useState('all');
  const [evaluator, setEvaluator] = useState('all');
  const [academicYear, setAcademicYear] = useState('all');
  const [term, setTerm] = useState('all');
  const [visitType, setVisitType] = useState('all');
  const [subject, setSubject] = useState('all');
  const [grade, setGrade] = useState('all');
  const [section, setSection] = useState('all');
  const [status, setStatus] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [indicatorId, setIndicatorId] = useState('all');
  const [indicatorRating, setIndicatorRating] = useState('all');
  const [strengthFilter, setStrengthFilter] = useState('all');
  const [improvementFilter, setImprovementFilter] = useState('all');
  const [followUpStatus, setFollowUpStatus] = useState('all');
  const [expandedHistory, setExpandedHistory] = useState<string[]>([]);

  const options = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a,b) => a.localeCompare(b, 'ar'));
  const years = options(visits.map(v => v.academicYear || ''));
  const evaluators = options(visits.map(v => v.evaluatorName || ''));
  const subjects = options(visits.map(v => v.subject || ''));
  const grades = options(visits.map(v => v.grade || ''));
  const sections = options(visits.map(v => v.section || ''));
  const indicators = Array.from(new Map(visits.flatMap(v => (v.indicators || []).map(i => [String(i.indicatorId), i.indicatorText] as [string, string]))).entries());
  const strengths = options(visits.flatMap(v => v.strengths || []));
  const improvementAreas = options(visits.flatMap(v => v.improvementAreas || []));

  const filteredVisits = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('ar');
    return visits.filter(v => {
      const haystack = [v.id, v.teacherName, v.teacherJobNumber, v.teacherSpecialization, v.evaluatorName, v.subject, v.grade, v.section, v.visitGoal]
        .join(' ').toLocaleLowerCase('ar');
      return (!q || haystack.includes(q))
        && (teacherId === 'all' || v.teacherId === teacherId)
        && (evaluator === 'all' || v.evaluatorName === evaluator)
        && (academicYear === 'all' || v.academicYear === academicYear)
        && (term === 'all' || v.term === term)
        && (visitType === 'all' || v.visitType === visitType)
        && (subject === 'all' || v.subject === subject)
        && (grade === 'all' || v.grade === grade)
        && (section === 'all' || v.section === section)
        && (status === 'all' || v.status === status)
        && (!fromDate || v.date >= fromDate)
        && (!toDate || v.date <= toDate)
        && (indicatorId === 'all' || (v.indicators || []).some(i => String(i.indicatorId) === indicatorId))
        && (indicatorRating === 'all' || (v.indicators || []).some(i => (indicatorId === 'all' || String(i.indicatorId) === indicatorId) && i.rating === indicatorRating))
        && (strengthFilter === 'all' || (v.strengths || []).includes(strengthFilter))
        && (improvementFilter === 'all' || (v.improvementAreas || []).includes(improvementFilter))
        && (followUpStatus === 'all' || followUps.some(f => f.visitId === v.id && f.status === followUpStatus));
    }).sort((a,b) => String(b.date).localeCompare(String(a.date)));
  }, [visits, teachers, search, teacherId, evaluator, academicYear, term, visitType, subject, grade, section, status, fromDate, toDate, indicatorId, indicatorRating, strengthFilter, improvementFilter, followUpStatus, followUps]);

  const matchingTeacherIds = new Set(filteredVisits.map(v => v.teacherId));
  const filteredPlans = plans.filter(p => teacherId !== 'all' ? p.teacherId === teacherId : matchingTeacherIds.has(p.teacherId));
  const completed = filteredVisits.filter(v => ['completed','approved'].includes(v.status)).length;
  const openPlans = filteredPlans.filter(p => ['not_started','in_progress','needs_follow_up'].includes(p.status)).length;
  const reset = () => {
    setSearch(''); setTeacherId('all'); setEvaluator('all'); setAcademicYear('all'); setTerm('all');
    setVisitType('all'); setSubject('all'); setGrade('all'); setSection('all'); setStatus('all');
    setFromDate(''); setToDate(''); setIndicatorId('all'); setIndicatorRating('all'); setStrengthFilter('all'); setImprovementFilter('all'); setFollowUpStatus('all');
  };
  const exportCsv = () => {
    const headers = ['رقم الزيارة','المعلم','الرقم الوظيفي','المادة','الصف','الشعبة','العام الدراسي','الفصل الدراسي','نوع الزيارة','المقيم','التاريخ','نسبة الإنجاز','الحالة'];
    const rows = filteredVisits.map(v => [v.id,v.teacherName,v.teacherJobNumber,v.subject,v.grade,v.section,v.academicYear,v.term,v.visitType==='full'?'كاملة':'سريعة',v.evaluatorName,v.date,String(v.achievementPercentage)+'%',v.status]);
    const cell = (value: unknown) => '"' + String(value ?? '').replace(/"/g,'""') + '"';
    const csv = '\\uFEFF' + [headers,...rows].map(row=>row.map(cell).join(',')).join('\\r\\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'تقارير-زيارات-أثر.csv'; link.click();
    URL.revokeObjectURL(url);
  };
  const statusLabel = (value: string) => ({
    draft: 'مسودة', in_progress: 'قيد التنفيذ', completed: 'مكتمل', approved: 'معتمد', archived: 'مؤرشف'
  } as Record<string,string>)[value] || value;
  const selectFilter = (label: string, value: string, setter: (v:string)=>void, values: string[]) => (
    <label className="block space-y-1"><span className="text-xs font-bold text-slate-600">{label}</span>
      <select className={fieldClass} value={value} onChange={e=>setter(e.target.value)}>
        <option value="all">الكل</option>{values.map(v=><option key={v} value={v}>{v}</option>)}
      </select>
    </label>
  );

  return <section className="space-y-6" dir="rtl">
    <div className="rounded-2xl bg-gradient-to-l from-[#172C40] to-[#263F55] p-6 text-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold text-[#D9BD83]">أَثَر | الإدارة المدرسية</p>
          <h1 className="mt-1 text-2xl font-black">مركز المتابعة الإدارية</h1>
          <p className="mt-2 text-sm text-white/75">متابعة الزيارات الصفية والتقارير وخطط التحسين — المستخدم: {currentUser.name}</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm">بيانات مباشرة من قاعدة بيانات أَثَر</div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        {label:'الزيارات المعروضة',value:filteredVisits.length,icon:ClipboardList},
        {label:'الزيارات المكتملة والمعتمدة',value:completed,icon:CheckCircle2},
        {label:'الزيارات الكاملة',value:filteredVisits.filter(v=>v.visitType==='full').length,icon:CalendarDays},
        {label:'الزيارات السريعة',value:filteredVisits.filter(v=>v.visitType==='quick').length,icon:Clock3},
        {label:'المعلمون ضمن النتائج',value:new Set(filteredVisits.map(v=>v.teacherId)).size,icon:Users},
        {label:'خطط التحسين المفتوحة',value:openPlans,icon:Filter},
      ].map(item=><div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-500">{item.label}</span><item.icon className="h-5 w-5 text-[#B28D4B]"/></div>
        <div className="mt-2 text-2xl font-black tabular-nums text-[#172C40]">{item.value}</div>
      </div>)}
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Filter className="h-5 w-5 text-[#B28D4B]"/><h2 className="font-black text-[#172C40]">البحث والتصفية المتقدمة</h2></div>
        <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><RotateCcw className="h-4 w-4"/>مسح جميع الفلاتر</button>
      </div>
      <label className="block space-y-1"><span className="text-xs font-bold text-slate-600">بحث شامل</span>
        <div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400"/><input className={fieldClass+' pr-10'} value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم المعلم أو رقمه الوظيفي أو رقم الزيارة أو المقيم..."/></div>
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block space-y-1"><span className="text-xs font-bold text-slate-600">المعلم</span><select className={fieldClass} value={teacherId} onChange={e=>setTeacherId(e.target.value)}><option value="all">الكل</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.fullName} — {t.jobNumber}</option>)}</select></label>
        {selectFilter('المقيم',evaluator,setEvaluator,evaluators)}
        {selectFilter('العام الدراسي',academicYear,setAcademicYear,years)}
        {selectFilter('الفصل الدراسي',term,setTerm,options(visits.map(v=>v.term||'')))}
        <label className="block space-y-1"><span className="text-xs font-bold text-slate-600">نوع الزيارة</span><select className={fieldClass} value={visitType} onChange={e=>setVisitType(e.target.value)}><option value="all">الكل</option><option value="full">زيارة كاملة</option><option value="quick">زيارة سريعة</option></select></label>
        {selectFilter('المادة الدراسية',subject,setSubject,subjects)}
        {selectFilter('الصف',grade,setGrade,grades)}
        {selectFilter('الشعبة',section,setSection,sections)}
        <label className="block space-y-1"><span className="text-xs font-bold text-slate-600">حالة التقرير</span><select className={fieldClass} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">الكل</option><option value="draft">مسودة</option><option value="in_progress">قيد التنفيذ</option><option value="completed">مكتمل</option><option value="approved">معتمد</option><option value="archived">مؤرشف</option></select></label>
        <label className="block space-y-1"><span className="text-xs font-bold text-slate-600">من تاريخ</span><input type="date" className={fieldClass} value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label>
        <label className="block space-y-1"><span className="text-xs font-bold text-slate-600">إلى تاريخ</span><input type="date" className={fieldClass} value={toDate} onChange={e=>setToDate(e.target.value)}/></label>
        <label className="block space-y-1"><span className="text-xs font-bold text-slate-600">المؤشر</span><select className={fieldClass} value={indicatorId} onChange={e=>setIndicatorId(e.target.value)}><option value="all">جميع المؤشرات</option>{indicators.map(([id,label])=><option key={id} value={id}>{id} — {label}</option>)}</select></label>
        <label className="block space-y-1"><span className="text-xs font-bold text-slate-600">نتيجة المؤشر</span><select className={fieldClass} value={indicatorRating} onChange={e=>setIndicatorRating(e.target.value)}><option value="all">جميع النتائج</option><option value="yes">متحقق</option><option value="needs_improvement">يحتاج إلى تحسين</option><option value="no">غير متحقق</option><option value="not_observed">لم يُشاهد</option><option value="outstanding">متميز</option><option value="very_good">جيد جدًا</option><option value="good">جيد</option><option value="acceptable">مقبول</option><option value="weak">ضعيف</option></select></label>
        {selectFilter('نقطة القوة',strengthFilter,setStrengthFilter,strengths)}
        {selectFilter('مجال التحسين',improvementFilter,setImprovementFilter,improvementAreas)}
        <label className="block space-y-1"><span className="text-xs font-bold text-slate-600">حالة المتابعة الإدارية</span><select className={fieldClass} value={followUpStatus} onChange={e=>setFollowUpStatus(e.target.value)}><option value="all">جميع الحالات</option><option value="not_started">لم تبدأ</option><option value="in_progress">قيد التنفيذ</option><option value="completed">مكتملة</option><option value="needs_follow_up">تحتاج متابعة</option></select></label>
      </div>
      <p className="text-xs text-slate-500">تُطبّق جميع الفلاتر معًا على النتائج المعروضة. عدد النتائج: <strong className="text-[#172C40]">{filteredVisits.length}</strong></p>
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4"><h2 className="font-black text-[#172C40]">سجل الزيارات والتقارير</h2><div className="flex items-center gap-2"><button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4"/>تصدير Excel / CSV</button><button type="button" onClick={()=>window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#172C40] px-3 py-2 text-xs font-bold text-white hover:bg-[#263F55]"><Printer className="h-4 w-4"/>طباعة / PDF</button></div></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-right text-sm">
          <thead className="bg-[#F5F2EA] text-xs text-[#172C40]"><tr>{['رقم الزيارة','المعلم','المادة / الصف / الشعبة','العام الدراسي','نوع الزيارة','المقيم','التاريخ','نسبة الإنجاز','الحالة','التقرير'].map(h=><th key={h} className="whitespace-nowrap px-3 py-3 font-black">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filteredVisits.map(v=><tr key={v.id} className="hover:bg-slate-50">
              <td className="px-3 py-3 font-mono text-xs">{v.id}</td><td className="px-3 py-3 font-bold">{v.teacherName}<div className="text-[11px] font-normal text-slate-500">{v.teacherJobNumber}</div></td>
              <td className="px-3 py-3">{v.subject}<div className="text-[11px] text-slate-500">{v.grade} — {v.section}</div></td><td className="px-3 py-3">{v.academicYear}</td>
              <td className="px-3 py-3">{v.visitType==='full'?'كاملة':'سريعة'}</td><td className="px-3 py-3">{v.evaluatorName}</td><td className="px-3 py-3 whitespace-nowrap">{v.date}</td>
              <td className="px-3 py-3 font-bold tabular-nums">{v.achievementPercentage}%</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{statusLabel(v.status)}</span></td>
              <td className="px-3 py-3"><button type="button" onClick={()=>onOpenVisitReport(v)} className="inline-flex items-center gap-1 rounded-lg bg-[#172C40] px-3 py-2 text-xs font-bold text-white hover:bg-[#263F55]"><Eye className="h-3.5 w-3.5"/>فتح</button></td>
            </tr>)}
            {filteredVisits.length===0&&<tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500">لا توجد تقارير مطابقة للفلاتر المحددة.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>

    <AdministrativeFollowUpsPanel currentUser={currentUser} teachers={teachers} visits={visits} followUps={followUps} onRefresh={onRefresh} />

    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-black text-[#172C40]">سجل تعديلات التقارير وأرشفتها</h2><span className="text-xs text-slate-500">{visitHistory.length} عملية محفوظة</span></div>
      {visitHistory.slice(0,100).map(item=><article key={item.id} className="rounded-lg border border-slate-100 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold text-[#172C40]">{item.action} — {item.visitId}</p><p className="text-[11px] text-slate-500">{item.changedBy} · {new Date(item.changedAt).toLocaleString('ar-AE')}</p></div>
        <button type="button" onClick={()=>setExpandedHistory(prev=>prev.includes(item.id)?prev.filter(x=>x!==item.id):[...prev,item.id])} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold">{expandedHistory.includes(item.id)?'إخفاء النسخة السابقة':'عرض النسخة السابقة'}</button></div>
        {expandedHistory.includes(item.id)&&<pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-[10px] leading-5 text-slate-600" dir="ltr">{(()=>{try{return JSON.stringify(JSON.parse(item.snapshotJson),null,2)}catch{return item.snapshotJson}})()}</pre>}
      </article>)}
      {visitHistory.length===0&&<p className="py-6 text-center text-sm text-slate-500">سيظهر هنا سجل النسخ السابقة عند تعديل التقارير أو أرشفتها.</p>}
    </div>
  </section>;
};
