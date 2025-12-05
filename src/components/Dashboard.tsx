import { useEffect, useState, useRef } from 'react';
import { getDashboardStats, getPatientsByAgingBucket } from '../services/api';
import { CalendarView } from './CalendarView';
import { formatDateTime } from '../utils/timezone';
import { FiChevronDown, FiCheck, FiX } from 'react-icons/fi';
import type { Patient } from '../types';

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

export const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaidPatientsModal, setShowPaidPatientsModal] = useState(false);
  const [selectedAgingBucket, setSelectedAgingBucket] = useState<string | null>(null);
  const [isAgingDropdownOpen, setIsAgingDropdownOpen] = useState(false);
  const agingDropdownRef = useRef<HTMLDivElement>(null);
  const [showAgingBucketModal, setShowAgingBucketModal] = useState(false);
  const [agingBucketPatients, setAgingBucketPatients] = useState<Patient[]>([]);
  const [loadingAgingPatients, setLoadingAgingPatients] = useState(false);

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

  // Initial load only - no auto-refresh
  useEffect(() => {
    loadStats();
  }, []);

  // Handle click outside to close aging bucket dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (agingDropdownRef.current && !agingDropdownRef.current.contains(event.target as Node)) {
        setIsAgingDropdownOpen(false);
      }
    };

    if (isAgingDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isAgingDropdownOpen]);


  // Expose refresh function so parent can trigger manual refresh
  useEffect(() => {
    const dashboardRefresh = () => {
      loadStats();
    };
    (window as { refreshDashboard?: () => void }).refreshDashboard = dashboardRefresh;
    return () => {
      delete (window as { refreshDashboard?: () => void }).refreshDashboard;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">Unable to load dashboard statistics</p>
        </div>
      </div>
    );
  }

  // Check if database is empty or table doesn't exist
  const isEmpty = stats.total_invoices === 0 && stats.total_patients === 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Normalize aging buckets by grouping case-insensitively and handling dash variations
  const normalizeAgingBuckets = (buckets: Array<{ bucket: string; count: number; total_amount: number }>) => {
    const normalizedMap = new Map<string, { bucket: string; count: number; total_amount: number; originalBucket?: string }>();
    
    buckets.forEach(item => {
      // Normalize: lowercase, replace en-dash/em-dash with hyphen, trim
      const normalizeKey = (bucket: string): string => {
        if (!bucket) return 'unknown';
        // Replace en-dash (U+2013) and em-dash (U+2014) with regular hyphen
        return bucket.replace(/\u2013/g, '-').replace(/\u2014/g, '-').toLowerCase().trim();
      };
      
      const normalizedKey = normalizeKey(item.bucket);
      const existing = normalizedMap.get(normalizedKey);
      
      if (existing) {
        // Merge: combine counts and amounts
        existing.count += item.count;
        existing.total_amount += item.total_amount;
      } else {
        // First occurrence: use normalized format for consistency
        // Capitalize "Days" for better display
        let displayName = normalizeKey(item.bucket);
        if (displayName.includes('days')) {
          displayName = displayName.replace('days', 'Days');
        }
        normalizedMap.set(normalizedKey, {
          bucket: displayName,
          count: item.count,
          total_amount: item.total_amount,
          originalBucket: item.bucket // Keep original for API calls
        });
      }
    });
    
    return Array.from(normalizedMap.values());
  };

  // Sort aging buckets by numeric order (extract numbers from bucket names)
  const sortAgingBuckets = (buckets: Array<{ bucket: string; count: number; total_amount: number }>) => {
    const sorted = [...buckets];
    
    sorted.sort((a, b) => {
      // Extract first number from bucket name (e.g., "0-30 Days" -> 0, "31-60 Days" -> 31)
      const extractFirstNumber = (bucket: string): number => {
        const match = bucket.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 9999; // Put non-numeric buckets at the end
      };
      
      const numA = extractFirstNumber(a.bucket);
      const numB = extractFirstNumber(b.bucket);
      
      if (numA !== numB) {
        return numA - numB;
      }
      
      // If same starting number, sort alphabetically
      return a.bucket.localeCompare(b.bucket);
    });
    
    return sorted;
  };

  // Show empty state if no data
  if (isEmpty) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-500 mb-4">
            Upload a file (CSV, Excel, or PDF) to start tracking invoices and see analytics here.
          </p>
          <p className="text-sm text-gray-400">
            Make sure your database is properly configured and tables are created.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* All Stats Grid - 9 cards in 2 rows (4 in first row, 5 in second row, equally distributed) */}
      <div 
        className="grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(20, 1fr)'
        }}
      >
        {/* Total Invoices */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 col-span-1 md:col-span-10 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Invoices</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_invoices}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Patients */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 col-span-1 md:col-span-10 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Patients</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_patients}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 col-span-1 md:col-span-10 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Outstanding</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(stats.total_outstanding)}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Amount Paid */}
        <div 
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow col-span-1 md:col-span-10 lg:col-span-5"
          onClick={() => setShowPaidPatientsModal(true)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Amount Paid</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(stats.total_amount_paid || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.paid_patients && stats.paid_patients.length > 0 
                  ? `${stats.paid_patients.length} payment${stats.paid_patients.length !== 1 ? 's' : ''} • Click to view` 
                  : 'Click to view details'}
              </p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-full">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Calls Made */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 col-span-1 md:col-span-8 lg:col-span-4">
          <p className="text-sm text-gray-500 font-medium">Calls Made</p>
          <p className="text-2xl font-bold text-teal-600 mt-2">{stats.calls_made}</p>
          <div className="mt-3 flex gap-2 text-xs flex-wrap">
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">Completed: {stats.calls_completed}</span>
            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">Pending: {stats.calls_pending}</span>
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded">Failed: {stats.calls_failed}</span>
          </div>
        </div>

        {/* Links Sent */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 col-span-1 md:col-span-8 lg:col-span-4">
          <p className="text-sm text-gray-500 font-medium">Payment Links Sent</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">{stats.links_sent}</p>
          <p className="text-xs text-gray-500 mt-2">Requested: {stats.links_requested}</p>
        </div>

        {/* With Estimated Date */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 col-span-1 md:col-span-8 lg:col-span-4">
          <p className="text-sm text-gray-500 font-medium">With Payment Date</p>
          <p className="text-2xl font-bold text-indigo-600 mt-2">{stats.with_estimated_date}</p>
          <p className="text-xs text-gray-500 mt-2">Out of {stats.total_invoices} invoices</p>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 col-span-1 md:col-span-8 lg:col-span-4">
          <p className="text-sm text-gray-500 font-medium">Recent Activity (7 days)</p>
          <p className="text-2xl font-bold text-purple-600 mt-2">{stats.recent_calls}</p>
          <p className="text-xs text-gray-500 mt-2">Calls | {stats.recent_uploads} new uploads</p>
        </div>

        {/* Files Uploaded */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 col-span-1 md:col-span-8 lg:col-span-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Files Uploaded</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_files}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar and Outstanding by Aging Bucket Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar Section */}
        <CalendarView />

        {/* Outstanding by Aging Bucket */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Outstanding by Aging Bucket</h3>
          </div>
          
          {stats.aging_distribution.length > 0 ? (
            <>
              {/* Dropdown Selector */}
              <div className="relative mb-4" ref={agingDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsAgingDropdownOpen(!isAgingDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                >
                  <span>
                    {selectedAgingBucket 
                      ? sortAgingBuckets(normalizeAgingBuckets(stats.aging_distribution)).find(b => b.bucket === selectedAgingBucket)?.bucket || 'Select aging bucket'
                      : 'All Aging Buckets'}
                  </span>
                  <FiChevronDown 
                    className={`ml-2 h-5 w-5 text-gray-500 flex-shrink-0 transition-transform duration-200 ${
                      isAgingDropdownOpen ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>

                {isAgingDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-xl border border-gray-200 py-2 max-h-64 overflow-y-auto">
                    {/* All option */}
                    <button
                      onClick={() => {
                        setSelectedAgingBucket(null);
                        setIsAgingDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                        selectedAgingBucket === null
                          ? 'bg-teal-50 text-teal-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>All Aging Buckets</span>
                      {selectedAgingBucket === null && (
                        <FiCheck className="h-5 w-5 text-teal-600" />
                      )}
                    </button>
                    
                    {/* Individual bucket options */}
                    {sortAgingBuckets(normalizeAgingBuckets(stats.aging_distribution)).map((item, index) => {
                      // Use the bucket name as-is for API call (backend will normalize it)
                      const bucketForApi = item.bucket;
                      
                      return (
                        <button
                          key={index}
                          onClick={async () => {
                            setSelectedAgingBucket(item.bucket);
                            setIsAgingDropdownOpen(false);
                            // Fetch and show invoices for this bucket
                            setLoadingAgingPatients(true);
                            setShowAgingBucketModal(true);
                            try {
                              console.log('Fetching patients for aging bucket:', bucketForApi);
                              const result = await getPatientsByAgingBucket(bucketForApi);
                              console.log('Received patients:', result);
                              setAgingBucketPatients(result.patients || []);
                            } catch (error) {
                              console.error('Failed to load patients by aging bucket:', error);
                              setAgingBucketPatients([]);
                            } finally {
                              setLoadingAgingPatients(false);
                            }
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                            selectedAgingBucket === item.bucket
                              ? 'bg-teal-50 text-teal-700 font-semibold'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>{item.bucket} ({item.count} invoices - {formatCurrency(item.total_amount)})</span>
                          {selectedAgingBucket === item.bucket && (
                            <FiCheck className="h-5 w-5 text-teal-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Display selected bucket or all buckets */}
              <div className="space-y-3">
                {selectedAgingBucket ? (
                  // Show only selected bucket
                  (() => {
                    const selectedItem = sortAgingBuckets(normalizeAgingBuckets(stats.aging_distribution)).find(
                      item => item.bucket === selectedAgingBucket
                    );
                    return selectedItem ? (
                      <div className="flex items-center justify-between p-4 bg-teal-50 rounded-lg border border-teal-200">
                        <span className="text-sm font-semibold text-gray-900">{selectedItem.bucket}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">{selectedItem.count} invoices</span>
                          <span className="text-lg font-bold text-teal-700">{formatCurrency(selectedItem.total_amount)}</span>
                        </div>
                      </div>
                    ) : null;
                  })()
                ) : (
                  // Show all buckets (sorted)
                  sortAgingBuckets(normalizeAgingBuckets(stats.aging_distribution)).map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{item.bucket}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">{item.count} invoices</span>
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.total_amount)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No data available</p>
          )}
        </div>
      </div>

      {/* Recent Calls Section - Below Calendar */}
      {stats.recent_calls_list && stats.recent_calls_list.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Calls</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {stats.recent_calls_list.slice(0, 9).map((call, index) => {
              // Filter out "value_or_empty" and show N/A instead
              const invoiceNumber = call.invoice_number && call.invoice_number !== 'value_or_empty' 
                ? call.invoice_number 
                : 'N/A';
              
              return (
                <div key={index} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{`${call.patient_first_name || ''} ${call.patient_last_name || ''}`.trim() || 'Unknown'}</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                        call.call_status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : call.call_status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {call.call_status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1 truncate">Invoice: {invoiceNumber}</p>
                    <p className="text-xs text-gray-600 mb-1 truncate">Phone: {call.phone_number}</p>
                    {call.notes && (
                      <p className="text-xs text-gray-500 italic mt-1 whitespace-pre-wrap break-words">{call.notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatDateTime(call.called_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Paid Patients Modal */}
      {showPaidPatientsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowPaidPatientsModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Paid Patients</h2>
              <button
                onClick={() => setShowPaidPatientsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              {stats.paid_patients && stats.paid_patients.length > 0 ? (
                <div className="space-y-3">
                  {stats.paid_patients.map((patient, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{`${patient.patient_first_name || ''} ${patient.patient_last_name || ''}`.trim() || 'Unknown'}</p>
                        <p className="text-xs text-gray-600 mt-1">Invoice: {patient.invoice_number}</p>
                        {patient.phone_number && (
                          <p className="text-xs text-gray-600 mt-1">Phone: {patient.phone_number}</p>
                        )}
                        {patient.payment_completed_at && (
                          <p className="text-xs text-gray-500 mt-1">Paid on: {formatDateTime(patient.payment_completed_at)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-700">{formatCurrency(patient.amount_paid)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
                    <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-lg font-medium mb-2">No paid patients yet</p>
                  <p className="text-gray-400 text-sm">Payments will appear here once patients complete their payments</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <p className="text-sm text-gray-600">
                    Total Records: <span className="font-semibold text-gray-900">{stats.paid_patients?.length || 0} payment{stats.paid_patients?.length !== 1 ? 's' : ''}</span>
                  </p>
                  {stats.paid_patients && stats.paid_patients.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Unique Patients: <span className="font-semibold text-gray-700">
                        {(() => {
                          const paidPatients = stats.paid_patients as DashboardStats['paid_patients'];
                          return new Set(paidPatients.map((p) => {
                            const fullName = `${p.patient_first_name || ''} ${p.patient_last_name || ''}`.trim() || 'Unknown';
                            return `${fullName}-${p.invoice_number}`;
                          })).size;
                        })()}
                      </span>
                    </p>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  Total Amount: <span className="font-semibold text-emerald-700">{formatCurrency(stats.total_amount_paid || 0)}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aging Bucket Invoices Modal */}
      {showAgingBucketModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAgingBucketModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Invoices - {selectedAgingBucket || 'Aging Bucket'}
              </h2>
              <button
                onClick={() => setShowAgingBucketModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              {loadingAgingPatients ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                </div>
              ) : agingBucketPatients.length > 0 ? (
                <div className="space-y-3">
                  {[...agingBucketPatients]
                    .sort((a, b) => {
                      const amountA = parseFloat(a.outstanding_amount || '0');
                      const amountB = parseFloat(b.outstanding_amount || '0');
                      return amountB - amountA; // Sort highest to lowest
                    })
                    .map((patient, index) => {
                    // Helper function to clean MISSING values and format display
                    const cleanValue = (value: string | undefined): string => {
                      if (!value) return '';
                      const val = String(value);
                      if (val.startsWith('MISSING_') || val.toLowerCase() === 'nan') return '';
                      return val;
                    };
                    
                    const firstName = cleanValue(patient.patient_first_name);
                    const lastName = cleanValue(patient.patient_last_name);
                    const fullName = `${firstName} ${lastName}`.trim() || 'Unknown Patient';
                    const invoiceNum = cleanValue(patient.invoice_number) || 'N/A';
                    const phoneNum = cleanValue(patient.phone_number);
                    const dob = cleanValue(patient.patient_dob);
                    
                    return (
                      <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {fullName}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">Invoice: {invoiceNum}</p>
                          {dob && (
                            <p className="text-xs text-gray-600 mt-1">DOB: {dob}</p>
                          )}
                          {phoneNum && (
                            <p className="text-xs text-gray-600 mt-1">Phone: {phoneNum}</p>
                          )}
                          {patient.invoice_date && (
                            <p className="text-xs text-gray-500 mt-1">Date: {patient.invoice_date}</p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-lg font-bold text-red-600">{formatCurrency(parseFloat(patient.outstanding_amount || '0'))}</p>
                          <p className="text-xs text-gray-500 mt-1">Outstanding</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
                    <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-lg font-medium mb-2">No invoices found</p>
                  <p className="text-gray-400 text-sm">No invoices found for this aging bucket</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Total Invoices: <span className="font-semibold text-gray-900">{agingBucketPatients.length}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Total Outstanding: <span className="font-semibold text-red-700">
                    {formatCurrency(
                      agingBucketPatients.reduce((sum, p) => sum + parseFloat(p.outstanding_amount || '0'), 0)
                    )}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
