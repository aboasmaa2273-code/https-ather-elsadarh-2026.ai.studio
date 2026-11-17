import React, { useMemo, useState } from 'react';
import { AuditLogEntry, ClassroomVisit, ImprovementPlan, Teacher, User } from '../types';
import { translations, Language } from '../i18n/translations';
import { FileDown, Search, Filter, BarChart3, Users, ClipboardList, Archive, Activity, GraduationCap, Target, RefreshCw } from 'lucide-react';

type Section = 'overview' | 'evaluators' | 'visits' | 'teachers' | 'plans' | 'analytics' | 'archive' | 'activity';

interface MonitoringDashboardProps {
  currentUser: User;
  visits: ClassroomVisit[];
  teachers: Teacher[];
  plans: ImprovementPlan[];
  auditLogs: AuditLogEntry[];
  onOpenVisitReport: (visit: ClassroomVisit) => void;
  language?: Language;
}

const sections: { id: Section; ar: string; en: string; icon: React.ElementType }[] = [
  { id: 'overview', ar: 'الملخص العام', en: 'Overview', icon: BarChart3 },
  { id: 'evaluators', ar: 'أداء المقيمين', en: 'Evaluator Performance', icon: Users },
  { id: 'visits', ar: 'سجل الزيارات', en: 'Visit Register', icon: ClipboardList },
  { id: 'teachers', ar: 'ملفات المعلمين وتطورهم', en: 'Teacher Profiles & Progress', icon: GraduationCap },
  { id: 'plans', ar: 'خطط التحسين', en: 'Improvement Plans', icon: Target },
  { id: 'analytics', ar: 'التحليلات', en: 'Analytics', icon: BarChart3 },
  { id: 'archive', ar: 'الأرشيف', en: 'Archive', icon: Archive },
  { id: 'activity', ar: 'سجل النشاط والتدقيق', en: 'Activity & Audit Log', icon: Activity }
];

