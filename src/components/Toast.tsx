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

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const icons = {
    success: FiCheckCircle,
    error: FiXCircle,
    info: FiInfo,
  };

  const Icon = icons[toast.type];

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border-2 transition-all duration-300 ${
        styles[toast.type]
      } ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}`}
    >
      <Icon className="flex-shrink-0 mt-0.5" size={20} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium break-words">{toast.message}</p>
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
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
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
