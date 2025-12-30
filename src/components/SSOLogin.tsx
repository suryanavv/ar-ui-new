import { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import type { User } from '../types';

interface SSOLoginProps {
  onLogin: (token: string, user: User) => void;
}

export const SSOLogin = ({ onLogin }: SSOLoginProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const authenticateSSO = async () => {
      try {
        // Extract token from URL search params
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (!token) {
          setError('No SSO token provided in URL');
          setLoading(false);
          return;
        }

        // Call SSO login endpoint
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${API_URL}/sso-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sso_token: token }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'SSO login failed');
        }

        const data = await response.json();

        // Store tokens and user in localStorage
        // Clear any stale session data to avoid cross-clinic leakage
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Call parent callback
        onLogin(data.access_token, data.user);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'SSO authentication failed');
        setLoading(false);
      }
    };

    authenticateSSO();
  }, [onLogin]);

  const handleRetry = () => {
    setLoading(true);
    setError('');
    window.location.reload();
  };

  const handleGoToLogin = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#d4d7e9] liquid-glass-environment px-4 py-8">
      <div className="w-full max-w-md mx-auto">
        <div className="liquid-glass p-8 sm:p-10 md:p-12 rounded-2xl space-y-6 sm:space-y-8">
          {/* Logo */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src="/logo.svg" alt="EzMedTech Logo" className="w-8 h-8 object-contain" />
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">EZMedTech</h1>
            </div>
            <h2 className="text-xl sm:text-2xl text-foreground font-semibold mb-2">SSO Authentication</h2>
            <p className="text-sm sm:text-base text-foreground/70">Signing you in securely...</p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="flex justify-center mb-4">
                <Loader2 className="animate-spin text-primary" size={48} />
              </div>
              <p className="text-foreground text-lg">
                Authenticating via SSO...
              </p>
              <p className="text-foreground/60 text-sm mt-2">
                Please wait while we verify your credentials
              </p>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 sm:p-4 rounded-lg bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30 backdrop-blur-sm text-foreground">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm sm:text-base">{error}</span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleRetry}
                  className="w-full liquid-glass-btn-primary h-11 text-base font-semibold"
                >
                  Retry
                </Button>
                <Button
                  onClick={handleGoToLogin}
                  variant="outline"
                  className="w-full h-11 text-base font-semibold"
                >
                  Go to Login Page
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
