import type { Patient } from '../types';
import { FiEye, FiPhone } from 'react-icons/fi';

interface PatientTableProps {
  patients: Patient[];
  loading: boolean;
  onViewNotes: (patient: Patient) => void;
  onCallPatient?: (patient: Patient) => void;
  onViewCallHistory?: (patient: Patient) => void;
  onViewDetails?: (patient: Patient) => void;
  activeCalls?: Map<string, number>;
}

export const PatientTable = ({ patients, loading, onViewNotes, onCallPatient, onViewCallHistory, onViewDetails, activeCalls = new Map() }: PatientTableProps) => {
  // Helper function to create unique key for each patient record (same as in InvoiceList)
  const getPatientCallKey = (patient: Patient): string => {
    const phone = patient.phone_number || '';
    const invoice = patient.invoice_number || '';
    const firstName = patient.patient_first_name || '';
    const lastName = patient.patient_last_name || '';
    return `${phone}|${invoice}|${firstName}|${lastName}`;
  };

  // Check if call is currently active (only for the first 5 minutes after initiation)
  // This allows users to call again after the call completes
  // Also checks patient's call_status to avoid showing "Calling..." for completed/failed calls
  const isCallActive = (patient: Patient): boolean => {
    // If call is already completed or failed, don't show "Calling..."
    if (patient.call_status === 'completed' || patient.call_status === 'failed') {
      return false;
    }
    
    const callKey = getPatientCallKey(patient);
    if (!callKey || !activeCalls.has(callKey)) return false;
    
    const timestamp = activeCalls.get(callKey)!;
    const now = Date.now();
    // Consider call active only if initiated within last 5 minutes
    // After that, allow calling again (call likely completed)
    return (now - timestamp) < 5 * 60 * 1000;
  };

  // Check if invoice is paid (payment_status is completed)
  const isPaid = (patient: Patient): boolean => {
    return patient.payment_status === 'completed' && parseFloat(patient.amount_paid || '0') > 0;
  };

  // Check if patient has outstanding balance
  const hasOutstandingBalance = (patient: Patient): boolean => {
    if (isPaid(patient)) return false;
    const outstanding = parseFloat(patient.outstanding_amount?.toString() || '0');
    return outstanding > 0;
  };

  const formatCurrency = (amount: string | number): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(numAmount);
  };

  // Helper function to get full name
  const getFullName = (patient: Patient): string => {
    const first = patient.patient_first_name || '';
    const last = patient.patient_last_name || '';
    return `${first} ${last}`.trim() || 'Unknown';
  };

  // Check if patient has missing data
  const hasMissingData = (patient: Patient): boolean => {
    const phone = patient.phone_number && patient.phone_number.toLowerCase() !== 'nan' && patient.phone_number.length >= 10;
    const invoice = patient.invoice_number && patient.invoice_number.toLowerCase() !== 'nan' && patient.invoice_number !== '';
    const firstName = patient.patient_first_name && patient.patient_first_name.toLowerCase() !== 'nan' && patient.patient_first_name !== '';
    const lastName = patient.patient_last_name && patient.patient_last_name.toLowerCase() !== 'nan' && patient.patient_last_name !== '';
    return !phone || !invoice || !firstName || !lastName;
  };

  // Separate patients into complete and missing records
  const completePatients = patients.filter(p => !hasMissingData(p));
  const missingPatients = patients.filter(p => hasMissingData(p));

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-600 font-medium text-lg">
        Loading patient data...
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-teal-50 rounded-2xl border border-teal-200 backdrop-blur-sm p-16 text-center">
        <p className="text-teal-900 text-xl font-medium mb-2">No patient data available</p>
        <p className="text-teal-700">Upload a CSV, XLSX, or XLS file to get started</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b-2 border-teal-700">
            <tr>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Patient Name</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Phone Number</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Invoice #</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Invoice Date</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Invoice amount</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Outstanding balance</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Aging</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700 min-w-[200px]">Coverage Notes</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Link Requested</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Link Sent</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Est. Date</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Call Status</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Calls</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700 min-w-[200px]">Recent Call Notes</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Payment Status</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Complete Records */}
            {completePatients.map((patient, index) => (
              <tr key={`complete-${index}`} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 text-sm text-gray-900">
                  {getFullName(patient) !== 'Unknown' ? (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onViewDetails) {
                          onViewDetails(patient);
                        }
                      }}
                      className="text-teal-600 hover:text-teal-800 hover:underline font-medium transition-colors cursor-pointer"
                      title={`Click to view full details for ${getFullName(patient)}`}
                    >
                      {getFullName(patient)}
                    </button>
                  ) : (
                    <span className="text-red-500 italic" title="Patient name is missing">Missing</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900 font-medium">
                  {patient.phone_number && patient.phone_number.toLowerCase() !== 'nan' && patient.phone_number.length >= 10 ? (
                    patient.phone_number
                  ) : (
                    <span className="text-red-500 italic font-semibold" title="Phone number is missing or invalid - cannot make calls without a valid phone number">
                      Missing Phone
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-700 font-mono">
                  {patient.invoice_number && patient.invoice_number.toLowerCase() !== 'nan' ? (
                    patient.invoice_number
                  ) : (
                    <span className="text-red-500 italic" title="Invoice number is missing - required for identification">Missing</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  {patient.invoice_date ? (
                    new Date(patient.invoice_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900 font-semibold">{patient.price}</td>
                <td className="px-4 py-4 text-sm">
                  {isPaid(patient) ? (
                    <div className="flex flex-col">
                      <span className="text-emerald-600 font-bold">Paid</span>
                      <span className="text-xs text-gray-600 mt-1">
                        Amount: {formatCurrency(patient.amount_paid || '0')}
                      </span>
                    </div>
                  ) : patient.outstanding_amount && patient.outstanding_amount !== '' ? (
                    <span className="text-red-600 font-bold">{patient.outstanding_amount}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">{patient.aging_bucket}</td>
                <td className="px-4 py-4 text-sm min-w-[200px] max-w-md">
                  {patient.coverage_notes && patient.coverage_notes.trim() ? (
                    <div className="group relative">
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                        {patient.coverage_notes}
                      </p>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  {patient.link_requested ? (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium">{patient.link_requested}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  {patient.link_sent ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium">{patient.link_sent}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  {patient.estimated_date ? (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-md text-xs font-medium">{patient.estimated_date}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  {patient.call_status ? (
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      patient.call_status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : patient.call_status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {patient.call_status.charAt(0).toUpperCase() + patient.call_status.slice(1)}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onViewCallHistory) {
                        onViewCallHistory(patient);
                      }
                    }}
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
                    title={`Click to view call history for ${getFullName(patient)} - Invoice ${patient.invoice_number}`}
                  >
                    {patient.call_count || 0}
                  </button>
                </td>
                <td className="px-4 py-4 text-sm min-w-[200px] max-w-md">
                  {patient.recent_call_notes && patient.recent_call_notes.trim() ? (
                    <div className="group relative">
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                        {patient.recent_call_notes}
                      </p>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">No notes</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  {patient.payment_status ? (
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      patient.payment_status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : patient.payment_status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : patient.payment_status === 'refunded'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {patient.payment_status.charAt(0).toUpperCase() + patient.payment_status.slice(1)}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    {hasOutstandingBalance(patient) && onCallPatient && (
                      !patient.phone_number || patient.phone_number.toLowerCase() === 'nan' || patient.phone_number.length < 10 ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-500 rounded-lg text-xs font-semibold cursor-not-allowed bg-red-50"
                          title="Phone number is missing or invalid - cannot make call without a valid phone number (minimum 10 digits)"
                        >
                          <FiPhone size={14} />
                          Missing Phone
                        </button>
                      ) : !patient.invoice_number || patient.invoice_number.toLowerCase() === 'nan' ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-500 rounded-lg text-xs font-semibold cursor-not-allowed bg-red-50"
                          title="Invoice number is missing - cannot make call without invoice number for identification"
                        >
                          <FiPhone size={14} />
                          Missing Invoice
                        </button>
                      ) : !patient.patient_first_name || !patient.patient_last_name || patient.patient_first_name.toLowerCase() === 'nan' || patient.patient_last_name.toLowerCase() === 'nan' ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-500 rounded-lg text-xs font-semibold cursor-not-allowed bg-red-50"
                          title="Patient name is missing - cannot make call without patient name for identification"
                        >
                          <FiPhone size={14} />
                          Missing Name
                        </button>
                      ) : isCallActive(patient) ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-400 rounded-lg text-xs font-semibold cursor-not-allowed"
                          title="Call in progress..."
                        >
                          <FiPhone size={14} />
                          Calling...
                        </button>
                      ) : (
                        <button
                          onClick={() => onCallPatient(patient)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-teal-600 text-teal-600 rounded-lg text-xs font-semibold hover:bg-teal-50 transition-colors"
                          title="Call patient"
                        >
                          <FiPhone size={14} />
                          Call
                        </button>
                      )
                    )}
                    {(patient.call_count || 0) > 0 && (
                      <button
                        onClick={() => onViewNotes(patient)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-teal-600 text-teal-600 rounded-lg text-xs font-semibold hover:bg-teal-50 transition-colors"
                        title="View notes (only available after calls have been made)"
                      >
                        <FiEye size={14} />
                        View Notes
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {/* Teal Separator Line */}
            {completePatients.length > 0 && missingPatients.length > 0 && (
              <tr>
                <td colSpan={16} className="px-0 py-0">
                  <div className="h-px bg-teal-700 w-full mx-auto"></div>
                </td>
              </tr>
            )}

            {/* Missing Records */}
            {missingPatients.map((patient, index) => (
              <tr key={`missing-${index}`} className="hover:bg-gray-50 transition-colors bg-red-50/30">
                <td className="px-4 py-4 text-sm text-gray-900">
                  {getFullName(patient) !== 'Unknown' ? (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onViewDetails) {
                          onViewDetails(patient);
                        }
                      }}
                      className="text-teal-600 hover:text-teal-800 hover:underline font-medium transition-colors cursor-pointer"
                      title={`Click to view full details for ${getFullName(patient)}`}
                    >
                      {getFullName(patient)}
                    </button>
                  ) : (
                    <span className="text-red-500 italic font-semibold" title="Patient name is missing">Missing</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900 font-medium">
                  {patient.phone_number && patient.phone_number.toLowerCase() !== 'nan' && patient.phone_number.length >= 10 ? (
                    patient.phone_number
                  ) : (
                    <span className="text-red-500 italic font-semibold" title="Phone number is missing or invalid - cannot make calls without a valid phone number">
                      Missing Phone
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-700 font-mono">
                  {patient.invoice_number && patient.invoice_number.toLowerCase() !== 'nan' && patient.invoice_number !== '' ? (
                    patient.invoice_number
                  ) : (
                    <span className="text-red-500 italic font-semibold" title="Invoice number is missing - required for identification">Missing</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  {patient.invoice_date ? (
                    new Date(patient.invoice_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900 font-semibold">{patient.price}</td>
                <td className="px-4 py-4 text-sm">
                  {isPaid(patient) ? (
                    <div className="flex flex-col">
                      <span className="text-emerald-600 font-bold">Paid</span>
                      <span className="text-xs text-gray-600 mt-1">
                        Amount: {formatCurrency(patient.amount_paid || '0')}
                      </span>
                    </div>
                  ) : patient.outstanding_amount && patient.outstanding_amount !== '' ? (
                    <span className="text-red-600 font-bold">{patient.outstanding_amount}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">{patient.aging_bucket}</td>
                <td className="px-4 py-4 text-sm min-w-[200px] max-w-md">
                  {patient.coverage_notes && patient.coverage_notes.trim() ? (
                    <div className="group relative">
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                        {patient.coverage_notes}
                      </p>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  {patient.link_requested ? (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium">{patient.link_requested}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  {patient.link_sent ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium">{patient.link_sent}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  {patient.estimated_date ? (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-md text-xs font-medium">{patient.estimated_date}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  {patient.call_status ? (
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      patient.call_status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : patient.call_status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {patient.call_status.charAt(0).toUpperCase() + patient.call_status.slice(1)}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onViewCallHistory) {
                        onViewCallHistory(patient);
                      }
                    }}
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
                    title={`Click to view call history for ${getFullName(patient)} - Invoice ${patient.invoice_number || 'N/A'}`}
                  >
                    {patient.call_count || 0}
                  </button>
                </td>
                <td className="px-4 py-4 text-sm min-w-[200px] max-w-md">
                  {patient.recent_call_notes && patient.recent_call_notes.trim() ? (
                    <div className="group relative">
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                        {patient.recent_call_notes}
                      </p>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">No notes</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  {patient.payment_status ? (
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      patient.payment_status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : patient.payment_status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : patient.payment_status === 'refunded'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {patient.payment_status.charAt(0).toUpperCase() + patient.payment_status.slice(1)}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    {hasOutstandingBalance(patient) && onCallPatient && (
                      !patient.phone_number || patient.phone_number.toLowerCase() === 'nan' || patient.phone_number.length < 10 ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-500 rounded-lg text-xs font-semibold cursor-not-allowed bg-red-50"
                          title="Phone number is missing or invalid - cannot make call without a valid phone number (minimum 10 digits)"
                        >
                          <FiPhone size={14} />
                          Missing Phone
                        </button>
                      ) : !patient.invoice_number || patient.invoice_number.toLowerCase() === 'nan' ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-500 rounded-lg text-xs font-semibold cursor-not-allowed bg-red-50"
                          title="Invoice number is missing - cannot make call without invoice number for identification"
                        >
                          <FiPhone size={14} />
                          Missing Invoice
                        </button>
                      ) : !patient.patient_first_name || !patient.patient_last_name || patient.patient_first_name.toLowerCase() === 'nan' || patient.patient_last_name.toLowerCase() === 'nan' ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-500 rounded-lg text-xs font-semibold cursor-not-allowed bg-red-50"
                          title="Patient name is missing - cannot make call without patient name for identification"
                        >
                          <FiPhone size={14} />
                          Missing Name
                        </button>
                      ) : isCallActive(patient) ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-400 rounded-lg text-xs font-semibold cursor-not-allowed"
                          title="Call in progress..."
                        >
                          <FiPhone size={14} />
                          Calling...
                        </button>
                      ) : (
                        <button
                          onClick={() => onCallPatient(patient)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-teal-600 text-teal-600 rounded-lg text-xs font-semibold hover:bg-teal-50 transition-colors"
                          title="Call patient"
                        >
                          <FiPhone size={14} />
                          Call
                        </button>
                      )
                    )}
                    {(patient.call_count || 0) > 0 && (
                      <button
                        onClick={() => onViewNotes(patient)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-teal-600 text-teal-600 rounded-lg text-xs font-semibold hover:bg-teal-50 transition-colors"
                        title="View notes (only available after calls have been made)"
                      >
                        <FiEye size={14} />
                        View Notes
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
