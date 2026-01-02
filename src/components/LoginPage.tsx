import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import type { User } from '../types';

interface LoginPageProps {
  onLogin: (token: string, user: User) => void;
}

export const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();

      // Store refresh_token in cookie (not localStorage)
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      const { setRefreshTokenCookie } = await import('../lib/cookies');
      setRefreshTokenCookie(data.refresh_token);
      
      // Store access_token in memory (import from api.ts)
      const { setAccessToken } = await import('../services/api');
      setAccessToken(data.access_token);

      // Call parent callback with access_token and user (for immediate use)
      onLogin(data.access_token, data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Hidden on mobile/tablet, visible on desktop */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
        <div className="relative z-10 flex flex-col justify-between w-full px-8 xl:px-12 py-8 xl:py-12">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="EzMedTech Logo" className="w-8 h-8 object-contain" />
            <h1 className="text-xl font-semibold">EZMedTech</h1>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-3xl xl:text-4xl mb-4 xl:mb-6 leading-tight">Streamline your accounts receivable operations.</h2>
            <p className="text-base xl:text-lg leading-relaxed">
              Manage patient invoices, track payments, automate collections, and more.
            </p>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span>© {new Date().getFullYear()} EZMedTech. All rights reserved.</span>
            <span className="cursor-pointer hover:underline">Privacy Policy</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-8 sm:px-6 sm:py-10 md:px-8 md:py-12 lg:p-8 bg-background min-h-screen liquid-glass-environment">
        <div className="w-full max-w-[340px] sm:max-w-sm md:max-w-md mx-auto space-y-5 sm:space-y-6 md:space-y-8 p-5 sm:p-6 md:p-8 liquid-glass">
          {/* Mobile/Tablet Logo - Hidden on desktop */}
          <div className="lg:hidden text-center mb-4 sm:mb-6 md:mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <img src="/logo.svg" alt="EzMedTech Logo" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
              <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground">EZMedtech</h1>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <div className="text-center -mt-2 sm:-mt-3">
              {/* <h2 className="text-xl sm:text-2xl text-foreground font-semibold">Login</h2> */}
              {/* <p className="text-sm sm:text-base mt-1">Sign in to your account</p> */}
            </div>

            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-2 p-2.5 sm:p-3 rounded-lg bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30 backdrop-blur-sm text-foreground">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              {/* Email Field */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="email" className="text-xs sm:text-sm font-medium text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="liquid-glass-input h-10 sm:h-9 text-sm text-foreground placeholder:text-foreground/50"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="password" className="text-xs sm:text-sm font-medium text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pr-10 liquid-glass-input h-10 sm:h-9 text-sm text-foreground placeholder:text-foreground/50"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full cursor-pointer px-3 text-foreground hover:bg-white/20"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 sm:h-3 sm:w-3" />
                    ) : (
                      <Eye className="h-4 w-4 sm:h-3 sm:w-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Remember me and Forgot password */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setRememberMe(checked);
                    }}
                    className="rounded border-white/40 cursor-pointer w-4 h-4 accent-primary"
                  />
                  <Label htmlFor="remember" className="text-xs sm:text-sm cursor-pointer text-foreground">
                    Remember me
                  </Label>
                </div>
                {/* <span className="text-xs sm:text-sm text-foreground cursor-pointer hover:underline">
                  Forgot password?
                </span> */}
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full liquid-glass-btn-primary h-11 sm:h-10 text-sm sm:text-base font-semibold"
              >
                {isLoading ? (
                  <>
                    <span>Logging in...</span>
                    <div className="ml-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  </>
                ) : (
                  <>
                    <span>Login</span>
                    <span className="text-lg ml-2">→</span>
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};