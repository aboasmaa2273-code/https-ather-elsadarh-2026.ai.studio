import React, { useState } from 'react';
import { User } from '../types';
import { AtharStorageService } from '../services/storageService';
import { atharRemoteLogin } from '../services/gasBridgeClient';
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
  selectedEvaluator?: User | null;
  language?: Language;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  selectedEvaluator = null,
  language = 'ar'
}) => {
  const isEn = language === 'en';
  const [tab] = useState<'login'>('login');
  
  // Login fields
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);


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
    (async () => {
      try {
        const remote = await atharRemoteLogin(username, password);
        if (remote.success && remote.user) {
          const user = remote.user as User;
          if (selectedEvaluator && (user.id !== selectedEvaluator.id || user.role !== 'evaluator')) {
            setErrorMessage(isEn
              ? 'This portal belongs to a different evaluator account.'
              : 'هذه البوابة مخصصة للمقيم المحدد فقط. تحقق من بيانات الحساب أو اختر بوابتك الصحيحة.');
            return;
          }
          AtharStorageService.setCurrentUser(user);
          onLoginSuccess(user);
          onClose();
        } else {
          setErrorMessage(remote.error || (isEn ? 'Invalid credentials.' : 'بيانات الدخول غير صحيحة.'));
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'تعذر الاتصال بقاعدة البيانات.');
      } finally { setIsLoading(false); }
    })();
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
                {selectedEvaluator ? (isEn ? `Evaluator Portal: ${selectedEvaluator.name}` : `بوابة المقيم: ${selectedEvaluator.name}`) : (isEn ? 'ATHAR Education Platform Login' : 'تسجيل الدخول إلى منظومة «أَثَر»')}
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

        <div className="border-b border-slate-200 bg-slate-50 text-xs font-bold py-3 text-center text-[#172C40]">
          {selectedEvaluator ? (selectedEvaluator.roleTitle || (isEn ? 'Authorized Evaluator' : 'مقيّم معتمد')) : (isEn ? 'Authorized Evaluator Sign In' : 'دخول المقيمين والزائرين المعتمدين فقط')}
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

              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 font-bold">
                  {isEn ? 'Only accounts listed and activated by the platform administrator can sign in.' : 'يُسمح بالدخول للحسابات المدرجة والمعتمدة من إدارة المنظومة فقط.'}
                </div>
              </div>
            </form>
          ) : (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
              {isEn ? 'Accounts are created by the platform or school administrator.' : 'تُنشئ إدارة المنصة أو إدارة المدرسة الحسابات المعتمدة.'}
            </div>
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
