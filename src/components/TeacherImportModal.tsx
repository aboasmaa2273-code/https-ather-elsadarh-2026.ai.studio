import React, { useState } from 'react';
import { Upload, Download, AlertTriangle, CheckCircle2, FileText, X } from 'lucide-react';
import { atharRemoteAction } from '../services/gasBridgeClient';
import { translations, Language } from '../i18n/translations';

interface TeacherImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  language?: Language;
}

export const TeacherImportModal: React.FC<TeacherImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  language = 'ar'
}) => {
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; rejected: number; errors: string[]; importBatchId?: string } | null>(null);

  if (!isOpen) return null;

  const isEn = language === 'en';

  // Template CSV content
  const sampleCsvContent = isEn 
    ? `Full Name,Job ID,Specialization,Email,Phone
John Smith,10955,Mathematics,j.smith@alsadara.edu.ae,0501112233
David Miller,10960,General Science,d.miller@alsadara.edu.ae,0502223344
Robert Brown,10965,English Language,r.brown@alsadara.edu.ae,0503334455
Michael Taylor,10970,Arabic Language,m.taylor@alsadara.edu.ae,0504445566`
    : `الاسم الكامل,الرقم الوظيفي,التخصص,البريد الإلكتروني,رقم الهاتف
محمد عبد الله المرزوقي,10955,الرياضيات,m.almarzouqi@alsadara.edu.ae,0501112233
سعيد خلفان المنصوري,10960,العلوم العامة,s.almansoori@alsadara.edu.ae,0502223344
حميد هزاع الظاهري,10965,اللغة الإنجليزية,h.aldhaheri@alsadara.edu.ae,0503334455
مروان علي الشامسي,10970,اللغة العربية,m.alshamsi@alsadara.edu.ae,0504445566`;

  const handleDownloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + sampleCsvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', isEn ? 'athar_teachers_import_template.csv' : 'قالب_استيراد_معلمي_مدرسة_الصدارة.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setSelectedFileName(file.name);
      setImportResult(null);
      parseAndValidateCsv(content);
    };
    reader.readAsText(file);
  };

  const parseAndValidateCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
      setParsedRows([]);
      return;
    }

    const rows: any[] = [];
    const seenBatchJobNumbers = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',').map(p => p.trim());
      const fullName = parts[0] || '';
      const jobNumber = parts[1] || '';
      const specialization = parts[2] || '';
      const email = parts[3] || '';
      const phone = parts[4] || '';

      const rowStatus: { valid: boolean; reasons: string[] } = { valid: true, reasons: [] };

      if (!fullName) {
        rowStatus.valid = false;
        rowStatus.reasons.push(isEn ? 'Full name missing' : 'الاسم الكامل مفقود');
      }
      if (!jobNumber) {
        rowStatus.valid = false;
        rowStatus.reasons.push(isEn ? 'Job ID missing' : 'الرقم الوظيفي مفقود');
      } else {
        if (seenBatchJobNumbers.has(jobNumber)) {
          rowStatus.valid = false;
          rowStatus.reasons.push(isEn ? `Duplicate Job ID (${jobNumber}) in file` : `الرقم الوظيفي (${jobNumber}) مكرر داخل هذا الملف`);
        }
        seenBatchJobNumbers.add(jobNumber);
      }

      if (!specialization) {
        rowStatus.valid = false;
        rowStatus.reasons.push(isEn ? 'Specialization missing' : 'التخصص مفقود');
      }

      rows.push({
        lineNum: i + 1,
        fullName,
        jobNumber,
        specialization,
        email,
        phone,
        isValid: rowStatus.valid,
        reasons: rowStatus.reasons
      });

    }

    setParsedRows(rows);
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert(isEn ? 'No valid records found to import!' : 'لا توجد سجلات صالحة للاستيراد!');
      return;
    }
    setIsImporting(true);
    try {
      const result = await atharRemoteAction('importTeachers', {
        teachers: validRows.map(r => ({ lineNum: r.lineNum, fullName: r.fullName, jobNumber: r.jobNumber, specialization: r.specialization, email: r.email, phone: r.phone }))
      }) as { importedCount?: number; rejectedCount?: number; importBatchId?: string; errors?: Array<{lineNum:number;jobNumber:string;reasons:string[]}> };
      const serverErrors = (result.errors || []).map(item => 'السطر ' + item.lineNum + ': ' + item.reasons.join('، '));
      const previewErrors = parsedRows.filter(r => !r.isValid).map(r => 'السطر ' + r.lineNum + ': ' + r.reasons.join('، '));
      setImportResult({ imported: Number(result.importedCount || 0), rejected: Number(result.rejectedCount || 0) + previewErrors.length, errors: [...previewErrors, ...serverErrors], importBatchId: result.importBatchId || undefined });
      if (Number(result.importedCount || 0) > 0) onImportComplete();
    } catch (error) {
      setImportResult({ imported: 0, rejected: validRows.length, errors: [error instanceof Error ? error.message : 'تعذر إتمام الاستيراد المركزي.'] });
    } finally { setIsImporting(false); }
  };

  const handleUndoImportedBatch = async () => {
    if (!importResult?.importBatchId) return;
    if (!confirm(isEn
      ? 'Undo this CSV import? Teachers already linked to classroom visits will be retained to protect historical records.'
      : 'هل تريد التراجع عن استيراد هذا الملف؟ ستُحفظ سجلات المعلمين المرتبطة بزيارات سابقة حمايةً للتاريخ المسجل.')) return;
    setIsImporting(true);
    try {
      const result = await atharRemoteAction('deleteTeacherImportBatch', { importBatchId: importResult.importBatchId }) as { deletedCount?: number; protectedCount?: number; message?: string };
      setImportResult({
        imported: 0,
        rejected: importResult.rejected,
        errors: [...importResult.errors, result.message || 'تم التراجع عن دفعة الاستيراد.'],
        importBatchId: undefined
      });
      onImportComplete();
      alert((isEn ? 'Deleted: ' : 'تم حذف: ') + Number(result.deletedCount || 0) +
        (isEn ? '; retained because of visit history: ' : '؛ أُبقي عليها لارتباطها بزيارات سابقة: ') + Number(result.protectedCount || 0));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر التراجع عن دفعة الاستيراد.');
    } finally {
      setIsImporting(false);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFileName(''); setParsedRows([]); setImportResult(null);
    const input = document.getElementById('csvFileInput') as HTMLInputElement | null;
    if (input) input.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#172C40]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-[#172C40] text-white">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#C6A66A]" />
            <h3 className="font-bold text-base font-['Tajawal']">
              {isEn ? 'Bulk Teacher Data Import (CSV)' : 'الاستيراد الجماعي للمعلمين (CSV)'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-white/80 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#F2EBDD]/40 border border-[#C6A66A]/30">
            <div>
              <p className="font-bold text-[#172C40] text-sm">
                {isEn ? 'Download Standard Import Template' : 'تحميل نموذج الاستيراد الجاهز'}
              </p>
              <p className="text-[#64748B] text-[11px] mt-0.5">
                {isEn ? 'Pre-formatted with required headers and sample data.' : 'يحتوي القالب على الأعمدة المطلوبة بالتنسيق الدقيق المعتمد.'}
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-2 bg-white text-[#172C40] border border-[#C6A66A] rounded-lg font-bold hover:bg-[#F2EBDD] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#C6A66A]" />
              <span>{isEn ? 'Download Template (CSV)' : 'تحميل القالب (CSV)'}</span>
            </button>
          </div>

          {/* Upload input */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-[#172C40] transition-colors bg-slate-50">
            <input
              type="file"
              accept=".csv,.txt"
              id="csvFileInput"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label htmlFor="csvFileInput" className="cursor-pointer block">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="font-bold text-[#172C40] text-sm">
                {isEn ? 'Click to select CSV file or drag and drop here' : 'انقر لاختيار ملف CSV أو اسحبه هنا'}
              </p>
              <p className="text-slate-500 text-[11px] mt-1">
                {isEn ? 'Checks missing fields and duplicates within this file; existing records are checked in the central database during import.' : 'يتم فحص الحقول والأرقام المكررة داخل الملف، ثم التحقق من السجلات الموجودة في قاعدة البيانات المركزية عند الاستيراد.'}
              </p>
            </label>
            {selectedFileName && <div className="mt-3 flex items-center justify-center gap-3 text-[11px]"><span className="font-semibold text-[#172C40]">{selectedFileName}</span><button type="button" onClick={clearSelectedFile} className="text-red-700 underline font-bold">{isEn ? 'Remove selected file / clear preview' : 'إزالة الملف المختار ومسح المعاينة'}</button></div>}
          </div>

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#172C40]">
                  {isEn ? `Records Preview (${parsedRows.length} rows):` : `معاينة السجلات قبل الاستيراد (${parsedRows.length} سجل):`}
                </span>
                <span className="text-[11px] text-slate-500">
                  {parsedRows.filter(r => r.isValid).length} {isEn ? 'valid' : 'صالح للاستيراد'} · {parsedRows.filter(r => !r.isValid).length} {isEn ? 'with errors' : 'به أخطاء'}
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto">
                <table className={`w-full ${isEn ? 'text-left' : 'text-right'} border-collapse text-[11px]`}>
                  <thead className="bg-slate-100 sticky top-0 text-slate-700">
                    <tr>
                      <th className="p-2">{isEn ? 'Line' : 'السطر'}</th>
                      <th className="p-2">{isEn ? 'Full Name' : 'الاسم الكامل'}</th>
                      <th className="p-2">{isEn ? 'Job ID' : 'الرقم الوظيفي'}</th>
                      <th className="p-2">{isEn ? 'Specialization' : 'التخصص'}</th>
                      <th className="p-2">{isEn ? 'Status' : 'الحالة'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className={row.isValid ? 'bg-white' : 'bg-red-50/70'}>
                        <td className="p-2 text-slate-400 font-mono">{row.lineNum}</td>
                        <td className="p-2 font-semibold text-[#172C40]">{row.fullName || '—'}</td>
                        <td className="p-2 font-mono">{row.jobNumber || '—'}</td>
                        <td className="p-2">{row.specialization || '—'}</td>
                        <td className="p-2">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {isEn ? 'Valid' : 'صالح'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-700 font-bold" title={row.reasons.join(', ')}>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {row.reasons[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result Alert */}
          {importResult && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
              <p className="font-bold">{isEn ? 'Import Outcome:' : 'نتيجة الاستيراد:'}</p>
              <p className="mt-1">{isEn ? `Saved centrally: ${importResult.imported}. Rejected: ${importResult.rejected}.` : `تم الحفظ في قاعدة البيانات المركزية: ${importResult.imported} معلماً. السجلات المستبعدة: ${importResult.rejected}.`}</p>
              {importResult.errors.length > 0 && <ul className="mt-2 list-disc pr-5 space-y-1 text-red-700">{importResult.errors.slice(0, 12).map((error, index) => <li key={index}>{error}</li>)}</ul>}
              {importResult.importBatchId && importResult.imported > 0 && (
                <button type="button" disabled={isImporting} onClick={handleUndoImportedBatch}
                  className="mt-3 px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 font-bold hover:bg-rose-100 disabled:opacity-50">
                  {isImporting ? 'جارٍ التراجع...' : (isEn ? 'Undo this imported file' : 'حذف الملف المستورد والتراجع عن إضافته')}
                </button>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 cursor-pointer"
          >
            {isEn ? 'Close' : 'إغلاق'}
          </button>

          {parsedRows.filter(r => r.isValid).length > 0 && !importResult && (
            <button
              onClick={handleExecuteImport}
              disabled={isImporting}
              className="px-6 py-2 bg-[#172C40] text-white rounded-lg text-xs font-bold hover:bg-[#101F2D] disabled:opacity-60 flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4 text-[#C6A66A]" />
              <span>{isImporting ? (isEn ? 'Importing...' : 'جارٍ الحفظ المركزي...') : (isEn ? `Confirm Import (${parsedRows.filter(r => r.isValid).length}) Records` : `تأكيد الاستيراد المركزي (${parsedRows.filter(r => r.isValid).length}) سجل صالح`)}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
