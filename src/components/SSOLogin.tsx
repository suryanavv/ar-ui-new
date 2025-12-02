import { useState, useEffect } from 'react';
import { FiAlertCircle, FiLoader } from 'react-icons/fi';
import logo from '../assets/favicon-32x32.png';
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src={logo} alt="EZ MEDTECH" className="h-16 w-16" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              SSO Authentication
            </h1>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="flex justify-center mb-4">
                <FiLoader className="animate-spin text-teal-700" size={48} />
              </div>
              <p className="text-gray-600 text-lg">
                Authenticating via SSO...
              </p>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <>
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3">
                <FiAlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-red-800">{error}</p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleRetry}
                  className="w-full py-3 px-4 bg-teal-700 text-white rounded-xl font-semibold transition-all hover:bg-teal-800 hover:shadow-lg hover:-translate-y-0.5"
                >
                  Retry
                </button>
                <button
                  onClick={handleGoToLogin}
                  className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-semibold transition-all hover:bg-gray-200 hover:shadow-lg hover:-translate-y-0.5"
                >
                  Go to Login Page
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
