import { useEffect, useState } from 'react';
import type React from 'react';
import { getDashboardStats, getCallsByDate } from '../services/api';
import { formatDateTime, formatDateKey, formatTime, groupCallsByLocalDate } from '../utils/timezone';
import {
  FiFileText,
  FiUsers,
  FiDollarSign,
  FiCheckCircle,
  FiPhone,
  FiCalendar,
  FiActivity,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import type { CalendarCall } from '../types';
import { Button } from './ui/button';

interface DashboardStats {
  total_invoices: number;
  total_patients: number;
  total_outstanding: number;
  total_amount_paid: number;
  links_sent: number;
  links_requested: number;
  calls_made: number;
  calls_completed: number;
  calls_pending: number;
  calls_failed: number;
  with_estimated_date: number;
  recent_calls: number;
  recent_uploads: number;
  total_files: number;
  aging_distribution: Array<{ bucket: string; count: number; total_amount: number }>;
  status_distribution: Array<{ status: string; count: number }>;
  recent_calls_list: Array<{
    patient_first_name: string;
    patient_last_name: string;
    phone_number: string;
    invoice_number: string;
    called_at: string | null;
    call_status: string;
    notes: string;
  }>;
  paid_patients: Array<{
    patient_first_name: string;
    patient_last_name: string;
    invoice_number: string;
    phone_number: string;
    amount_paid: number;
    payment_completed_at: string | null;
  }>;
}



const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];



