import React, { useMemo, useState } from 'react';
import { InternalNote, InternalNoteHistory, Teacher, ClassroomVisit, User } from '../types';
import { atharRemoteAction } from '../services/gasBridgeClient';
import { MessageSquareLock, Save, Pencil, History, RotateCcw } from 'lucide-react';

interface InternalNotesViewProps {
  currentUser: User;
  teachers: Teacher[];
  visits: ClassroomVisit[];
  notes: InternalNote[];
  history: InternalNoteHistory[];
  onRefresh: () => void;
}

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#172C40] outline-none focus:border-[#C6A66A] focus:ring-2 focus:ring-[#C6A66A]/20";
const managementRoles = ['platform_admin','school_admin','vice_principal'];

export const InternalNotesView: React.FC<InternalNotesViewProps> = ({currentUser,teachers,visits,notes,history,onRefresh}) => {
  const [teacherId,setTeacherId] = useState('');
  const [visitId,setVisitId] = useState('');
  const [noteText,setNoteText] = useState('');
  const [editingId,setEditingId] = useState('');
  const [filterTeacher,setFilterTeacher] = useState('all');
  const [filterWriter,setFilterWriter] = useState('all');
  const [expanded,setExpanded] = useState<string[]>([]);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');

  const relatedVisits = visits.filter(v => !teacherId || v.teacherId === teacherId);
  const visibleNotes = useMemo(()=>notes.filter(n=>
    (filterTeacher==='all'||n.teacherId===filterTeacher) &&
    (filterWriter==='all'||n.createdBy===filterWriter)
  ).sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt))),[notes,filterTeacher,filterWriter]);
  const writers = Array.from(new Set(notes.map(n=>n.createdBy).filter(Boolean)));
  const canEditAll = managementRoles.includes(currentUser.role);

  const resetForm = () => {setTeacherId('');setVisitId('');setNoteText('');setEditingId('');};
  const submit = async (e:React.FormEvent) => {
    e.preventDefault();
    if(!teacherId || !noteText.trim()){setMessage('اختر المعلم واكتب نص الملاحظة.');return;}
    setBusy(true);setMessage('');
    try{
      await atharRemoteAction('saveInternalNote',{id:editingId||undefined,teacherId,visitId,noteText:noteText.trim()});
      setMessage(editingId?'تم تحديث الملاحظة وحفظ سجل التعديل.':'تمت إضافة الملاحظة الإدارية الداخلية.');
      resetForm();onRefresh();
    }catch(err){setMessage(err instanceof Error?err.message:'تعذر حفظ الملاحظة.');}
    finally{setBusy(false);}
  };
  const startEdit = (note:InternalNote) => {setEditingId(note.id);setTeacherId(note.teacherId);setVisitId(note.visitId||'');setNoteText(note.noteText);window.scrollTo({top:0,behavior:'smooth'});};
  const toggleHistory = (id:string) => setExpanded(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const fmt = (value:string) => value ? new Date(value).toLocaleString('ar-AE',{dateStyle:'medium',timeStyle:'short'}) : '—';

  return <section className="space-y-6" dir="rtl">
    <div className="rounded-2xl bg-gradient-to-l from-[#172C40] to-[#263F55] p-6 text-white shadow-lg">
      <div className="flex items-center gap-3"><MessageSquareLock className="h-7 w-7 text-[#D9BD83]"/><div>
        <p className="text-xs font-bold text-[#D9BD83]">أَثَر | مساحة إدارية داخلية</p><h1 className="text-2xl font-black">الملاحظات الإدارية الداخلية</h1>
        <p className="mt-1 text-sm text-white/75">سجل داخلي خاص بالإدارة ورئيس هيئة تدريس المواد العربية والمقيمين المعتمدين. لا يظهر للمعلم.</p>
      </div></div>
    </div>

    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-black text-[#172C40]">{editingId?'تعديل ملاحظة داخلية':'إضافة ملاحظة داخلية'}</h2>{editingId&&<button type="button" onClick={resetForm} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><RotateCcw className="h-3.5 w-3.5"/>إلغاء التعديل</button>}</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1"><span className="text-xs font-bold text-slate-600">المعلم *</span><select className={inputClass} value={teacherId} onChange={e=>{setTeacherId(e.target.value);setVisitId('');}} required><option value="">اختر المعلم</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.fullName} — {t.jobNumber}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-bold text-slate-600">التقرير المرتبط (اختياري)</span><select className={inputClass} value={visitId} onChange={e=>setVisitId(e.target.value)}><option value="">ملاحظة عامة على ملف المعلم</option>{relatedVisits.map(v=><option key={v.id} value={v.id}>{v.id} — {v.date} — {v.visitType==='full'?'زيارة كاملة':'زيارة سريعة'}</option>)}</select></label>
      </div>
      <label className="block space-y-1"><span className="text-xs font-bold text-slate-600">نص الملاحظة *</span><textarea className={inputClass+' min-h-28'} value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="اكتب الملاحظة الإدارية الداخلية..." required/></label>
      <div className="flex flex-wrap items-center gap-3"><button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#172C40] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4"/>{busy?'جارٍ الحفظ...':editingId?'حفظ التعديلات':'حفظ الملاحظة'}</button><span className="text-xs text-slate-500">كاتب الملاحظة: {currentUser.name}</span></div>
      {message&&<p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-[#172C40]">{message}</p>}
    </form>

    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-black text-[#172C40]">سجل الملاحظات</h2><span className="text-xs text-slate-500">{visibleNotes.length} ملاحظة</span></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="text-xs font-bold text-slate-600">تصفية حسب المعلم</span><select className={inputClass} value={filterTeacher} onChange={e=>setFilterTeacher(e.target.value)}><option value="all">جميع المعلمين</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.fullName}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-bold text-slate-600">تصفية حسب كاتب الملاحظة</span><select className={inputClass} value={filterWriter} onChange={e=>setFilterWriter(e.target.value)}><option value="all">جميع الكتّاب</option>{writers.map(w=><option key={w} value={w}>{w}</option>)}</select></label>
      </div>
      <div className="space-y-3">
        {visibleNotes.map(note=>{
          const noteHistory=history.filter(h=>h.noteId===note.id);
          const canEdit=canEditAll||note.createdBy===currentUser.name;
          return <article key={note.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-black text-[#172C40]">{note.teacherName}</h3><p className="mt-1 text-[11px] text-slate-500">{note.visitId?('التقرير: '+note.visitId):'ملاحظة عامة على ملف المعلم'} · أضيفت بواسطة {note.createdBy} · {fmt(note.createdAt)}</p></div>
              <div className="flex gap-2">{canEdit&&<button type="button" onClick={()=>startEdit(note)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold"><Pencil className="h-3.5 w-3.5"/>تعديل</button>}<button type="button" onClick={()=>toggleHistory(note.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold"><History className="h-3.5 w-3.5"/>سجل التعديلات ({noteHistory.length})</button></div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{note.noteText}</p>
            <p className="mt-2 text-[11px] text-slate-400">آخر تحديث: {note.updatedBy||note.createdBy} · {fmt(note.updatedAt||note.createdAt)}</p>
            {expanded.includes(note.id)&&<div className="mt-3 space-y-2 border-t border-slate-100 pt-3"><h4 className="text-xs font-black text-slate-600">النسخ السابقة</h4>{noteHistory.length?noteHistory.map(h=><div key={h.id} className="rounded-lg bg-slate-50 p-3 text-xs"><p className="font-bold text-slate-600">{h.changedBy} · {fmt(h.changedAt)}</p><p className="mt-2 text-slate-500">النص السابق:</p><p className="whitespace-pre-wrap">{h.oldText}</p></div>):<p className="text-xs text-slate-500">لا توجد تعديلات سابقة.</p>}</div>}
          </article>;
        })}
        {visibleNotes.length===0&&<p className="py-10 text-center text-sm text-slate-500">لا توجد ملاحظات مسجلة وفق التصفية الحالية.</p>}
      </div>
    </div>
  </section>;
};
