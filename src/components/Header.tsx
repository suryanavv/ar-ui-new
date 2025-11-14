import logo from '../assets/favicon-32x32.png';

interface HeaderProps {
  user: any;
  onLogout: () => void;
}

export const Header = ({ user, onLogout }: HeaderProps) => {
  return (
    <header className="mb-8">
      <div className="bg-white px-6 py-4 rounded-2xl shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="EZ MEDTECH" className="h-12 w-12 object-contain" />
          <h1 className="text-2xl font-bold text-teal-700">Account Receivability Dashboard</h1>
        </div>
        
        {/* User Info & Logout - Top Right */}
        <div className="bg-white px-4 py-2 rounded-xl shadow-sm flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">{user?.full_name || user?.email}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
      
      <div className="mt-4 px-6 py-5 bg-white rounded-2xl shadow-sm">
        <p className="text-gray-700 font-medium">Upload and manage patient invoices for automated calling</p>
      </div>
    </header>
  );
};
