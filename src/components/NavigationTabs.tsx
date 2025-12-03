interface NavigationTabsProps {
  activeSection: 'dashboard' | 'upload' | 'invoice-list' | 'patients' | 'users';
  isAdmin: boolean;
  onSectionChange: (section: 'dashboard' | 'upload' | 'invoice-list' | 'patients' | 'users') => void;
}

export const NavigationTabs = ({ activeSection, isAdmin, onSectionChange }: NavigationTabsProps) => {
  return (
    <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => {
            onSectionChange('dashboard');
          }}
          className={`flex-1 px-6 py-4 font-semibold text-sm transition-colors ${
            activeSection === 'dashboard'
              ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Dashboard
          </div>
        </button>
        <button
          onClick={() => {
            onSectionChange('upload');
          }}
          className={`flex-1 px-6 py-4 font-semibold text-sm transition-colors ${
            activeSection === 'upload'
              ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload CSV
          </div>
        </button>
        <button
          onClick={() => {
            onSectionChange('invoice-list');
          }}
          className={`flex-1 px-6 py-4 font-semibold text-sm transition-colors ${
            activeSection === 'invoice-list'
              ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Invoice List
          </div>
        </button>
        <button
          onClick={() => {
            onSectionChange('patients');
          }}
          className={`flex-1 px-6 py-4 font-semibold text-sm transition-colors ${
            activeSection === 'patients'
              ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Patients
          </div>
        </button>
        {isAdmin && (
          <button
            onClick={() => {
              onSectionChange('users');
            }}
            className={`flex-1 px-6 py-4 font-semibold text-sm transition-colors ${
              activeSection === 'users'
                ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-700'
                : 'text-gray-600 hover:text-teal-700 hover:bg-gray-50'
            }`}
          >
            User Management
          </button>
        )}
      </div>
    </div>
  );
};