const asDate = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};
const fmtDate = (value?: string, isEn = false) => {
  const d = asDate(value);
  return d ? d.toLocaleDateString(isEn ? 'en' : 'ar', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
};
const percent = (n: number, total: number) => total ? Math.round((n / total) * 100) : 0;
const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  currentUser, visits, teachers, plans, auditLogs, onOpenVisitReport, language = 'ar'
}) => {
  const isEn = language === 'en';
  const [section, setSection] = useState<Section>('overview');
  const [evaluator, setEvaluator] = useState('all');
  const [teacher, setTeacher] = useState('all');
  const [visitType, setVisitType] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [year, setYear] = useState('all');
  const [term, setTerm] = useState('all');
  const [subject, setSubject] = useState('all');
  const [grade, setGrade] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [performance, setPerformance] = useState('all');
  const [visitStatus, setVisitStatus] = useState('all');
  const [search, setSearch] = useState('');

  const activeVisits = useMemo(() => visits.filter(v => v.status !== 'archived'), [visits]);
  const archivedVisits = useMemo(() => visits.filter(v => v.status === 'archived'), [visits]);
  const options = (key: keyof ClassroomVisit) => Array.from(new Set(activeVisits.map(v => String(v[key] || '')).filter(Boolean))).sort((a,b) => a.localeCompare(b, 'ar'));
  const filtered = useMemo(() => activeVisits.filter(v => {
    const d = asDate(v.date);
    return (evaluator === 'all' || v.evaluatorId === evaluator || v.evaluatorName === evaluator)
      && (teacher === 'all' || v.teacherId === teacher || v.teacherName === teacher)
      && (visitType === 'all' || v.visitType === visitType)
      && (!fromDate || (d && d >= new Date(fromDate + 'T00:00:00')))
      && (!toDate || (d && d <= new Date(toDate + 'T23:59:59')))
      && (year === 'all' || v.academicYear === year)
      && (term === 'all' || v.term === term)
      && (subject === 'all' || v.subject === subject)
      && (grade === 'all' || v.grade === grade)
      && (sectionFilter === 'all' || v.section === sectionFilter)
      && (performance === 'all' || (performance === 'excellent' ? v.achievementPercentage >= 95 : performance === 'very_good' ? v.achievementPercentage >= 85 && v.achievementPercentage < 95 : performance === 'good' ? v.achievementPercentage >= 75 && v.achievementPercentage < 85 : performance === 'acceptable' ? v.achievementPercentage >= 65 && v.achievementPercentage < 75 : v.achievementPercentage < 65))
      && (visitStatus === 'all' || v.status === visitStatus)
      && (!search || [v.id, v.teacherName, v.evaluatorName, v.subject].some(x => String(x || '').toLowerCase().includes(search.toLowerCase())));
  }), [activeVisits, evaluator, teacher, visitType, fromDate, toDate, year, term, subject, grade, sectionFilter, performance, visitStatus, search]);

  const evaluators = useMemo(() => {
    const map = new Map<string, { id: string; name: string; full: number; quick: number; avg: number; count: number }>();
    activeVisits.forEach(v => {
      const id = v.evaluatorId || v.evaluatorName || 'unknown';
      const current = map.get(id) || { id, name: v.evaluatorName || id, full: 0, quick: 0, avg: 0, count: 0 };
      if (v.visitType === 'full') current.full++;
      if (v.visitType === 'quick') current.quick++;
      current.avg += Number(v.achievementPercentage || 0);
      current.count++;
      map.set(id, current);
    });
    return Array.from(map.values()).map(x => ({ ...x, avg: x.count ? Math.round(x.avg / x.count) : 0 })).sort((a,b) => b.count-a.count);
  }, [activeVisits]);

  const indicatorStats = useMemo(() => {
    const map = new Map<number, { id: number; text: string; yes: number; needs: number; no: number; unseen: number }>();
    filtered.forEach(v => (v.indicators || []).forEach(i => {
      const current = map.get(i.indicatorId) || { id: i.indicatorId, text: i.indicatorText || String(i.indicatorId), yes: 0, needs: 0, no: 0, unseen: 0 };
      if (i.rating === 'yes') current.yes++;
      else if (i.rating === 'needs_improvement') current.needs++;
      else if (i.rating === 'no') current.no++;
      else if (i.rating === 'not_observed') current.unseen++;
      map.set(i.indicatorId, current);
    }));
    return Array.from(map.values()).map(x => ({ ...x, observed: x.yes + x.needs + x.no, rate: percent(x.yes, x.yes + x.needs + x.no) })).sort((a,b) => b.rate-a.rate);
  }, [filtered]);

  const total = filtered.length;
  const full = filtered.filter(v => v.visitType === 'full').length;
  const quick = filtered.filter(v => v.visitType === 'quick').length;
  const completed = filtered.filter(v => ['completed','approved'].includes(v.status)).length;
  const avgAchievement = total ? Math.round(filtered.reduce((n,v) => n + Number(v.achievementPercentage || 0), 0) / total) : 0;
  const visitedTeacherCount = new Set(filtered.map(v => v.teacherId).filter(Boolean)).size;
  const openPlans = plans.filter(p => ['not_started','in_progress','needs_follow_up'].includes(p.status));
  const months = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(v => { const d = asDate(v.date); if (d) { const k = d.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit' }); map.set(k, (map.get(k) || 0) + 1); } });
    return Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0])).slice(-12);
  }, [filtered]);
  const maxMonth = Math.max(1, ...months.map(x => x[1]));

  const resetFilters = () => {
    setEvaluator('all'); setTeacher('all'); setVisitType('all'); setFromDate(''); setToDate('');
    setYear('all'); setTerm('all'); setSubject('all'); setGrade('all'); setSectionFilter('all'); setPerformance('all'); setVisitStatus('all'); setSearch('');
  };

  const exportCsv = () => {
    const rows = [
      ['رقم الزيارة','التاريخ','المقيم','المعلم','نوع الزيارة','المادة','الصف','الشعبة','نسبة الإنجاز','الحالة'],
      ...filtered.map(v => [v.id, v.date, v.evaluatorName, v.teacherName, v.visitType === 'full' ? 'رسمية كاملة' : 'سريعة', v.subject, v.grade, v.section, v.achievementPercentage, v.status])
    ];
    const csv = '\uFEFF' + rows.map(row => row.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'athar-monitoring-visits.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const label = (ar: string, en: string) => isEn ? en : ar;
  const statusLabel = (status: string) => ({ draft: label('مسودة','Draft'), in_progress: label('قيد التنفيذ','In progress'), completed: label('مكتملة','Completed'), approved: label('معتمدة','Approved'), archived: label('مؤرشفة','Archived'), not_started: label('لم تبدأ','Not started'), needs_follow_up: label('تحتاج متابعة','Needs follow-up') }[status] || status);
  const card = (title: string, value: string | number, sub?: string) => <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-bold text-slate-500">{title}</div><div className="mt-2 text-2xl font-black text-[#172C40] tabular-nums">{value}</div>{sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}</div>;
  const filterSelect = (value: string, setter: (v: string) => void, values: string[], title: string) => <label className="flex min-w-[130px] flex-1 flex-col gap-1 text-[11px] font-bold text-slate-600"><span>{title}</span><select value={value} onChange={e => setter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"><option value="all">{label('الكل','All')}</option>{values.map(v => <option key={v} value={v}>{v === 'full' ? label('كاملة','Full') : v === 'quick' ? label('سريعة','Quick') : v === 'draft' ? label('مسودة','Draft') : v === 'in_progress' ? label('قيد التنفيذ','In progress') : v === 'completed' ? label('مكتملة','Completed') : v === 'approved' ? label('معتمدة','Approved') : v === 'excellent' ? label('متميز','Excellent') : v === 'very_good' ? label('جيد جدًا','Very good') : v === 'good' ? label('جيد','Good') : v === 'acceptable' ? label('مقبول','Acceptable') : v === 'weak' ? label('ضعيف','Weak') : v}</option>)}</select></label>;

  return <div className="space-y-5" dir={isEn ? 'ltr' : 'rtl'}>
    <div className="rounded-2xl bg-[#172C40] p-5 text-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-xs font-bold text-[#C6A66A]">{label('منظومة أَثَر | الإدارة والمتابعة','ATHAR | Management & Monitoring')}</div><h1 className="mt-1 text-2xl font-black">{label('لوحة المتابعة والتحليل الشامل','Comprehensive Monitoring Dashboard')}</h1><p className="mt-1 text-xs text-white/70">{label('متابعة أداء المقيمين والزيارات والمعلمين وخطط التطوير من قاعدة البيانات المركزية.','Monitor evaluators, visits, teachers and development plans from the central database.')}</p></div>
        <button onClick={exportCsv} className="flex items-center gap-2 rounded-lg bg-[#C6A66A] px-4 py-2 text-xs font-extrabold text-[#172C40]"><FileDown size={16}/>{label('تصدير نتائج التصفية CSV','Export filtered CSV')}</button>
      </div>
    </div>

    <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2">
      {sections.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => setSection(item.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${section === item.id ? 'bg-[#172C40] text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon size={15}/>{label(item.ar,item.en)}</button>; })}
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2 font-bold text-[#172C40]"><Filter size={16}/>{label('فلاتر البحث والتحليل','Search & analysis filters')}</div><button onClick={resetFilters} className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-[#172C40]"><RefreshCw size={13}/>{label('إعادة ضبط','Reset')}</button></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <label className="col-span-2 flex flex-col gap-1 text-[11px] font-bold text-slate-600"><span>{label('بحث برقم الزيارة أو الاسم','Search visit / name')}</span><div className="flex items-center gap-2 rounded-lg border border-slate-300 px-2"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} className="w-full py-2 text-xs outline-none" placeholder={label('اكتب رقم الزيارة أو اسم المعلم...','Visit ID or teacher name...')}/></div></label>
        {filterSelect(evaluator,setEvaluator,Array.from(new Set(activeVisits.map(v=>v.evaluatorName).filter(Boolean))),label('المقيم','Evaluator'))}
        {filterSelect(teacher,setTeacher,Array.from(new Set(activeVisits.map(v=>v.teacherName).filter(Boolean))),label('المعلم','Teacher'))}
        {filterSelect(visitType,setVisitType,['full','quick'].map(v=>v),label('نوع الزيارة','Visit type'))}
        {filterSelect(year,setYear,options('academicYear'),label('العام الدراسي','Academic year'))}
        {filterSelect(term,setTerm,options('term'),label('الفصل الدراسي','Term'))}
        {filterSelect(subject,setSubject,options('subject'),label('المادة','Subject'))}
        {filterSelect(grade,setGrade,options('grade'),label('الصف','Grade'))}
        {filterSelect(sectionFilter,setSectionFilter,options('section'),label('الشعبة','Section'))}
        {filterSelect(performance,setPerformance,['excellent','very_good','good','acceptable','weak'],label('مستوى التقدير','Performance level'))}
        {filterSelect(visitStatus,setVisitStatus,['draft','in_progress','completed','approved'],label('حالة الزيارة','Status'))}
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600"><span>{label('من تاريخ','From')}</span><input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs"/></label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600"><span>{label('إلى تاريخ','To')}</span><input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs"/></label>
      </div>
    </div>

    {section === 'overview' && <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {card(label('إجمالي الزيارات','Total visits'),total)}
        {card(label('الزيارات المكتملة','Completed visits'),completed)}
        {card(label('الزيارات الرسمية الكاملة','Full visits'),full)}
        {card(label('الزيارات السريعة','Quick visits'),quick)}
        {card(label('المعلمون الذين تمت زيارتهم','Teachers visited'),visitedTeacherCount)}
        {card(label('خطط التحسين المفتوحة','Open plans'),openPlans.length)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 font-black text-[#172C40]">{label('مؤشر الإنجاز العام','Overall achievement')}</h3><div className="text-4xl font-black text-[#668575]">{avgAchievement}%</div><div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#668575]" style={{width:avgAchievement+'%'}}/></div><p className="mt-2 text-xs text-slate-500">{label('متوسط نسب إنجاز الزيارات الظاهرة بعد تطبيق الفلاتر.','Average achievement across filtered visits.')}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 font-black text-[#172C40]">{label('حجم الزيارات شهريًا','Monthly visit volume')}</h3>{months.length ? months.map(([m,n])=><div key={m} className="mb-2 grid grid-cols-[85px_1fr_30px] items-center gap-2 text-xs"><span dir="ltr">{m}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#C6A66A]" style={{width:percent(n,maxMonth)+'%'}}/></div><b>{n}</b></div>) : <p className="text-xs text-slate-500">{label('لا توجد زيارات ضمن الفلاتر الحالية.','No visits match the current filters.')}</p>}</div>
      </div>
    </div>}

    {section === 'evaluators' && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[650px] text-right text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{['المقيم','كاملة','سريعة','الإجمالي','متوسط الإنجاز'].map(x=><th key={x} className="p-3">{label(x,({المقيم:'Evaluator',كاملة:'Full',سريعة:'Quick',الإجمالي:'Total','متوسط الإنجاز':'Avg achievement'} as Record<string,string>)[x])}</th>)}</tr></thead><tbody>{evaluators.map(e=><tr key={e.id} className="border-t border-slate-100"><td className="p-3 font-bold">{e.name}</td><td className="p-3">{e.full}</td><td className="p-3">{e.quick}</td><td className="p-3 font-black">{e.count}</td><td className="p-3">{e.avg}%</td></tr>)}{!evaluators.length&&<tr><td colSpan={5} className="p-6 text-center text-slate-500">{label('لا توجد بيانات زيارات للمقيمين بعد.','No evaluator visit data yet.')}</td></tr>}</tbody></table></div>}

    {section === 'visits' && <VisitTable visits={filtered} onOpen={onOpenVisitReport} label={label} statusLabel={statusLabel} isEn={isEn}/>}

    {section === 'teachers' && <div className="space-y-3">{teachers.filter(t=>teacher==='all'||t.id===teacher||t.fullName===teacher).map(t=>{const tv=filtered.filter(v=>v.teacherId===t.id||v.teacherName===t.fullName).sort((a,b)=>String(a.date).localeCompare(String(b.date)));const last=tv[tv.length-1];const first=tv[0];const delta=first&&last?Math.round((last.achievementPercentage||0)-(first.achievementPercentage||0)):0;return <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black text-[#172C40]">{t.fullName}</h3><p className="text-[11px] text-slate-500">{t.specialization} · {t.jobNumber}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{tv.length} {label('زيارة','visits')}</span></div><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4"><div><div className="text-[11px] text-slate-500">{label('أول تقييم','First score')}</div><b>{first?first.achievementPercentage+'%':'—'}</b></div><div><div className="text-[11px] text-slate-500">{label('آخر تقييم','Latest score')}</div><b>{last?last.achievementPercentage+'%':'—'}</b></div><div><div className="text-[11px] text-slate-500">{label('التغير التاريخي','Historical change')}</div><b className={delta>=0?'text-emerald-700':'text-rose-700'}>{tv.length>1?(delta>0?'+':'')+delta+'%':'—'}</b></div><div><div className="text-[11px] text-slate-500">{label('آخر زيارة','Last visit')}</div><b>{fmtDate(last?.date,isEn)}</b></div></div>{tv.length>0&&<div className="mt-3 flex flex-wrap gap-2">{tv.map(v=><button key={v.id} onClick={()=>onOpenVisitReport(v)} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50">{fmtDate(v.date,isEn)} · {v.achievementPercentage}%</button>)}</div>}</div>})}</div>}

    {section === 'plans' && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[700px] text-right text-xs"><thead className="bg-slate-50"><tr>{['المعلم','مجال التحسين','الهدف التطويري','المسؤول','موعد المتابعة','الحالة'].map(x=><th key={x} className="p-3">{label(x,({المعلم:'Teacher','مجال التحسين':'Improvement area','الهدف التطويري':'Development goal','المسؤول':'Responsible','موعد المتابعة':'Follow-up date','الحالة':'Status'} as Record<string,string>)[x])}</th>)}</tr></thead><tbody>{plans.filter(p=>teacher==='all'||p.teacherId===teacher||p.teacherName===teacher).map(p=><tr key={p.id} className="border-t border-slate-100"><td className="p-3 font-bold">{p.teacherName}</td><td className="p-3">{p.improvementArea}</td><td className="p-3">{p.developmentalGoal}</td><td className="p-3">{p.responsiblePerson}</td><td className="p-3">{fmtDate(p.followUpDate,isEn)}</td><td className="p-3">{statusLabel(p.status)}</td></tr>)}{!plans.length&&<tr><td colSpan={6} className="p-6 text-center text-slate-500">{label('لا توجد خطط تحسين مسجلة.','No improvement plans recorded.')}</td></tr>}</tbody></table></div>}

    {section === 'analytics' && <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 font-black">{label('المؤشرات الأكثر تحققًا','Most achieved indicators')}</h3>{indicatorStats.filter(x=>x.observed>0).slice(0,8).map(x=><div key={x.id} className="mb-3"><div className="flex justify-between gap-2 text-xs"><span>{x.text}</span><b>{x.rate}%</b></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#668575]" style={{width:x.rate+'%'}}/></div></div>)}</div><div className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 font-black">{label('المؤشرات الأكثر احتياجًا للتحسين','Indicators needing improvement most')}</h3>{[...indicatorStats].filter(x=>x.observed>0).sort((a,b)=>(b.needs+b.no)-(a.needs+a.no)).slice(0,8).map(x=><div key={x.id} className="mb-3"><div className="flex justify-between gap-2 text-xs"><span>{x.text}</span><b>{x.needs+x.no} {label('حالة','cases')}</b></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#C6A66A]" style={{width:percent(x.needs+x.no,x.observed)+'%'}}/></div><div className="mt-1 text-[10px] text-slate-500">{label('متحقق','Achieved')}: {x.yes} · {label('تحسين','Needs improvement')}: {x.needs} · {label('غير متحقق','Not achieved')}: {x.no} · {label('لم يشاهد','Not observed')}: {x.unseen}</div></div>)}</div></div>}

    {section === 'archive' && <VisitTable visits={archivedVisits.filter(v=>(!search||String(v.id).toLowerCase().includes(search.toLowerCase()))&&(teacher==='all'||v.teacherId===teacher||v.teacherName===teacher)&&(evaluator==='all'||v.evaluatorId===evaluator||v.evaluatorName===evaluator))} onOpen={onOpenVisitReport} label={label} statusLabel={statusLabel} isEn={isEn}/>}

    {section === 'activity' && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[650px] text-right text-xs"><thead className="bg-slate-50"><tr>{['التاريخ','المستخدم','الدور','العملية','التفاصيل'].map(x=><th key={x} className="p-3">{label(x,({التاريخ:'Date',المستخدم:'User',الدور:'Role',العملية:'Action',التفاصيل:'Details'} as Record<string,string>)[x])}</th>)}</tr></thead><tbody>{auditLogs.slice().sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp))).map(x=><tr key={x.id} className="border-t border-slate-100"><td className="p-3 whitespace-nowrap">{fmtDate(x.timestamp,isEn)}</td><td className="p-3 font-bold">{x.userName}</td><td className="p-3">{x.userRole}</td><td className="p-3">{x.action}</td><td className="p-3">{x.details}</td></tr>)}{!auditLogs.length&&<tr><td colSpan={5} className="p-6 text-center text-slate-500">{label('لا توجد سجلات نشاط متاحة.','No activity records available.')}</td></tr>}</tbody></table></div>}
    <div className="text-[10px] text-slate-400">{label('المستخدم الحالي: ','Current user: ')}{currentUser.name} · {label('عدد السجلات المطابقة: ','Matching records: ')}{filtered.length}</div>
  </div>;
};

function VisitTable({ visits, onOpen, label, statusLabel, isEn }: { visits: ClassroomVisit[]; onOpen: (v: ClassroomVisit) => void; label: (ar: string, en: string) => string; statusLabel: (s: string) => string; isEn: boolean }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[850px] text-right text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{['رقم الزيارة','التاريخ','المقيم','المعلم','النوع','المادة / الصف','نسبة الإنجاز','الحالة','التقرير'].map(x=><th key={x} className="p-3">{label(x,({ 'رقم الزيارة':'Visit ID','التاريخ':'Date','المقيم':'Evaluator','المعلم':'Teacher','النوع':'Type','المادة / الصف':'Subject / Grade','نسبة الإنجاز':'Achievement','الحالة':'Status','التقرير':'Report'} as Record<string,string>)[x])}</th>)}</tr></thead><tbody>{visits.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(v=><tr key={v.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="p-3 font-mono">{v.id}</td><td className="p-3 whitespace-nowrap">{fmtDate(v.date,isEn)}</td><td className="p-3">{v.evaluatorName}</td><td className="p-3 font-bold">{v.teacherName}</td><td className="p-3">{v.visitType==='full'?label('كاملة','Full'):label('سريعة','Quick')}</td><td className="p-3">{v.subject} · {v.grade}</td><td className="p-3 font-bold">{v.achievementPercentage}%</td><td className="p-3">{statusLabel(v.status)}</td><td className="p-3"><button onClick={()=>onOpen(v)} className="rounded-md bg-[#172C40] px-3 py-1.5 font-bold text-white">{label('فتح التقرير','Open report')}</button></td></tr>)}{!visits.length&&<tr><td colSpan={9} className="p-6 text-center text-slate-500">{label('لا توجد سجلات مطابقة للفلاتر.','No records match the filters.')}</td></tr>}</tbody></table></div>;
}
