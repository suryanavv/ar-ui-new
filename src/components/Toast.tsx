import { useEffect, useState, useRef, useCallback } from 'react';
import { FiCheckCircle, FiXCircle, FiInfo, FiX } from 'react-icons/fi';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: number) => void;
}

export const ToastContainer = ({ toasts, onRemove }: ToastContainerProps) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: number) => void;
}

const ToastItem = ({ toast, onRemove }: ToastItemProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const fadeOutTimerRef = useRef<number | null>(null);
  const mainTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Trigger fade-in animation
    setTimeout(() => setIsVisible(true), 10);
    
    // Auto-remove after 5 seconds
    mainTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      fadeOutTimerRef.current = setTimeout(() => {
        onRemove(toast.id);
        fadeOutTimerRef.current = null;
      }, 300); // Wait for fade-out
    }, 5000);

    return () => {
      if (mainTimerRef.current) {
        clearTimeout(mainTimerRef.current);
        mainTimerRef.current = null;
      }
      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current);
        fadeOutTimerRef.current = null;
      }
    };
  }, [toast.id, onRemove]);

  const iconColors = {
    success: 'text-green-500',
    error: 'text-red-500',
    info: 'text-primary',
  };

  const borderColors = {
    success: 'border-l-4 border-green-500',
    error: 'border-l-4 border-red-500',
    info: 'border-l-4 border-primary',
  };

  const icons = {
    success: FiCheckCircle,
    error: FiXCircle,
    info: FiInfo,
  };

  const Icon = icons[toast.type];

  return (
    <div
      className={`liquid-glass flex items-start gap-3 p-4 rounded-xl transition-all duration-300 ${borderColors[toast.type]} ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
    >
      <Icon className={`flex-shrink-0 mt-0.5 ${iconColors[toast.type]}`} size={20} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium break-words text-foreground">{toast.message}</p>
      </div>
      <button
        onClick={() => {
          setIsVisible(false);
          // Clear any pending timers
          if (mainTimerRef.current) {
            clearTimeout(mainTimerRef.current);
            mainTimerRef.current = null;
          }
          if (fadeOutTimerRef.current) {
            clearTimeout(fadeOutTimerRef.current);
            fadeOutTimerRef.current = null;
          }
          setTimeout(() => onRemove(toast.id), 300);
        }}
        className="flex-shrink-0 text-foreground/60 hover:text-foreground transition-colors rounded-full hover:bg-white/10 p-1"
      >
        <FiX size={18} />
      </button>
    </div>
  );
};

// Hook for managing toasts
export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdCounterRef = useRef(0);

  const showToast = (type: ToastType, message: string) => {
    const id = ++toastIdCounterRef.current;
    const newToast: Toast = { id, type, message };
    setToasts((prev) => [...prev, newToast]);
    return id;
  };

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
};
