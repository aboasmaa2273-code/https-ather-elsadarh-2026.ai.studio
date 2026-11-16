import type { User } from '../types';

type BridgeRequest = {
  action: string;
  payload?: Record<string, unknown>;
  token?: string;
};

type BridgeResponse<T = unknown> = {
  success: boolean;
  error?: string;
  token?: string;
  user?: User;
  data?: T;
  [key: string]: unknown;
};

type PendingRequest = {
  resolve: (value: BridgeResponse) => void;
  reject: (reason: Error) => void;
  timeout: number;
};

const CHANNEL_REQUEST = 'ATHAR_GAS_REQUEST';
const CHANNEL_RESPONSE = 'ATHAR_GAS_BRIDGE';
const CHANNEL_READY = 'ATHAR_GAS_BRIDGE_READY';

/**
 * Cross-origin transport for the Apps Script web app.
 * The Google-hosted iframe executes google.script.run, avoiding browser CORS
 * restrictions on ContentService fetch redirects.
 */
class AtharGasBridgeClient {
  private frame: HTMLIFrameElement | null = null;
  private ready = false;
  private loading: Promise<void> | null = null;
  private pending = new Map<string, PendingRequest>();
  private sequence = 0;
  private endpoint = '';

  configure(webAppUrl: string): void {
    const normalized = webAppUrl.trim();
    if (!normalized) throw new Error('أدخل رابط نشر Google Apps Script أولاً.');
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec(?:\?.*)?$/.test(normalized)) {
      throw new Error('رابط Apps Script غير صالح. استخدم رابط النشر الذي ينتهي بـ /exec.');
    }
    const bridgeUrl = normalized + (normalized.includes('?') ? '&' : '?') + 'bridge=1';
    if (bridgeUrl !== this.endpoint) {
      this.dispose();
      this.endpoint = bridgeUrl;
    }
  }

  /**
   * Apps Script HtmlService nests user HTML inside Google-owned frames.
   * Collect the outer web-app frame and its descendants so messages can
   * reach the actual Bridge.html sandbox and replies can be authenticated
   * against a window belonging to this exact iframe tree.
   */
  private getFrameWindows(root: Window): Window[] {
    const result: Window[] = [];
    const seen = new Set<Window>();

    const visit = (current: Window, depth: number) => {
      if (!current || seen.has(current) || depth > 10) return;
      seen.add(current);
      result.push(current);
      try {
        for (let i = 0; i < current.frames.length; i++) {
          visit(current.frames[i], depth + 1);
        }
      } catch {
        // Cross-origin frame enumeration may be restricted; retain all
        // windows successfully discovered so far.
      }
    };

    visit(root, 0);
    return result;
  }

  private ensureFrame(): Promise<void> {
    if (this.ready && this.frame?.contentWindow) return Promise.resolve();
    if (this.loading) return this.loading;
    if (!this.endpoint) return Promise.reject(new Error('لم يتم إعداد رابط Apps Script.'));

    this.loading = new Promise<void>((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.title = 'Athar secure data connection';
      frame.setAttribute('aria-hidden', 'true');
      frame.style.position = 'fixed';
      frame.style.width = '1px';
      frame.style.height = '1px';
      frame.style.opacity = '0';
      frame.style.pointerEvents = 'none';
      frame.style.border = '0';
      const timer = window.setTimeout(() => {
        this.loading = null;
        frame.remove();
        window.removeEventListener('message', onMessage);
        reject(new Error('تعذر فتح جسر Google Apps Script. تحقق من رابط النشر وإتاحته.'));
      }, 20000);

      const onMessage = (event: MessageEvent) => {
        const root = frame.contentWindow;
        if (!root || !event.data) return;
        const frameWindows = this.getFrameWindows(root);
        if (!frameWindows.some((candidate) => candidate === event.source)) return;

        if (event.data.channel === CHANNEL_READY) {
          window.clearTimeout(timer);
          this.ready = true;
          this.loading = null;
          resolve();
          return;
        }
        if (event.data.channel === CHANNEL_RESPONSE && event.data.id) {
          const pending = this.pending.get(event.data.id);
          if (!pending) return;
          window.clearTimeout(pending.timeout);
          this.pending.delete(event.data.id);
          pending.resolve(event.data.result as BridgeResponse);
        }
      };
      window.addEventListener('message', onMessage);
      frame.addEventListener('error', () => {
        window.clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        this.loading = null;
        reject(new Error('فشل تحميل جسر Google Apps Script.'));
      }, { once: true });
      frame.src = this.endpoint;
      this.frame = frame;
      document.body.appendChild(frame);
    });
    return this.loading;
  }

  async request<T = unknown>(request: BridgeRequest): Promise<BridgeResponse<T>> {
    await this.ensureFrame();
    const root = this.frame?.contentWindow;
    if (!root) throw new Error('اتصال قاعدة البيانات غير متاح.');
    const id = `athar_${Date.now()}_${++this.sequence}`;
    return new Promise<BridgeResponse<T>>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('انتهت مهلة الاتصال بقاعدة البيانات. لم يتم تأكيد الحفظ.'));
      }, 30000);
      this.pending.set(id, {
        resolve: resolve as (value: BridgeResponse) => void,
        reject,
        timeout
      });

      const message = { channel: CHANNEL_REQUEST, id, request };
      // The actual Apps Script HTML runs in a nested sandbox frame, not
      // necessarily in the outer iframe's contentWindow. Send to the
      // discovered frame tree; only Bridge.html handles this channel.
      this.getFrameWindows(root).forEach((target) => {
        try {
          target.postMessage(message, '*');
        } catch {
          // Continue sending to the remaining discovered frames.
        }
      });
    });
  }

  dispose(): void {
    this.ready = false;
    this.loading = null;
    this.frame?.remove();
    this.frame = null;
    this.pending.forEach((item) => {
      window.clearTimeout(item.timeout);
      item.reject(new Error('تم إغلاق اتصال قاعدة البيانات.'));
    });
    this.pending.clear();
  }
}

