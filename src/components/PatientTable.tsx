import type { Patient } from '../types';
import { FiEye, FiPhone, FiPhoneOff } from 'react-icons/fi';
import { parseNotes } from '../utils/notesParser';

interface PatientTableProps {
  patients: Patient[];
  loading: boolean;
  onViewNotes: (patient: Patient) => void;
  onCallPatient?: (patient: Patient) => void;
  onEndCall?: (patient: Patient) => void;
  onViewCallHistory?: (patient: Patient) => void;
  onViewDetails?: (patient: Patient) => void;
  activeCalls?: Map<string, { timestamp: number; conversationId?: string }>;
}

export const PatientTable = ({ patients, loading, onViewNotes, onCallPatient, onEndCall, onViewCallHistory, onViewDetails, activeCalls = new Map() }: PatientTableProps) => {
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
    
    const callData = activeCalls.get(callKey)!;
    const now = Date.now();
    // Consider call active only if initiated within last 5 minutes
    // After that, allow calling again (call likely completed)
    return (now - callData.timestamp) < 5 * 60 * 1000;
  };

  // Check if patient has an active call with conversation ID
  const hasActiveCallWithConversation = (patient: Patient): boolean => {
    const callKey = getPatientCallKey(patient);
    const callData = activeCalls.get(callKey);
    return !!(callData && callData.conversationId && isCallActive(patient));
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
    const fullName = `${first} ${last}`.trim();
    
    // Check if name contains MISSING pattern (case-insensitive) with or without numbers
    if (!fullName || /^MISSING(_\d+)?$/i.test(first) || /^MISSING(_\d+)?$/i.test(last) || /^MISSING(_\d+)?\s*MISSING(_\d+)?$/i.test(fullName)) {
      return 'Unknown';
    }
    
    return fullName || 'Unknown';
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
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
        <table className="w-full text-sm table-fixed">
          <thead className="border-b-2 border-teal-700 sticky top-0 bg-white z-10">
            <tr>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[105px]">Patient Name</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[120px]">Phone Number</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[90px]">Invoice #</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[75px]">Invoice Date</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[75px]">Amount</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[85px]">Outstanding Balance</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[70px]">Aging</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[130px]">Coverage Notes</th>
              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-tight text-teal-700 w-[50px]">Link Req</th>
              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-tight text-teal-700 w-[50px]">Link Sent</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[75px]">Est Date</th>
              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-tight text-teal-700 w-[50px]">Call Status</th>
              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-tight text-teal-700 w-[45px]">Calls</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[130px]">Recent Notes</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Complete Records */}
            {completePatients.map((patient, index) => (
              <tr key={`complete-${index}`} className="hover:bg-gray-50 transition-colors">
                <td className="px-2 py-3 text-sm text-gray-900">
                  {getFullName(patient) !== 'Unknown' ? (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onViewDetails) {
                          onViewDetails(patient);
                        }
                      }}
                      className="text-teal-600 hover:text-teal-800 hover:underline font-medium transition-colors cursor-pointer block w-full text-left break-words leading-tight"
                      title={`Click to view full details for ${getFullName(patient)}`}
                    >
                      {getFullName(patient)}
                    </button>
                  ) : (
                    <span className="text-red-500 italic" title="Patient name is missing">Missing</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-gray-900 font-medium">
                  {patient.phone_number && patient.phone_number.toLowerCase() !== 'nan' && patient.phone_number.length >= 10 ? (
                    patient.phone_number
                  ) : (
                    <span className="text-red-500 italic font-semibold" title="Phone number is missing or invalid">
                      Missing
                    </span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-gray-700 font-mono">
                  {patient.invoice_number && patient.invoice_number.toLowerCase() !== 'nan' ? (
                    patient.invoice_number
                  ) : (
                    <span className="text-red-500 italic" title="Invoice number is missing">Missing</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-gray-700">
                  {patient.invoice_date ? (
                    new Date(patient.invoice_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: '2-digit'
                    })
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-gray-900 font-semibold">{patient.price}</td>
                <td className="px-2 py-3 text-sm">
                  {isPaid(patient) ? (
                    <div className="flex flex-col">
                      <span className="text-emerald-600 font-bold text-sm">Paid</span>
                      <span className="text-xs text-gray-600">
                        {formatCurrency(patient.amount_paid || '0')}
                      </span>
                    </div>
                  ) : patient.outstanding_amount && patient.outstanding_amount !== '' ? (
                    <span className="text-red-600 font-bold">{patient.outstanding_amount}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-gray-700">{patient.aging_bucket}</td>
                <td className="px-2 py-3 text-sm w-[130px]">
                  {patient.coverage_notes && patient.coverage_notes.trim() ? (
                    <div className="group relative">
                      <p className="text-xs text-gray-700 leading-tight whitespace-pre-wrap break-words">
                        {patient.coverage_notes}
                      </p>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-center">
                  {patient.link_requested ? (
                    patient.link_requested.toLowerCase() === 'yes' ? (
                      <span className="text-green-600 text-xl font-bold" title="Yes">✓</span>
                    ) : patient.link_requested.toLowerCase() === 'no' ? (
                      <span className="text-red-600 text-xl font-bold" title="No">✗</span>
                    ) : (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">{patient.link_requested}</span>
                    )
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-center">
                  {patient.link_sent ? (
                    patient.link_sent.toLowerCase() === 'yes' ? (
                      <span className="text-green-600 text-xl font-bold" title="Yes">✓</span>
                    ) : patient.link_sent.toLowerCase() === 'no' ? (
                      <span className="text-red-600 text-xl font-bold" title="No">✗</span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">{patient.link_sent}</span>
                    )
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm">
                  {patient.estimated_date ? (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium">{patient.estimated_date}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-center">
                  {patient.call_status ? (
                    patient.call_status === 'completed' ? (
                      <span className="text-green-600 text-xl font-bold" title="Completed">✓</span>
                    ) : patient.call_status === 'failed' ? (
                      <span className="text-red-600 text-xl font-bold" title="Failed">✗</span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                        {patient.call_status.charAt(0).toUpperCase() + patient.call_status.slice(1)}
                      </span>
                    )
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-center">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onViewCallHistory) {
                        onViewCallHistory(patient);
                      }
                    }}
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
                    title={`Click to view call history for ${getFullName(patient)} - Invoice ${patient.invoice_number}`}
                  >
                    {patient.call_count || 0}
                  </button>
                </td>
                <td className="px-2 py-3 text-sm w-[130px]">
                  {patient.recent_call_notes && patient.recent_call_notes.trim() ? (
                    <div className="group relative">
                      {(() => {
                        const parsedNotes = parseNotes(patient.recent_call_notes);
                        const latestNote = parsedNotes.length > 0 ? parsedNotes[parsedNotes.length - 1] : null;
                        
                        if (latestNote && latestNote.timestamp) {
                          return (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500 font-medium">
                                  {latestNote.timestamp.split(' ')[0]}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700 leading-tight break-words">
                                {latestNote.content}
                              </p>
                              {parsedNotes.length > 1 && (
                                <p className="text-xs text-gray-400 italic">
                                  +{parsedNotes.length - 1} more
                                </p>
                              )}
                            </div>
                          );
                        }
                        
                        // Fallback to raw display if parsing fails
                        return (
                      <p className="text-xs text-gray-700 leading-tight whitespace-pre-wrap break-words">
                        {patient.recent_call_notes}
                      </p>
                        );
                      })()}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">No notes</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm">
                  <div className="flex items-center gap-1 flex-wrap">
                    {hasOutstandingBalance(patient) && onCallPatient && (
                      !patient.phone_number || patient.phone_number.toLowerCase() === 'nan' || patient.phone_number.length < 10 ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1 px-2 py-1 border border-red-300 text-red-500 rounded text-xs font-semibold cursor-not-allowed bg-red-50"
                          title="Phone number is missing or invalid"
                        >
                          <FiPhone size={12} />
                          Missing
                        </button>
                      ) : !patient.invoice_number || patient.invoice_number.toLowerCase() === 'nan' ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1 px-2 py-1 border border-red-300 text-red-500 rounded text-xs font-semibold cursor-not-allowed bg-red-50"
                          title="Invoice number is missing"
                        >
                          <FiPhone size={12} />
                          Missing
                        </button>
                      ) : !patient.patient_first_name || !patient.patient_last_name || patient.patient_first_name.toLowerCase() === 'nan' || patient.patient_last_name.toLowerCase() === 'nan' ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1 px-2 py-1 border border-red-300 text-red-500 rounded text-xs font-semibold cursor-not-allowed bg-red-50"
                          title="Patient name is missing"
                        >
                          <FiPhone size={12} />
                          Missing
                        </button>
                      ) : isCallActive(patient) ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-400 rounded text-xs font-semibold cursor-not-allowed"
                          title="Call in progress..."
                        >
                          <FiPhone size={12} />
                          Calling...
                        </button>
                      ) : (
                        <button
                          onClick={() => onCallPatient(patient)}
                          className="inline-flex items-center gap-1 px-2 py-1 border border-teal-600 text-teal-600 rounded text-xs font-semibold hover:bg-teal-50 transition-colors"
                          title="Call patient"
                        >
                          <FiPhone size={12} />
                          Call
                        </button>
                      )
                    )}
                    {hasActiveCallWithConversation(patient) && onEndCall && (
                      <button
                        onClick={() => onEndCall(patient)}
                        className="inline-flex items-center gap-1 px-2 py-1 border border-red-600 text-red-600 rounded text-xs font-semibold hover:bg-red-50 transition-colors"
                        title="End call"
                      >
                        <FiPhoneOff size={12} />
                        Disconnect
                      </button>
                    )}
                    {(patient.call_count || 0) > 0 && (
                      <button
                        onClick={() => onViewNotes(patient)}
                        className="inline-flex items-center gap-1 px-2 py-1 border border-teal-600 text-teal-600 rounded text-xs font-semibold hover:bg-teal-50 transition-colors"
                        title="View notes"
                      >
                        <FiEye size={12} />
                        Notes
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {/* Teal Separator Line */}
            {completePatients.length > 0 && missingPatients.length > 0 && (
              <tr>
                <td colSpan={15} className="px-0 py-0">
                  <div className="h-px bg-teal-700 w-full mx-auto"></div>
                </td>
              </tr>
            )}

            {/* Missing Records */}
            {missingPatients.map((patient, index) => (
              <tr key={`missing-${index}`} className="hover:bg-gray-50 transition-colors bg-red-50/30">
                <td className="px-2 py-3 text-sm text-gray-900">
                  {getFullName(patient) !== 'Unknown' ? (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onViewDetails) {
                          onViewDetails(patient);
                        }
                      }}
                      className="text-teal-600 hover:text-teal-800 hover:underline font-medium transition-colors cursor-pointer block w-full text-left break-words leading-tight"
                      title={`Click to view full details for ${getFullName(patient)}`}
                    >
                      {getFullName(patient)}
                    </button>
                  ) : (
                    <span className="text-red-500 italic font-semibold" title="Patient name is missing">Missing</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-gray-900 font-medium">
                  {patient.phone_number && patient.phone_number.toLowerCase() !== 'nan' && patient.phone_number.length >= 10 ? (
                    patient.phone_number
                  ) : (
                    <span className="text-red-500 italic font-semibold" title="Phone number is missing or invalid">
                      Missing
                    </span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-gray-700 font-mono">
                  {patient.invoice_number && patient.invoice_number.toLowerCase() !== 'nan' && patient.invoice_number !== '' ? (
                    patient.invoice_number
                  ) : (
                    <span className="text-red-500 italic font-semibold" title="Invoice number is missing">Missing</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-gray-700">
                  {patient.invoice_date ? (
                    new Date(patient.invoice_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: '2-digit'
                    })
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-gray-900 font-semibold">{patient.price}</td>
                <td className="px-2 py-3 text-sm">
                  {isPaid(patient) ? (
                    <div className="flex flex-col">
                      <span className="text-emerald-600 font-bold text-sm">Paid</span>
                      <span className="text-xs text-gray-600">
                        {formatCurrency(patient.amount_paid || '0')}
                      </span>
                    </div>
                  ) : patient.outstanding_amount && patient.outstanding_amount !== '' ? (
                    <span className="text-red-600 font-bold">{patient.outstanding_amount}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-gray-700">{patient.aging_bucket}</td>
                <td className="px-2 py-3 text-sm w-[130px]">
                  {patient.coverage_notes && patient.coverage_notes.trim() ? (
                    <div className="group relative">
                      <p className="text-xs text-gray-700 leading-tight whitespace-pre-wrap break-words">
                        {patient.coverage_notes}
                      </p>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-center">
                  {patient.link_requested ? (
                    patient.link_requested.toLowerCase() === 'yes' ? (
                      <span className="text-green-600 text-xl font-bold" title="Yes">✓</span>
                    ) : patient.link_requested.toLowerCase() === 'no' ? (
                      <span className="text-red-600 text-xl font-bold" title="No">✗</span>
                    ) : (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">{patient.link_requested}</span>
                    )
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-center">
                  {patient.link_sent ? (
                    patient.link_sent.toLowerCase() === 'yes' ? (
                      <span className="text-green-600 text-xl font-bold" title="Yes">✓</span>
                    ) : patient.link_sent.toLowerCase() === 'no' ? (
                      <span className="text-red-600 text-xl font-bold" title="No">✗</span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">{patient.link_sent}</span>
                    )
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm">
                  {patient.estimated_date ? (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium">{patient.estimated_date}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-center">
                  {patient.call_status ? (
                    patient.call_status === 'completed' ? (
                      <span className="text-green-600 text-xl font-bold" title="Completed">✓</span>
                    ) : patient.call_status === 'failed' ? (
                      <span className="text-red-600 text-xl font-bold" title="Failed">✗</span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                        {patient.call_status.charAt(0).toUpperCase() + patient.call_status.slice(1)}
                      </span>
                    )
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-2 py-3 text-sm text-center">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onViewCallHistory) {
                        onViewCallHistory(patient);
                      }
                    }}
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
                    title={`Click to view call history for ${getFullName(patient)} - Invoice ${patient.invoice_number || 'N/A'}`}
                  >
                    {patient.call_count || 0}
                  </button>
                </td>
                <td className="px-2 py-3 text-sm w-[130px]">
                  {patient.recent_call_notes && patient.recent_call_notes.trim() ? (
                    <div className="group relative">
                      {(() => {
                        const parsedNotes = parseNotes(patient.recent_call_notes);
                        const latestNote = parsedNotes.length > 0 ? parsedNotes[parsedNotes.length - 1] : null;
                        
                        if (latestNote && latestNote.timestamp) {
                          return (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-500 font-medium">
                                  {latestNote.timestamp.split(' ')[0]}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-700 leading-tight break-words">
                                {latestNote.content}
                              </p>
                              {parsedNotes.length > 1 && (
                                <p className="text-[10px] text-gray-400 italic">
                                  +{parsedNotes.length - 1} more
                                </p>
                              )}
                            </div>
                          );
                        }
                        
                        // Fallback to raw display if parsing fails
                        return (
                      <p className="text-[10px] text-gray-700 leading-tight whitespace-pre-wrap break-words">
                        {patient.recent_call_notes}
                      </p>
                        );
                      })()}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">No notes</span>
                  )}
                </td>
                <td className="px-2 py-2 text-xs">
                  <div className="flex items-center gap-1 flex-wrap">
                    {hasOutstandingBalance(patient) && onCallPatient && (
                      !patient.phone_number || patient.phone_number.toLowerCase() === 'nan' || patient.phone_number.length < 10 ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1 px-2 py-1 border border-red-300 text-red-500 rounded text-[10px] font-semibold cursor-not-allowed bg-red-50"
                          title="Phone number is missing or invalid"
                        >
                          <FiPhone size={10} />
                          Missing
                        </button>
                      ) : !patient.invoice_number || patient.invoice_number.toLowerCase() === 'nan' ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1 px-2 py-1 border border-red-300 text-red-500 rounded text-[10px] font-semibold cursor-not-allowed bg-red-50"
                          title="Invoice number is missing"
                        >
                          <FiPhone size={10} />
                          Missing
                        </button>
                      ) : !patient.patient_first_name || !patient.patient_last_name || patient.patient_first_name.toLowerCase() === 'nan' || patient.patient_last_name.toLowerCase() === 'nan' ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1 px-2 py-1 border border-red-300 text-red-500 rounded text-[10px] font-semibold cursor-not-allowed bg-red-50"
                          title="Patient name is missing"
                        >
                          <FiPhone size={10} />
                          Missing
                        </button>
                      ) : isCallActive(patient) ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-400 rounded text-[10px] font-semibold cursor-not-allowed"
                          title="Call in progress..."
                        >
                          <FiPhone size={10} />
                          Calling...
                        </button>
                      ) : (
                        <button
                          onClick={() => onCallPatient(patient)}
                          className="inline-flex items-center gap-1 px-2 py-1 border border-teal-600 text-teal-600 rounded text-[10px] font-semibold hover:bg-teal-50 transition-colors"
                          title="Call patient"
                        >
                          <FiPhone size={10} />
                          Call
                        </button>
                      )
                    )}
                    {hasActiveCallWithConversation(patient) && onEndCall && (
                      <button
                        onClick={() => onEndCall(patient)}
                        className="inline-flex items-center gap-1 px-2 py-1 border border-red-600 text-red-600 rounded text-[10px] font-semibold hover:bg-red-50 transition-colors"
                        title="End call"
                      >
                        <FiPhoneOff size={10} />
                        Disconnect
                      </button>
                    )}
                    {(patient.call_count || 0) > 0 && (
                      <button
                        onClick={() => onViewNotes(patient)}
                        className="inline-flex items-center gap-1 px-2 py-1 border border-teal-600 text-teal-600 rounded text-[10px] font-semibold hover:bg-teal-50 transition-colors"
                        title="View notes"
                      >
                        <FiEye size={10} />
                        Notes
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
