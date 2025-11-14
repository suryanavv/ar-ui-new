import logo from '../assets/logo.jpg';
import { ProfileDropdown } from './ProfileDropdown';
import type { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

export const Header = ({ user, onLogout }: HeaderProps) => {
  return (
    <header className="relative z-50 bg-white backdrop-blur-sm shadow-sm">
      {/* Top Bar - Full Width, No Gaps */}
      <div className="relative flex items-center justify-between py-2 px-4">
        {/* Logo - Left Corner */}
        <div className="flex-shrink-0">
          <img 
            src={logo} 
            alt="EZ MEDTECH" 
            className="h-32 w-32 object-contain"
            loading="eager"
          />
        </div>
        
        {/* Title and Description - Center */}
        <div className="absolute left-1/2 transform -translate-x-1/2 text-center">
          <h1 className="text-3xl font-semibold text-teal-700 whitespace-nowrap">
            Account Receivability Dashboard
          </h1>
          <p className="text-sm text-gray-600 font-normal mt-1 whitespace-nowrap">
            Upload and manage patient invoices for automated calling
          </p>
        </div>
        
        {/* Profile Dropdown - Right */}
        <div className="flex-shrink-0 relative z-[10000]">
          <ProfileDropdown user={user} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
};
