import React, { useState } from 'react';
import { atharGasBridge } from '../services/gasBridgeClient';
import { Database, CheckCircle2, AlertCircle } from 'lucide-react';

const STORAGE_KEY = 'athar_gas_web_app_url_v1';

interface Props {
  language?: 'ar' | 'en';
}

export const PublicConnectionSetup: React.FC<Props> = ({ language = 'ar' }) => {
  const [url, setUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const isAr = language === 'ar';

  const saveAndTest = async () => {
    setMessage('');
    setSuccess(false);
    setBusy(true);
    try {
      const normalized = url.trim();
      atharGasBridge.configure(normalized);
      localStorage.setItem(STORAGE_KEY, normalized);
      const result = await atharGasBridge.request({ action: 'health' });
      if (!result.success) throw new Error(result.error || (isAr ? 'تعذر الاتصال بالخادم.' : 'Server connection failed.'));
      setSuccess(true);
      setMessage(isAr ? 'تم الاتصال بقاعدة بيانات أَثَر بنجاح. يمكنك تسجيل الدخول الآن.' : 'Connected to the ATHAR database. You can now sign in.');
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : (isAr ? 'تعذر اختبار الاتصال.' : 'Connection test failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-6 rounded-xl border border-[#C6A66A]/50 bg-white p-4 shadow-sm" aria-label={isAr ? 'إعداد اتصال قاعدة البيانات' : 'Database connection setup'}>
      <div className="mb-3 flex items-center gap-2 text-[#172C40]">
        <Database className="h-5 w-5 text-[#C6A66A]" />
        <h2 className="text-sm font-black">{isAr ? 'إعداد اتصال قاعدة بيانات أَثَر' : 'ATHAR database connection setup'}</h2>
      </div>
      <p className="mb-3 text-xs leading-6 text-slate-600">
        {isAr ? 'أدخل رابط تطبيق Google Apps Script المنشور والمنتهي بـ /exec. يُحفظ الرابط في هذا المتصفح لاستخدامه عند تسجيل الدخول.' : 'Enter your deployed Google Apps Script Web App URL ending in /exec. It will be saved in this browser for sign-in.'}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void saveAndTest(); }}
          placeholder="https://script.google.com/macros/s/.../exec"
          dir="ltr"
          autoComplete="url"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#C6A66A] focus:ring-2 focus:ring-[#C6A66A]/20"
        />
        <button
          type="button"
          onClick={() => void saveAndTest()}
          disabled={busy || !url.trim()}
          className="rounded-lg bg-[#172C40] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#243f58] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (isAr ? 'جارٍ الاختبار...' : 'Testing...') : (isAr ? 'حفظ الرابط واختبار الاتصال' : 'Save URL & Test')}
        </button>
      </div>
      {message && (
        <div role="status" className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{message}</span>
        </div>
      )}
    </section>
  );
};
