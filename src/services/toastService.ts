export class ToastService {
  private static container: HTMLElement | null = null;

  private static getContainer(): HTMLElement {
    if (!this.container || !document.body.contains(this.container)) {
      this.container = document.createElement('div');
      this.container.id = 'toast-notification-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        pointer-events: none;
        max-width: 90vw;
        width: 420px;
      `;
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  // Show a sleek in-app toast notification
  static show(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success', duration = 3500): void {
    const container = this.getContainer();

    const toast = document.createElement('div');
    toast.className = 'in-app-toast animate-scale-up';
    
    let bg = 'rgba(13, 44, 84, 0.95)';
    let border = 'rgba(0, 200, 83, 0.5)';
    let icon = '✅';

    if (type === 'error') {
      bg = 'rgba(88, 28, 28, 0.95)';
      border = 'rgba(239, 68, 68, 0.6)';
      icon = '❌';
    } else if (type === 'warning') {
      bg = 'rgba(74, 45, 12, 0.95)';
      border = 'rgba(245, 158, 11, 0.6)';
      icon = '⚠️';
    } else if (type === 'info') {
      bg = 'rgba(30, 41, 59, 0.95)';
      border = 'rgba(59, 130, 246, 0.6)';
      icon = 'ℹ️';
    }

    toast.style.cssText = `
      background: ${bg};
      border: 1.5px solid ${border};
      color: #FFFFFF;
      padding: 10px 18px;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      font-family: 'Cairo', sans-serif;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
      direction: rtl;
      pointer-events: auto;
      transition: all 0.3s ease;
      text-align: right;
    `;

    toast.innerHTML = `
      <span style="font-size: 16px;">${icon}</span>
      <span style="flex: 1; line-height: 1.4;">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px) scale(0.95)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // Custom In-App Confirmation Dialog (Zero reliance on window.confirm!)
  static confirm(options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }): void {
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      font-family: 'Cairo', sans-serif;
      direction: rtl;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #0D1B2A;
      border: 1.5px solid ${options.isDanger ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0, 200, 83, 0.4)'};
      border-radius: 24px;
      padding: 24px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 20px 50px rgba(0,0,0,0.8);
      text-align: right;
      color: #FFFFFF;
      animation: scaleUp 0.2s ease-out forwards;
    `;

    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <div style="width:42px; height:42px; border-radius:14px; background:${options.isDanger ? 'rgba(239,68,68,0.2)' : 'rgba(0,200,83,0.2)'}; color:${options.isDanger ? '#F87171' : '#34D399'}; display:flex; align-items:center; justify-content:center; font-size:20px;">
          ${options.isDanger ? '🗑️' : '❓'}
        </div>
        <div>
          <h4 style="margin:0; font-size:16px; font-weight:800; color:#FFFFFF;">${options.title}</h4>
        </div>
      </div>

      <p style="margin:0 0 20px 0; font-size:13px; color:#94A3B8; line-height:1.5;">${options.message}</p>

      <div style="display:flex; gap:10px;">
        <button id="dialog-btn-confirm" style="flex:1; background:${options.isDanger ? 'linear-gradient(135deg, #DC2626, #B91C1C)' : 'linear-gradient(135deg, #00A859, #007A3D)'}; color:#FFFFFF; border:none; border-radius:12px; padding:10px 16px; font-size:13px; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-family:'Cairo', sans-serif;">
          ${options.confirmText || 'تأكيد'}
        </button>
        <button id="dialog-btn-cancel" style="background:#1E293B; color:#CBD5E1; border:1px solid #334155; border-radius:12px; padding:10px 16px; font-size:13px; font-weight:700; cursor:pointer; font-family:'Cairo', sans-serif;">
          ${options.cancelText || 'إلغاء'}
        </button>
      </div>
    `;

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    const cleanup = () => backdrop.remove();

    card.querySelector('#dialog-btn-confirm')?.addEventListener('click', () => {
      cleanup();
      options.onConfirm();
    });

    card.querySelector('#dialog-btn-cancel')?.addEventListener('click', () => {
      cleanup();
      options.onCancel?.();
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        cleanup();
        options.onCancel?.();
      }
    });
  }
}