export const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaidPatientsModal, setShowPaidPatientsModal] = useState(false);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<number | null>(() => new Date().getDate());
  const [selectedDateCalls, setSelectedDateCalls] = useState<CalendarCall[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [highlightedDates, setHighlightedDates] = useState<Set<string>>(new Set());

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  // Load calendar data for current month
  const loadCalendarData = async () => {
    try {
      const start = new Date(currentYear, currentMonth - 1, 1);
      const end = new Date(currentYear, currentMonth, 0);

      const response = await getCallsByDate(
        formatDateKey(start),
        formatDateKey(end)
      );

      const localCallsByDate = groupCallsByLocalDate(response.calls_by_date || {});
      setHighlightedDates(new Set(Object.keys(localCallsByDate)));
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    }
  };

  // Load calls for selected date
  const loadCallsForDate = async (date: number) => {
    setLoadingCalls(true);
    try {
      const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
      const prevDate = new Date(currentYear, currentMonth - 1, date - 1);
      const nextDate = new Date(currentYear, currentMonth - 1, date + 1);

      const response = await getCallsByDate(
        formatDateKey(prevDate),
        formatDateKey(nextDate)
      );

      const localCallsByDate = groupCallsByLocalDate(response.calls_by_date || {});
      setSelectedDateCalls(localCallsByDate[dateKey] || []);
    } catch (error) {
      console.error('Failed to load calls for date:', error);
      setSelectedDateCalls([]);
    } finally {
      setLoadingCalls(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadStats();
  }, []);

  // Load calendar data when month changes
  useEffect(() => {
    loadCalendarData();
  }, [currentMonth, currentYear]);

  // Load calls when date is selected
  useEffect(() => {
    if (selectedDate) {
      loadCallsForDate(selectedDate);
    }
  }, [selectedDate, currentMonth, currentYear]);

  // Expose refresh function
  useEffect(() => {
    const dashboardRefresh = () => {
      loadStats();
      loadCalendarData();
    };
    (window as { refreshDashboard?: () => void }).refreshDashboard = dashboardRefresh;
    return () => {
      delete (window as { refreshDashboard?: () => void }).refreshDashboard;
    };
  }, []);

  // Generate calendar grid
  const generateCalendarGrid = () => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth - 1, 0).getDate();

    const calendar: Array<{ date: number; isCurrentMonth: boolean; isToday: boolean; hasCalls: boolean }> = [];

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      calendar.push({
        date: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: false,
        hasCalls: false
      });
    }

    // Current month days
    const today = new Date();
    const isCurrentMonth = currentMonth === today.getMonth() + 1 && currentYear === today.getFullYear();

    for (let date = 1; date <= daysInMonth; date++) {
      const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
      calendar.push({
        date,
        isCurrentMonth: true,
        isToday: isCurrentMonth && date === today.getDate(),
        hasCalls: highlightedDates.has(dateKey)
      });
    }

    // Next month days to fill the grid
    const remainingCells = 42 - calendar.length;
    for (let date = 1; date <= remainingCells; date++) {
      calendar.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        hasCalls: false
      });
    }

    return calendar;
  };

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDate(null);
    setSelectedDateCalls([]);
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDate(null);
    setSelectedDateCalls([]);
  };

  const handleDateClick = (date: number, isCurrentMonth: boolean) => {
    if (isCurrentMonth) {
      setSelectedDate(date);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const capitalizeName = (name: string): string => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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

  if (!stats) {
    return (
      <div className="liquid-glass p-4 sm:p-6 md:p-8 rounded-xl border border-white/20 shadow-lg">
        <div className="text-center py-6 sm:py-8 md:py-12">
          <FiActivity className="w-12 h-12 mx-auto mb-4 text-foreground" />
          <p className="text-foreground">Unable to load dashboard statistics</p>
        </div>
      </div>
    );
  }

  const isEmpty = stats.total_invoices === 0 && stats.total_patients === 0;

  if (isEmpty) {
    return (
      <div className="liquid-glass p-4 sm:p-6 md:p-8 rounded-xl border border-white/20 shadow-lg">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 liquid-glass rounded-full flex items-center justify-center border border-white/30 shadow-md">
            <FiFileText className="w-8 h-8 text-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-foreground">No Data Available</h3>
          <p className="text-foreground mb-4">
            Upload a file to start tracking invoices and see analytics here.
          </p>
        </div>
      </div>
    );
  }

  const calendarGrid = generateCalendarGrid();

  // Define metric cards configuration
  interface MetricConfig {
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    value: number | string;
    gradient: string;
    border: string;
    onClick?: () => void;
    formatValue?: (val: number) => string;
    badges?: Array<{ label: string; value: number; color: string }>;
    subtitle?: string;
    useSmallerText?: boolean;
  }

  const primaryMetrics: MetricConfig[] = [
    {
      key: 'totalInvoices',
      label: 'Total Invoices',
      icon: FiFileText,
      value: stats.total_invoices,
      gradient: 'from-sky-500/20 via-sky-500/10 to-transparent',
      border: 'border-sky-500/50',
    },
    {
      key: 'totalPatients',
      label: 'Total Patients',
      icon: FiUsers,
      value: stats.total_patients,
      gradient: 'from-sky-500/20 via-sky-500/10 to-transparent',
      border: 'border-sky-500/50',
    },
    {
      key: 'outstanding',
      label: 'Total Outstanding',
      icon: FiDollarSign,
      value: stats.total_outstanding,
      gradient: 'from-red-500/20 via-red-500/10 to-transparent',
      border: 'border-red-500/50',
      formatValue: formatCurrency,
      useSmallerText: true,
    },
    {
      key: 'amountPaid',
      label: 'Total Amount Paid',
      icon: FiCheckCircle,
      value: stats.total_amount_paid || 0,
      gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
      border: 'border-emerald-500/50',
      formatValue: formatCurrency,
      onClick: () => setShowPaidPatientsModal(true),
      useSmallerText: true,
      subtitle: 'Click to view details',
    },
  ];

  const secondaryMetrics: MetricConfig[] = [
    {
      key: 'callsMade',
      label: 'Calls Made',
      icon: FiPhone,
      value: stats.calls_made,
      gradient: 'from-indigo-500/20 via-indigo-500/10 to-transparent',
      border: 'border-indigo-500/50',
    },
  ];

  // Render metric card component
  const renderMetricCard = (metric: MetricConfig) => {
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
        className={`relative overflow-hidden rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all duration-300 group ${metric.onClick ? 'cursor-pointer' : ''
          }
          bg-gradient-to-br ${metric.gradient}
          backdrop-blur-xl border-2 ${metric.border}
          shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)]
          hover:scale-[1.02] glass-shine`}
        onClick={metric.onClick}
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
          {metric.badges && metric.badges.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1 sm:mt-2">
              {metric.badges.map((badge, idx) => {
                const colorClasses = {
                  emerald: 'bg-emerald-500/20 text-foreground border-emerald-500/30',
                  yellow: 'bg-yellow-500/20 text-foreground border-yellow-500/30',
                  red: 'bg-red-500/20 text-foreground border-red-500/30',
                  blue: 'bg-blue-500/20 text-foreground border-blue-500/30',
                };
                return (
                  <span
                    key={idx}
                    className={`text-[9px] sm:text-[10px] md:text-xs px-1 sm:px-1.5 py-0.5 rounded backdrop-blur-sm border ${colorClasses[badge.color as keyof typeof colorClasses] || colorClasses.emerald}`}
                  >
                    {badge.label}: {badge.value}
                  </span>
                );
              })}
            </div>
          )}
          {metric.subtitle && (
            <p className="text-[10px] sm:text-xs text-foreground/70 mt-1 sm:mt-2">{metric.subtitle}</p>
          )}
        </div>
      </div>
    );
  };

  // Combine all metrics into one array
  const allMetrics = [...primaryMetrics, ...secondaryMetrics];

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 px-2 sm:px-4 md:px-0">
      {/* All Stats Cards in One Row */}
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
          {allMetrics.map(renderMetricCard)}
        </div>
      </div>

      {/* Invoice Calls Section - Table on LEFT, Calendar on RIGHT (like appointment-page.tsx) */}
      <div>
        <div className="mb-2 sm:mb-3">
          <h1 className="text-base sm:text-lg md:text-xl font-semibold text-foreground">
            Invoice Calls ({selectedDateCalls.length || 0})
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
          {/* Calls Table - LEFT side (order-2 on mobile, order-1 on desktop) */}
          <div className="order-2 lg:order-1 col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col">
            {selectedDate ? (
              <div className="flex-1 flex flex-col" key={selectedDate}>
                {loadingCalls ? (
                  <div className="flex items-center justify-center py-8 sm:py-10 md:py-12">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : selectedDateCalls.length > 0 ? (
                  <div className="relative bg-gradient-to-br from-[#9a8ea2]/80 to-[#b0a4b2]/60 backdrop-blur-xl rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border-[2px] sm:border-[3px] border-[#e8a855]/70 shadow-[0_0_30px_rgba(232,168,85,0.5),0_0_60px_rgba(232,168,85,0.2),0_8px_32px_rgba(150,130,160,0.25),inset_0_1px_0_rgba(255,255,255,0.4)] flex flex-col overflow-hidden glass-shine">
                    {/* Glossy Top Highlight */}
                    <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-white/25 via-white/10 to-transparent rounded-t-lg sm:rounded-t-xl pointer-events-none" />

                    <div className="overflow-hidden rounded-lg sm:rounded-xl flex-1 flex flex-col relative z-10">
                      {/* Fixed Header Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] sm:text-xs md:text-sm table-fixed min-w-[320px] sm:min-w-[400px]">
                          <colgroup>
                            <col className="w-[33%]" />
                            <col className="w-[34%]" />
                            <col className="w-[33%]" />
                          </colgroup>
                          <thead className="bg-[#9a8ea2]">
                            <tr>
                              <th className="text-left font-bold py-1 sm:py-1.5 md:py-2 lg:py-3 px-1 sm:px-1.5 md:px-2 lg:px-4 text-foreground text-[10px] sm:text-xs md:text-sm">Time</th>
                              <th className="text-left font-bold py-1 sm:py-1.5 md:py-2 lg:py-3 px-1 sm:px-1.5 md:px-2 lg:px-4 text-foreground text-[10px] sm:text-xs md:text-sm">Patient</th>
                              <th className="text-right font-bold py-1 sm:py-1.5 md:py-2 lg:py-3 px-1 sm:px-1.5 md:px-2 lg:px-4 text-foreground text-[10px] sm:text-xs md:text-sm">Outstanding</th>
                            </tr>
                          </thead>
                        </table>
                      </div>

                      {/* Scrollable Body Container */}
                      <div className="overflow-x-auto max-h-[30vh] sm:max-h-[40vh] md:max-h-[46vh] overflow-y-auto flex-1 bg-white/80 rounded-lg">
                        <table className="w-full text-[10px] sm:text-xs md:text-sm table-fixed min-w-[320px] sm:min-w-[400px]">
                          <colgroup>
                            <col className="w-[33%]" />
                            <col className="w-[34%]" />
                            <col className="w-[33%]" />
                          </colgroup>
                          <tbody className="divide-y divide-[#9a8ea2]/30">
                            {selectedDateCalls.map((call, index) => (
                              <tr key={index} className="bg-transparent hover:bg-white/10 transition-colors cursor-pointer">
                                <td className="py-1 sm:py-1.5 md:py-2 lg:py-3 px-1 sm:px-1.5 md:px-2 lg:px-4">
                                  <div className="flex items-center gap-1 md:gap-2">
                                    <span className="text-[10px] sm:text-xs md:text-sm text-foreground whitespace-nowrap">
                                      {formatTime(call.called_at)}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-1 sm:py-1.5 md:py-2 lg:py-3 px-1 sm:px-1.5 md:px-2 lg:px-4">
                                  <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-foreground break-words">
                                    {`${call.patient_first_name || ''} ${call.patient_last_name || ''}`.trim() ? capitalizeName(`${call.patient_first_name || ''} ${call.patient_last_name || ''}`.trim()) : 'Unknown'}
                                  </span>
                                </td>
                                <td className="py-1 sm:py-1.5 md:py-2 lg:py-3 px-1 sm:px-1.5 md:px-2 lg:px-4 text-right">
                                  <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-foreground">
                                    {formatCurrency(call.outstanding_amount)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="liquid-glass rounded-xl p-4 sm:p-6 md:p-8 border-0 flex flex-col items-center justify-center text-center">
                    <div className="text-foreground">
                      <FiCalendar className="w-12 h-12 mb-4" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      No Calls Scheduled
                    </h3>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="liquid-glass rounded-xl p-4 sm:p-6 md:p-8 border-0 flex flex-col items-center justify-center text-center">
                  <div>
                    <FiCalendar className="w-16 h-16 mb-4" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Select a Date
                  </h3>
                  <p className="text-sm">
                    Choose a date from the calendar to view and manage invoice calls for that day.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Calendar Component */}
          <div className="order-1 lg:order-2 col-span-12 lg:col-span-5 xl:col-span-4 w-full max-w-full sm:max-w-md lg:max-w-none mx-auto lg:mx-0">
            {/* Calendar Content */}
            <div className="relative p-2 sm:p-3 md:p-4 items-center justify-center bg-gradient-to-br from-[#d7d7f3]/80 to-[#e5e5f8]/60 backdrop-blur-xl rounded-lg sm:rounded-xl border-2 border-[#b8a0d4]/50 shadow-[0_0_20px_rgba(184,160,212,0.3),0_8px_32px_rgba(200,200,240,0.25),inset_0_1px_0_rgba(255,255,255,0.4)] overflow-hidden w-full min-h-[280px] sm:min-h-[300px] md:min-h-[320px] flex flex-col glass-shine">
              {/* Glossy Top Highlight */}
              <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-white/30 via-white/10 to-transparent rounded-t-xl pointer-events-none" />
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 px-2 sm:px-4 md:px-6 w-full justify-center">
                <div>
                  <Button
                    onClick={handlePrevMonth}
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 p-0 bg-white/50 border-gray-300 hover:bg-white/80"
                  >
                    <FiChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 text-foreground" />
                  </Button>
                </div>
                <h1
                  key={`${currentMonth}-${currentYear}`}
                  className="text-xs sm:text-sm md:text-base font-semibold flex-1 text-center text-foreground px-2"
                >
                  {months[currentMonth - 1]} {currentYear}
                </h1>
                <div>
                  <Button
                    onClick={handleNextMonth}
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 p-0 bg-white/50 border-gray-300 hover:bg-white/80"
                  >
                    <FiChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-foreground" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 flex flex-col w-full">
                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2 px-1 sm:px-2 md:px-3 w-full">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div
                      key={day}
                      className="text-center text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-medium text-foreground px-0.5 py-1 sm:py-1.5 rounded min-w-0"
                    >
                      <span className="hidden sm:inline">{day}</span>
                      <span className="sm:hidden">{day.charAt(0)}</span>
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div
                  key={`${currentMonth}-${currentYear}`}
                  className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2 p-1 sm:p-2 md:p-3 flex-1 w-full auto-rows-fr"
                >
                  {calendarGrid.map((day, index) => {
                    return (
                      <div
                        key={index}
                        onClick={() => day.isCurrentMonth ? handleDateClick(day.date, day.isCurrentMonth) : undefined}
                        className={`
                          calendar-cell relative rounded-lg cursor-pointer
                          w-full min-h-0 flex flex-col justify-center items-center transition-all duration-300
                          ${day.isCurrentMonth
                            ? selectedDate === day.date
                              ? 'bg-[#5a8ac7] text-foreground shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] ring-2 ring-[#5a8ac7] z-10'
                              : day.isToday
                                ? 'bg-white ring-2 ring-[#5a8ac7] text-foreground'
                                : day.hasCalls
                                  ? 'bg-white hover:scale-105 text-foreground shadow-sm'
                                  : 'bg-white/90 hover:bg-white text-foreground'
                            : 'bg-white/40 opacity-40 cursor-not-allowed text-foreground'
                          }
                        `}
                        style={{ aspectRatio: '1' }}
                      >
                        <div
                          className={`
                            font-semibold text-center leading-tight transition-all duration-300
                            ${day.isCurrentMonth && selectedDate === day.date
                              ? 'text-foreground text-xs sm:text-sm md:text-base'
                              : 'text-foreground text-[10px] sm:text-xs md:text-sm'}
                          `}
                        >
                          {day.date}
                        </div>

                        {/* Show call count badge */}
                        {day.hasCalls && day.isCurrentMonth && (
                          <div className="-mt-0.5 sm:-mt-1">
                            <div
                              className={`appointment-badge inline-flex items-center justify-center text-[6px] sm:text-[7px] md:text-[8px] lg:text-[9px] font-medium rounded-full px-0.5 sm:px-1 ${selectedDate === day.date
                                ? 'bg-white/40 text-foreground border border-white/50'
                                : 'bg-[#5a8ac7]/20 text-foreground border border-[#5a8ac7]/40'
                                }`}
                            >
                              1
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Calls Section - Same style as Invoice Calls Calendar table */}
      {stats.recent_calls_list && stats.recent_calls_list.length > 0 && (
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-foreground">Recent Calls History</h3>
            <span className="text-xs sm:text-sm text-foreground">
              {stats.recent_calls_list.length} call{stats.recent_calls_list.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="relative bg-gradient-to-br from-[#9a8ea2]/80 to-[#b0a4b2]/60 backdrop-blur-xl rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border-[2px] sm:border-[3px] border-[#e8a855]/70 shadow-[0_0_30px_rgba(232,168,85,0.5),0_0_60px_rgba(232,168,85,0.2),0_8px_32px_rgba(150,130,160,0.25),inset_0_1px_0_rgba(255,255,255,0.4)] flex flex-col overflow-hidden glass-shine">
            {/* Glossy Top Highlight */}
            <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-white/25 via-white/10 to-transparent rounded-t-lg sm:rounded-t-xl pointer-events-none" />

            <div className="overflow-hidden rounded-lg sm:rounded-xl flex-1 flex flex-col relative z-10">
              {/* Fixed Header Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] sm:text-xs md:text-sm table-fixed min-w-[320px] sm:min-w-[400px] md:min-w-[500px]">
                  <colgroup>
                    <col className="w-[40%] md:w-[30%]" />
                    <col className="w-[30%] md:w-[25%]" />
                    <col className="w-[0%] md:w-[25%]" />
                    <col className="w-[30%] md:w-[20%]" />
                  </colgroup>
                  <thead className="bg-[#9a8ea2]">
                    <tr>
                      <th className="text-left font-bold py-1 sm:py-1.5 md:py-2 lg:py-3 px-1 sm:px-1.5 md:px-2 lg:px-4 text-foreground text-[10px] sm:text-xs md:text-sm">Patient</th>
                      <th className="text-left font-bold py-1 sm:py-1.5 md:py-2 lg:py-3 px-1 sm:px-1.5 md:px-2 lg:px-4 text-foreground text-[10px] sm:text-xs md:text-sm">Phone</th>
                      <th className="text-left font-bold py-1 sm:py-1.5 md:py-2 lg:py-3 px-1 sm:px-1.5 md:px-2 lg:px-4 text-foreground text-[10px] sm:text-xs md:text-sm hidden md:table-cell">Called At</th>
                      <th className="text-left font-bold py-1 sm:py-1.5 md:py-2 lg:py-3 px-1 sm:px-1.5 md:px-2 lg:px-4 text-foreground text-[10px] sm:text-xs md:text-sm">Status</th>
                    </tr>
                  </thead>
                </table>
              </div>

              {/* Scrollable Body Container */}
              <div className="overflow-x-auto max-h-[200px] sm:max-h-[300px] md:max-h-[50vh] overflow-y-auto flex-1 bg-white/80 rounded-lg">
                <table className="w-full text-[10px] sm:text-xs md:text-sm table-fixed min-w-[320px] sm:min-w-[400px] md:min-w-[500px]">
                  <colgroup>
                    <col className="w-[40%] md:w-[30%]" />
                    <col className="w-[30%] md:w-[25%]" />
                    <col className="w-[0%] md:w-[25%]" />
                    <col className="w-[30%] md:w-[20%]" />
                  </colgroup>
                  <tbody className="divide-y divide-[#9a8ea2]/30">
                    {stats.recent_calls_list.map((call, index) => (
                      <tr key={index} className="bg-transparent hover:bg-white/10 transition-all duration-200">
                        <td className="py-1 sm:py-1.5 md:py-2 lg:py-3 px-1 sm:px-1.5 md:px-2 lg:px-4">
                          <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-foreground break-words">
                            {`${call.patient_first_name || ''} ${call.patient_last_name || ''}`.trim() ? capitalizeName(`${call.patient_first_name || ''} ${call.patient_last_name || ''}`.trim()) : 'Unknown'}
                          </span>
                        </td>
                        <td className="py-1 sm:py-1.5 md:py-2 lg:py-3 px-1 sm:px-1.5 md:px-2 lg:px-4">
                          <span className="text-[10px] sm:text-xs md:text-sm text-foreground break-all">{call.phone_number}</span>
                        </td>
                        <td className="py-1 sm:py-1.5 md:py-2 lg:py-3 px-1 sm:px-1.5 md:px-2 lg:px-4 hidden md:table-cell">
                          <span className="text-[10px] sm:text-xs md:text-sm text-foreground">{formatDateTime(call.called_at)}</span>
                        </td>
                        <td className="py-1 sm:py-1.5 md:py-2 lg:py-3 px-1 sm:px-1.5 md:px-2 lg:px-4">
                          <span className={`px-1.5 sm:px-2 md:px-3 py-0.5 rounded-full text-[8px] sm:text-[10px] md:text-xs font-bold border text-foreground ${call.call_status === 'completed'
                            ? 'bg-green-500/20 border-green-500/50'
                            : call.call_status === 'failed'
                              ? 'bg-red-500/20 border-red-500/50'
                              : 'bg-yellow-500/20 border-yellow-500/50'
                            }`}>
                            {call.call_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paid Patients Modal */}
      {showPaidPatientsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200" onClick={() => setShowPaidPatientsModal(false)}>
          <div className="liquid-glass-strong max-w-full sm:max-w-2xl w-full max-h-[90vh] sm:max-h-[80vh] overflow-hidden flex flex-col rounded-lg sm:rounded-2xl border border-white/30 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 md:px-6 py-3 sm:py-4 border-b border-white/20 flex-shrink-0">
              <h2 className="text-lg font-semibold text-foreground">Paid Patients</h2>
              <Button
                onClick={() => setShowPaidPatientsModal(false)}
                className="liquid-glass-btn-primary"
              >
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {stats.paid_patients && stats.paid_patients.length > 0 ? (
                <div className="space-y-2 sm:space-y-3">
                  {stats.paid_patients.map((patient, i) => (
                    <div key={i} className="p-3 sm:p-4 liquid-glass rounded-lg sm:rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 border border-white/20 hover:border-white/30 transition-all">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base text-foreground break-words">{`${patient.patient_first_name || ''} ${patient.patient_last_name || ''}`.trim() ? capitalizeName(`${patient.patient_first_name || ''} ${patient.patient_last_name || ''}`.trim()) : 'Unknown'}</p>
                        <p className="text-xs sm:text-sm text-foreground break-words">Invoice: {patient.invoice_number}</p>
                        {patient.payment_completed_at && (
                          <p className="text-[10px] sm:text-xs text-foreground">{formatDateTime(patient.payment_completed_at)}</p>
                        )}
                      </div>
                      <div className="text-base sm:text-lg font-bold text-foreground whitespace-nowrap">{formatCurrency(patient.amount_paid)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <FiCheckCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-foreground" />
                  <p className="text-sm sm:text-base text-foreground">No paid patients yet</p>
                </div>
              )}
            </div>
            <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-white/20 liquid-glass-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="text-foreground">{stats.paid_patients?.length || 0} payments</span>
              <span className="font-bold text-foreground">{formatCurrency(stats.total_amount_paid || 0)}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