export const atharGasBridge = new AtharGasBridgeClient();


const GAS_URL_KEY = 'athar_gas_web_app_url_v1';
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwllpGW5zoG6jKSvIq_UY2ae49wAejhuoQN9vYSRTlNmTmCcrehA7fth4ZaRHtw6Cv6/exec';
const GAS_TOKEN_KEY = 'athar_gas_session_token_v1';
export function configureAtharBridge(): boolean {
  const url = localStorage.getItem(GAS_URL_KEY) || DEFAULT_GAS_URL;
  if (!url) return false;
  atharGasBridge.configure(url);
  return true;
}
export async function atharPublicEvaluators() {
  if (!configureAtharBridge()) return [];
  const result = await atharGasBridge.request<{ evaluators?: User[] }>({ action: 'publicEvaluators' });
  if (!result.success) throw new Error(result.error || 'تعذر تحميل دليل المقيمين.');
  return Array.isArray(result.evaluators) ? result.evaluators : [];
}

export async function atharRemoteLogin(username: string, password: string) {
  if (!configureAtharBridge()) return { success: false, error: 'لم يتم إعداد رابط قاعدة بيانات أَثَر بعد. افتح مركز الربط وأدخل رابط Apps Script المنشور.' };
  const result = await atharGasBridge.request<User>({ action: 'login', payload: { username, password } });
  if (result.success && result.token) localStorage.setItem(GAS_TOKEN_KEY, result.token);
  return result;
}
export async function atharRemoteBootstrap() {
  if (!configureAtharBridge()) throw new Error('رابط قاعدة البيانات غير مضبوط.');
  const token = localStorage.getItem(GAS_TOKEN_KEY) || '';
  if (!token) throw new Error('سجّل الدخول أولاً.');
  const result = await atharGasBridge.request({ action: 'bootstrap', token });
  if (!result.success) throw new Error(result.error || 'تعذر تحميل بيانات قاعدة البيانات.');
  return result;
}
export function clearAtharRemoteSession() { localStorage.removeItem(GAS_TOKEN_KEY); }

export async function atharRemoteAction(action: string, payload: Record<string, unknown>) {
  if (!configureAtharBridge()) throw new Error('رابط قاعدة البيانات غير مضبوط.');
  const token = localStorage.getItem(GAS_TOKEN_KEY) || '';
  if (!token) throw new Error('انتهت الجلسة. سجّل الدخول مجدداً.');
  const result = await atharGasBridge.request({ action, payload, token });
  if (!result.success) throw new Error(result.error || 'لم يؤكد الخادم تنفيذ العملية.');
  return result;
}
