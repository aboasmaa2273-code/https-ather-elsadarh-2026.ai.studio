import React, { useState } from 'react';
import { User } from '../types';
import { AtharStorageService } from '../services/storageService';
import { 
  Shield, 
  Lock, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  X, 
  CheckCircle, 
  AlertCircle, 
  UserPlus, 
  Sparkles,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { translations, Language } from '../i18n/translations';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  language?: Language;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  language = 'ar'
}) => {
  const isEn = language === 'en';
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // Login fields
  const [username, setUsername] = useState<string>('arabic');
  const [password, setPassword] = useState<string>('123');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Register fields
  const [regName, setRegName] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regSpecialization, setRegSpecialization] = useState<string>('مقيّم تربوي معتمد');
  const [regError, setRegError] = useState<string>('');

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (!username.trim()) {
      setErrorMessage(isEn ? 'Please enter your username.' : 'يرجى إدخال اسم المستخدم.');
      return;
    }
    if (!password) {
      setErrorMessage(isEn ? 'Please enter your password.' : 'يرجى إدخال كلمة المرور.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const res = AtharStorageService.authenticate(username, password);
      setIsLoading(false);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
        onClose();
      } else {
        setErrorMessage(res.error || (isEn ? 'Invalid credentials.' : 'بيانات الدخول غير صحيحة.'));
      }
    }, 150);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regName.trim()) {
      setRegError(isEn ? 'Full name is required.' : 'يرجى إدخال الاسم الكامل للمقيم.');
      return;
    }
    if (!regUsername.trim()) {
      setRegError(isEn ? 'Username is required.' : 'يرجى إدخال اسم المستخدم.');
      return;
    }
    if (!regPassword || regPassword.length < 3) {
      setRegError(isEn ? 'Password must be at least 3 characters.' : 'كلمة المرور يجب أن لا تقل عن 3 أحرف أو أرقام.');
      return;
    }

    const res = AtharStorageService.registerEvaluator({
      name: regName,
      username: regUsername,
      password: regPassword,
      specialization: regSpecialization
    });

    if (res.success && res.user) {
      onLoginSuccess(res.user);
      onClose();
    } else {
      setRegError(res.error || (isEn ? 'Registration failed.' : 'فشل التسجيل.'));
    }
  };

  // Quick fill preset credentials
  const fillPreset = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#172C40]/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header with Institutional Navy and Gold */}
        <div className="p-5 border-b border-[#C6A66A]/30 bg-[#172C40] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#C6A66A]/20 border border-[#C6A66A]/40 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#C6A66A]" />
            </div>
            <div>
              <h3 className="font-bold text-base font-['Tajawal'] text-white">
                {isEn ? 'ATHAR Education Platform Login' : 'تسجيل الدخول إلى منظومة «أَثَر»'}
              </h3>
              <p className="text-[11px] text-[#C6A66A] font-medium">
                {isEn ? 'Educational Excellence & Classroom Observation' : 'منظومة التميز والتطوير التعليمي'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setTab('login'); setErrorMessage(''); }}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
              tab === 'login' 
                ? 'border-[#172C40] text-[#172C40] bg-white' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {isEn ? 'Sign In (Username & Password)' : 'تسجيل الدخول (يوزرنيم وباسوورد)'}
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setRegError(''); }}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
              tab === 'register' 
                ? 'border-[#172C40] text-[#172C40] bg-white' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {isEn ? '➕ Register New Evaluator' : '➕ تسجيل مقيّم جديد'}
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6">
          {tab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {isEn ? 'Username' : 'اسم المستخدم (اليوزرنيم)'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={isEn ? 'e.g. arabic or principal' : 'مثال: arabic أو principal'}
                    className="w-full px-3.5 py-2.5 ps-10 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C6A66A] focus:border-transparent transition-all"
                    dir="ltr"
                    required
                  />
                  <UserIcon className="w-4 h-4 text-slate-400 absolute start-3 top-3" />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {isEn ? 'Password' : 'كلمة المرور (الباسوورد)'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3.5 py-2.5 ps-10 pe-10 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C6A66A] focus:border-transparent transition-all"
                    dir="ltr"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#172C40] hover:bg-[#101F2D] text-white text-sm font-bold rounded-lg transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <span>{isEn ? 'Verifying...' : 'جاري التحقق...'}</span>
                ) : (
                  <>
                    <span>{isEn ? 'Sign In to Dashboard' : 'دخول إلى لوحة التحكم'}</span>
                    {isEn ? <ArrowRight className="w-4 h-4 text-[#C6A66A]" /> : <ArrowLeft className="w-4 h-4 text-[#C6A66A]" />}
                  </>
                )}
              </button>

              {/* Quick Fill / Demo Accounts Helper */}
              <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 font-bold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>{isEn ? 'Strict Security: Access, editing, and deletion are restricted to authorized personnel only.' : 'أمان مشدد: صلاحيات الإضافة والتعديل والحذف مقيدة للأشخاص المخولين فقط.'}</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold pt-1">
                  <span>{isEn ? 'Quick-fill Authorized Evaluators:' : 'حسابات المقيّمين المعتمدة:'}</span>
                  <span className="text-slate-400">{isEn ? 'Pass: 123' : 'كلمة المرور: 123'}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => fillPreset('aisha', '123')}
                    className="p-2 text-center rounded-lg border-2 border-[#C6A66A] bg-amber-50/40 hover:bg-[#F2EBDD] transition-colors text-right cursor-pointer"
                  >
                    <span className="block text-[11px] font-black text-[#172C40] truncate">أ. عائشة الغفلي</span>
                    <span className="block text-[9px] text-[#C6A66A] font-bold">مديرة نطاق 2.8</span>
                    <span className="block text-[8px] text-slate-500 font-mono" dir="ltr">u: aisha</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fillPreset('arabic', '123')}
                    className="p-2 text-center rounded-lg border border-slate-200 hover:border-[#172C40] hover:bg-[#F2EBDD]/40 transition-colors text-right cursor-pointer"
                  >
                    <span className="block text-[11px] font-bold text-[#172C40] truncate">رئيس المواد العربية</span>
                    <span className="block text-[8px] text-slate-500 font-mono" dir="ltr">u: arabic</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fillPreset('principal', '123')}
                    className="p-2 text-center rounded-lg border border-slate-200 hover:border-[#172C40] hover:bg-[#F2EBDD]/40 transition-colors text-right cursor-pointer"
                  >
                    <span className="block text-[11px] font-bold text-[#172C40] truncate">مدير المدرسة</span>
                    <span className="block text-[8px] text-slate-500 font-mono" dir="ltr">u: principal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fillPreset('vp', '123')}
                    className="p-2 text-center rounded-lg border border-slate-200 hover:border-[#172C40] hover:bg-[#F2EBDD]/40 transition-colors text-right cursor-pointer"
                  >
                    <span className="block text-[11px] font-bold text-[#172C40] truncate">مساعد المدير</span>
                    <span className="block text-[8px] text-slate-500 font-mono" dir="ltr">u: vp</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {regError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{regError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {isEn ? 'Full Name of Evaluator' : 'الاسم الكامل للمقيّم'}
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder={isEn ? 'e.g. Dr. Sultan Al Ali' : 'مثال: د. سلطان العلي'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C6A66A]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {isEn ? 'Chosen Username' : 'اسم المستخدم (اليوزرنيم المطلوب)'}
                </label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="sultan_ali"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C6A66A]"
                  dir="ltr"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {isEn ? 'Password' : 'كلمة المرور (الباسوورد)'}
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C6A66A]"
                  dir="ltr"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {isEn ? 'Specialization / Role Title' : 'المسمى / التخصص التربوي'}
                </label>
                <input
                  type="text"
                  value={regSpecialization}
                  onChange={(e) => setRegSpecialization(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C6A66A]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#C6A66A] hover:bg-[#b8975b] text-[#172C40] text-sm font-bold rounded-lg transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-3"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isEn ? 'Register & Sign In Now' : 'تسجيل وتفعيل الحساب فوراً'}</span>
              </button>
            </form>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 text-center">
            {isEn 
              ? 'Al-Sadara Boys School - Cycle 2 · UAE Institutional Education' 
              : 'مدرسة الصدارة بنين - الحلقة الثانية · منظومة وزارة التربية والتعليم'}
          </div>
        </div>

      </div>
    </div>
  );
};
