import React, { useMemo, useState } from 'react';
import { AdministrativeFollowUp, ClassroomVisit, Teacher, User } from '../types';
import { atharRemoteAction } from '../services/gasBridgeClient';
import { CalendarCheck, Save, Pencil, RotateCcw } from 'lucide-react';

interface AdministrativeFollowUpsPanelProps {
  currentUser: User;
  teachers: Teacher[];
  visits: ClassroomVisit[];
  followUps: AdministrativeFollowUp[];
  onRefresh: () => void;
}
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#172C40] outline-none focus:border-[#C6A66A]";
const today = () => new Date().toISOString().slice(0,10);

export const AdministrativeFollowUpsPanel: React.FC<AdministrativeFollowUpsPanelProps> = ({currentUser,teachers,visits,followUps,onRefresh}) => {
  const [id,setId]=useState('');
  const [teacherId,setTeacherId]=useState('');
  const [visitId,setVisitId]=useState('');
  const [followUpDate,setFollowUpDate]=useState(today());
  const [action,setAction]=useState('');
  const [notes,setNotes]=useState('');
  const [recommendations,setRecommendations]=useState('');
  const [result,setResult]=useState('');
  const [nextAction,setNextAction]=useState('');
  const [nextDate,setNextDate]=useState('');
  const [status,setStatus]=useState('in_progress');
  const [filterTeacher,setFilterTeacher]=useState('all');
  const [filterStatus,setFilterStatus]=useState('all');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const linkedVisits=visits.filter(v=>!teacherId||v.teacherId===teacherId);
  const rows=useMemo(()=>followUps.filter(x=>(filterTeacher==='all'||x.teacherId===filterTeacher)&&(filterStatus==='all'||x.status===filterStatus)).sort((a,b)=>String(b.followUpDate).localeCompare(String(a.followUpDate))),[followUps,filterTeacher,filterStatus]);
  const reset=()=>{setId('');setTeacherId('');setVisitId('');setFollowUpDate(today());setAction('');setNotes('');setRecommendations('');setResult('');setNextAction('');setNextDate('');setStatus('in_progress');};
  const edit=(x:AdministrativeFollowUp)=>{setId(x.id);setTeacherId(x.teacherId);setVisitId(x.visitId||'');setFollowUpDate(x.followUpDate||today());setAction(x.action||'');setNotes(x.notes||'');setRecommendations(x.recommendations||'');setResult(x.result||'');setNextAction(x.nextAction||'');setNextDate(x.nextDate||'');setStatus(x.status||'in_progress');};
  const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!teacherId||!action.trim()){setMessage('اختر المعلم واكتب الإجراء الذي تم.');return;}setBusy(true);setMessage('');try{await atharRemoteAction('saveAdministrativeFollowUp',{id:id||undefined,teacherId,visitId,followUpDate,action,notes,recommendations,result,nextAction,nextDate,status});setMessage('تم حفظ سجل المتابعة الإدارية.');reset();onRefresh();}catch(err){setMessage(err instanceof Error?err.message:'تعذر حفظ المتابعة.');}finally{setBusy(false);}};
  const label=(s:string)=>({not_started:'لم تبدأ',in_progress:'قيد التنفيذ',completed:'مكتملة',needs_follow_up:'تحتاج متابعة'} as Record<string,string>)[s]||s;
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" dir="rtl">
    <div className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-[#B28D4B]"/><h2 className="font-black text-[#172C40]">التوثيق والمتابعة الإدارية</h2></div>
    <p className="text-xs text-slate-500">سجّل الإجراء والملاحظات والنتيجة والخطوة القادمة نصيًا، دون رفع ملفات أو صور.</p><p className="text-[11px] text-slate-500">المسؤول عن المتابعة الحالية: <strong>{currentUser.name}</strong></p>
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-slate-50 p-4">
      <div className="flex items-center justify-between"><h3 className="text-sm font-black">{id?'تعديل سجل متابعة':'إضافة سجل متابعة جديد'}</h3>{id&&<button type="button" onClick={reset} className="inline-flex items-center gap-1 text-xs text-slate-500"><RotateCcw className="h-3.5 w-3.5"/>إلغاء</button>}</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs font-bold">المعلم *<select required className={field} value={teacherId} onChange={e=>{setTeacherId(e.target.value);setVisitId('');}}><option value="">اختر المعلم</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.fullName}</option>)}</select></label>
        <label className="space-y-1 text-xs font-bold">التقرير المرتبط<select className={field} value={visitId} onChange={e=>setVisitId(e.target.value)}><option value="">متابعة عامة</option>{linkedVisits.map(v=><option key={v.id} value={v.id}>{v.id} — {v.date}</option>)}</select></label>
        <label className="space-y-1 text-xs font-bold">تاريخ المتابعة<input type="date" className={field} value={followUpDate} onChange={e=>setFollowUpDate(e.target.value)} required/></label>
      </div>
      <label className="block space-y-1 text-xs font-bold">الإجراء الذي تم تنفيذه *<textarea className={field+' min-h-20'} value={action} onChange={e=>setAction(e.target.value)} required/></label>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs font-bold">ملاحظات المتابع<textarea className={field+' min-h-20'} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <label className="space-y-1 text-xs font-bold">التوصيات<textarea className={field+' min-h-20'} value={recommendations} onChange={e=>setRecommendations(e.target.value)}/></label>
        <label className="space-y-1 text-xs font-bold">نتيجة المتابعة<textarea className={field+' min-h-20'} value={result} onChange={e=>setResult(e.target.value)}/></label>
        <label className="space-y-1 text-xs font-bold">الإجراء القادم<textarea className={field+' min-h-20'} value={nextAction} onChange={e=>setNextAction(e.target.value)}/></label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-bold">موعد المتابعة القادمة<input type="date" className={field} value={nextDate} onChange={e=>setNextDate(e.target.value)}/></label>
        <label className="space-y-1 text-xs font-bold">حالة المتابعة<select className={field} value={status} onChange={e=>setStatus(e.target.value)}><option value="not_started">لم تبدأ</option><option value="in_progress">قيد التنفيذ</option><option value="completed">مكتملة</option><option value="needs_follow_up">تحتاج متابعة</option></select></label>
      </div>
      <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#172C40] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4"/>{busy?'جارٍ الحفظ...':'حفظ المتابعة'}</button>
      {message&&<p className="text-xs font-bold text-[#668575]">{message}</p>}
    </form>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-xs font-bold">تصفية حسب المعلم<select className={field} value={filterTeacher} onChange={e=>setFilterTeacher(e.target.value)}><option value="all">جميع المعلمين</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.fullName}</option>)}</select></label>
      <label className="space-y-1 text-xs font-bold">تصفية حسب الحالة<select className={field} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="all">جميع الحالات</option><option value="not_started">لم تبدأ</option><option value="in_progress">قيد التنفيذ</option><option value="completed">مكتملة</option><option value="needs_follow_up">تحتاج متابعة</option></select></label>
    </div>
    <div className="space-y-2">{rows.map(x=><article key={x.id} className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-black text-[#172C40]">{x.teacherName}</h3><p className="text-[11px] text-slate-500">{x.followUpDate} · {x.visitId||'متابعة عامة'} · {x.createdBy}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{label(x.status)}</span><button type="button" onClick={()=>edit(x)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold"><Pencil className="h-3.5 w-3.5"/>تعديل</button></div></div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{x.action}</p>{x.result&&<p className="mt-2 text-xs text-slate-600"><strong>النتيجة:</strong> {x.result}</p>}{x.nextAction&&<p className="mt-1 text-xs text-slate-600"><strong>الإجراء القادم:</strong> {x.nextAction} {x.nextDate&&' — '+x.nextDate}</p>}
    </article>)}{rows.length===0&&<p className="py-6 text-center text-sm text-slate-500">لا توجد متابعات مسجلة.</p>}</div>
  </section>;
};
