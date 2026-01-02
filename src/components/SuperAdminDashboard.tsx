import { useEffect, useState } from 'react';
import { getSuperAdminDashboardStats } from '../services/api';
import { formatDateTime } from '../utils/timezone';
import {
  FiFileText,
  FiUsers,
  FiDollarSign,
  FiCheckCircle,
  FiHome,
} from 'react-icons/fi';

interface SuperAdminDashboardData {
  total_clinics: number;
  total_staff: number;
  clinics: Array<{
    id: number;
    name: string;
    patient_count: number;
    call_count: number;
    staff: Array<{
      id: number;
      email: string;
      full_name: string;
      role: string;
      is_active: boolean;
    }>;
    created_at: string;
  }>;
  global_stats: {
    total_invoices: number;
    total_patients: number;
    total_appointments: number;
    total_outstanding: number;
    total_amount_paid: number;
    calls_made: number;
    calls_completed: number;
    calls_pending: number;
    calls_failed: number;
    recent_calls: number;
    recent_uploads: number;
    total_files: number;
    status_distribution: Array<{ status: string; count: number }>;
    recent_calls_list: Array<{
      patient_first_name: string;
      patient_last_name: string;
      phone_number: string;
      patient_account_number: string;
      called_at: string;
      call_status: string;
      notes: string;
    }>;
    paid_patients: Array<{
      patient_first_name: string;
      patient_last_name: string;
      phone_number: string;
      invoice_number: string;
      amount_paid: number;
      payment_completed_at: string | null;
    }>;
  };
}

