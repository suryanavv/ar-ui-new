import { AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }: ConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="liquid-glass-strong rounded-2xl max-w-md w-full mx-4 p-6 sm:p-8 relative overflow-hidden animate-in zoom-in-95 duration-200"
        style={{
          boxShadow: `
            0 20px 60px rgba(0, 0, 0, 0.3),
            0 8px 24px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.8),
            inset 0 -1px 0 rgba(255, 255, 255, 0.2),
            0 0 40px rgba(14, 165, 163, 0.15)
          `,
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
        {/* Shimmer effect overlay */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent"></div>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 relative"
              style={{
                background: 'linear-gradient(135deg, rgba(14, 165, 163, 0.25), rgba(14, 165, 163, 0.15))',
                backdropFilter: 'blur(12px)',
                border: '2px solid rgba(14, 165, 163, 0.4)',
                boxShadow: '0 4px 16px rgba(14, 165, 163, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
              }}>
              <AlertCircle className="text-primary" size={26} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 drop-shadow-sm">{title}</h3>
              <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">{message}</p>
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <Button
              onClick={onCancel}
              variant="outline"
              className="flex-1 h-11 font-semibold border-2 hover:bg-accent/50 rounded-full"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 h-11 font-semibold liquid-glass-btn-primary no-transform"
              style={{ transform: 'none' }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

