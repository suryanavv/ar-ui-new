import { AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

interface SessionExpiredModalProps {
  isOpen: boolean;
  onLogin: () => void;
}

export const SessionExpiredModal = ({ isOpen, onLogin }: SessionExpiredModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-md bg-black/30">
      <div className="liquid-glass-table p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Logo */}
          {/* <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="EzMedTech Logo" className="w-8 h-8 object-contain" />
            <h1 className="text-xl font-semibold text-foreground">EZMedtech</h1>
          </div> */}

          {/* Icon */}
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-[#26C6C0]/20 border border-white/30">
            <AlertCircle className="text-primary" size={32} />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              Session Expired
            </h2>
            <p className="text-foreground text-sm leading-relaxed">
              Your session has expired due to inactivity. Please log in again to continue.
            </p>
          </div>

          <Button
            onClick={onLogin}
            className="w-full py-3 px-6 bg-gradient-to-br from-primary/80 to-[#26C6C0]/80 backdrop-blur-xl border border-white/30 shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_0_25px_rgba(14,165,163,0.4)] hover:scale-[1.02] text-white font-semibold transition-all duration-300 rounded-xl"
          >
            Log In Again
          </Button>
        </div>
      </div>
    </div>
  );
};