export const SuperAdminDashboard = () => {
  const [data, setData] = useState<SuperAdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await getSuperAdminDashboardStats();
      setData(response);
    } catch (error) {
      console.error('Failed to load super admin dashboard stats:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Expose refresh function
  useEffect(() => {
    const dashboardRefresh = () => {
      loadStats();
    };
    (window as { refreshDashboard?: () => void }).refreshDashboard = dashboardRefresh;
    return () => {
      delete (window as { refreshDashboard?: () => void }).refreshDashboard;
    };
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getInitial = (fullName: string): string => {
    if (!fullName) return '?';
    const firstChar = fullName.trim().charAt(0).toUpperCase();
    return firstChar;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-sm text-foreground">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="liquid-glass p-4 sm:p-6 md:p-8 rounded-xl border border-white/20 shadow-lg">
        <div className="text-center py-6 sm:py-8 md:py-12">
          <FiHome className="w-12 h-12 mx-auto mb-4 text-foreground" />
          <p className="text-foreground">Unable to load dashboard statistics</p>
        </div>
      </div>
    );
  }

  const { global_stats, clinics } = data;

  // Global stats cards
  const globalStatsCards = [
    {
      key: 'totalClinics',
      label: 'Total Clinics',
      icon: FiHome,
      value: data.total_clinics,
      gradient: 'from-sky-500/20 via-sky-500/10 to-transparent',
      border: 'border-sky-500/50',
    },
    {
      key: 'totalPatients',
      label: 'Total Patients',
      icon: FiUsers,
      value: global_stats.total_patients,
      gradient: 'from-sky-500/20 via-sky-500/10 to-transparent',
      border: 'border-sky-500/50',
    },
    {
      key: 'globalInvoices',
      label: 'Global Invoices',
      icon: FiFileText,
      value: global_stats.total_invoices,
      gradient: 'from-sky-500/20 via-sky-500/10 to-transparent',
      border: 'border-sky-500/50',
    },
    {
      key: 'amountPaid',
      label: 'Amount Paid',
      icon: FiCheckCircle,
      value: global_stats.total_amount_paid,
      formatValue: formatCurrency,
      gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
      border: 'border-emerald-500/50',
      useSmallerText: true,
    },
    {
      key: 'globalOutstanding',
      label: 'Global Outstanding',
      icon: FiDollarSign,
      value: global_stats.total_outstanding,
      formatValue: formatCurrency,
      gradient: 'from-red-500/20 via-red-500/10 to-transparent',
      border: 'border-red-500/50',
      useSmallerText: true,
    },
  ];

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 px-2 sm:px-4 md:px-0">
      {/* Global Stats Cards */}
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
          {globalStatsCards.map((metric) => {
            const IconComponent = metric.icon;
            const displayValue = metric.formatValue
              ? metric.formatValue(typeof metric.value === 'number' ? metric.value : 0)
              : metric.value;
            const textSizeClass = metric.useSmallerText
              ? 'text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl'
              : 'text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl';

            return (
              <div
                key={metric.key}
                className={`relative overflow-hidden rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all duration-300 group
                  bg-gradient-to-br ${metric.gradient}
                  backdrop-blur-xl border-2 ${metric.border}
                  shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)]
                  hover:scale-[1.02] glass-shine`}
              >
                {/* Dynamic Sliding Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />
                <div className="relative space-y-1 sm:space-y-2 z-10">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold !text-foreground drop-shadow-sm">
                    <IconComponent className="size-4 sm:size-5" />
                    <span className="truncate">{metric.label}</span>
                  </div>
                  <div className={`${textSizeClass} font-bold tabular-nums !text-foreground drop-shadow-md ${metric.useSmallerText ? 'break-words' : ''}`}>
                    {displayValue}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clinics List */}
      <div className="space-y-4 sm:space-y-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
            Clinics
          </h2>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
          {clinics.map((clinic) => (
            <div
              key={clinic.id}
              className="relative glass-card p-0 border border-white/25 transition-all duration-300 rounded-2xl sm:rounded-3xl"
            >
                {/* Header Section with Gradient Overlay */}
                <div className="relative px-5 sm:px-6 pt-5 sm:pt-6">
                  <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none" />

                  <div className="relative flex items-start justify-between gap-4">
                    {/* Clinic Name */}
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg md:text-xl font-bold text-foreground truncate transition-colors">
                        {clinic.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-foreground/60 mt-0.5">
                        Joined {formatDateTime(clinic.created_at, { includeTime: true })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats Section */}
                <div className="px-5 sm:px-6 py-4">
                  <div className="flex gap-3 sm:gap-4">
                    {/* Patients Stat */}
                    <div className="flex-1 relative group/stat">
                      <div className="relative p-3 sm:p-4 rounded-xl bg-gradient-to-br from-sky-500/10 to-blue-500/5 border border-sky-500/20 backdrop-blur-xl overflow-hidden transition-all duration-300">
                        {/* Animated shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] transition-transform duration-700" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-1">
                            <FiUsers className="w-4 h-4 text-sky-500" />
                            <span className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Patients</span>
                          </div>
                          <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
                            {clinic.patient_count}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Calls Stat */}
                    <div className="flex-1 relative group/stat">
                      <div className="relative p-3 sm:p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 backdrop-blur-xl overflow-hidden transition-all duration-300">
                        {/* Animated shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] transition-transform duration-700" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-1">
                            <FiCheckCircle className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Calls</span>
                          </div>
                          <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
                            {clinic.call_count}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Staff Section */}
                <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-foreground/80 uppercase tracking-wider">Team</span>
                      <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30">
                        <span className="text-xs font-bold text-foreground">{clinic.staff.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Staff List */}
                  <div className="space-y-1.5">
                    {clinic.staff.map((staffMember, index) => (
                      <div
                        key={staffMember.id}
                        className="group/member relative"
                        style={{
                          animationDelay: `${index * 50}ms`,
                        }}
                      >
                        {/* Staff Card */}
                        <div className="relative p-2 sm:p-2.5 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/20 backdrop-blur-xl transition-all duration-300">
                          <div className="flex items-center justify-between gap-3">
                            {/* Left: Avatar, Name, Email */}
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {/* Avatar */}
                              <div className="relative flex-shrink-0">
                                <div className="absolute inset-0 bg-gradient-to-br from-violet-400 to-purple-500 rounded-full blur-md opacity-30 transition-opacity" />
                                <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-violet-500/30 to-purple-500/30 border-2 border-white/40 flex items-center justify-center backdrop-blur-xl">
                                  <span className="text-xs sm:text-sm font-bold text-foreground">
                                    {getInitial(staffMember.full_name)}
                                  </span>
                                </div>
                              </div>

                              {/* Name and Email */}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                                  {staffMember.full_name}
                                </p>
                                <p className="text-[10px] sm:text-xs text-foreground/50 truncate mt-0.5 normal-case">
                                  {staffMember.email}
                                </p>
                              </div>
                            </div>

                            {/* Right: Role Tag */}
                            <div className="flex-shrink-0">
                              <span className={`text-[10px] sm:text-xs px-2 py-1 rounded-full font-medium ${staffMember.role === 'admin'
                                  ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-600 border border-amber-500/30'
                                  : 'bg-gradient-to-r from-sky-500/20 to-blue-500/20 text-sky-600 border border-sky-500/30'
                                }`}>
                                {staffMember.role}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;

