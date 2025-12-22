import type { Patient } from '../types';
import { FiEye, FiPhone, FiPhoneOff, FiFilter, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { parseNotes } from '../utils/notesParser';
import { useState, useRef, useEffect } from 'react';

interface PatientTableProps {
  patients: Patient[];
  loading: boolean;
  onViewNotes: (patient: Patient) => void;
  onCallPatient?: (patient: Patient) => void;
  onEndCall?: (patient: Patient) => void;
  onViewCallHistory?: (patient: Patient) => void;
  onViewDetails?: (patient: Patient) => void;
  onUpdatePatient?: (invoiceId: number, updates: Record<string, string | number>) => Promise<void>;
  activeCalls?: Map<string, { timestamp: number; conversationId?: string; callSid?: string; twilioStatus?: string }>;
  selectedPatientIds?: Set<number>;
  onSelectionChange?: (selectedIds: Set<number>) => void;
}

type SortColumn = 'name' | 'date';
type SortDirection = 'asc' | 'desc';
type SortConfig = { column: SortColumn; direction: SortDirection };

export const PatientTable = ({ patients, loading, onViewNotes, onCallPatient, onEndCall, onViewCallHistory, onViewDetails, onUpdatePatient, activeCalls = new Map(), selectedPatientIds = new Set(), onSelectionChange }: PatientTableProps) => {
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([]);
  const [editingCell, setEditingCell] = useState<{ patientId: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  // Handle cell editing
  const handleStartEdit = (patient: Patient, field: string) => {
    if (!onUpdatePatient || !patient.id) return;
    
    let value = '';
    if (field === 'phone_number') {
      value = patient.phone_number || '';
    } else if (field === 'outstanding_amount') {
      value = patient.outstanding_amount || '';
    } else if (field === 'price') {
      value = patient.price || '';
    } else if (field === 'patient_name') {
      // Combine first and last name for editing
      const first = patient.patient_first_name || '';
      const last = patient.patient_last_name || '';
      value = `${first} ${last}`.trim();
    }
    
    setEditingCell({ patientId: patient.id, field });
    setEditValue(value);
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleSaveEdit = async (patient: Patient) => {
    if (!onUpdatePatient || !editingCell || !patient.id || updating) return;
    
    try {
      setUpdating(true);
      const updates: Record<string, string | number> = {};
      
      // For patient name, we need to handle first and last name separately
      // But if editing "patient_name" (combined), we'll split it
      if (editingCell.field === 'patient_name') {
        const nameParts = editValue.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          updates['patient_first_name'] = nameParts[0];
          updates['patient_last_name'] = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          updates['patient_first_name'] = nameParts[0];
          updates['patient_last_name'] = '';
        }
      } else {
        updates[editingCell.field] = editValue;
      }
      
      await onUpdatePatient(patient.id, updates);
      setEditingCell(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to update patient:', error);
      alert('Failed to update patient. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  // Editable cell component
  const EditableCell = ({ patient, field, displayValue, className = '' }: { 
    patient: Patient; 
    field: string; 
    displayValue: string | React.ReactNode;
    className?: string;
  }) => {
    const isEditing = editingCell?.patientId === patient.id && editingCell?.field === field;
    
    if (!onUpdatePatient || !patient.id) {
      return <td className={className}>{displayValue}</td>;
    }

    if (isEditing) {
      const isDateField = field === 'patient_dob';
      return (
        <td className={className}>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveEdit(patient);
                } else if (e.key === 'Escape') {
                  handleCancelEdit();
                }
              }}
              placeholder={isDateField ? "MM/DD/YYYY" : ""}
              className="flex-1 px-2 py-1 text-sm border border-teal-500 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
              autoFocus
              disabled={updating}
            />
            <button
              onClick={() => handleSaveEdit(patient)}
              disabled={updating}
              className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
              title="Save"
            >
              <FiCheck size={16} />
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={updating}
              className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
              title="Cancel"
            >
              <FiX size={16} />
            </button>
          </div>
        </td>
      );
    }

    return (
      <td className={`${className} group relative`}>
        <div className="flex items-center gap-1">
          <div className="flex-1" onClick={(e) => {
            // Don't trigger edit if clicking on a button inside (like "view details")
            if ((e.target as HTMLElement).tagName === 'BUTTON') {
              return;
            }
            handleStartEdit(patient, field);
          }}>
            {displayValue}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit(patient, field);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-teal-600 hover:text-teal-800 transition-opacity"
            title={`Edit ${field}`}
          >
            <FiEdit2 size={14} />
          </button>
        </div>
      </td>
    );
  };
  // Helper function to create unique key for each patient record (same as in InvoiceList)
  const getPatientCallKey = (patient: Patient): string => {
    const phone = patient.phone_number || '';
    const invoice = patient.invoice_number || '';
    const firstName = patient.patient_first_name || '';
    const lastName = patient.patient_last_name || '';
    return `${phone}|${invoice}|${firstName}|${lastName}`;
  };

  // Check if call is currently active (shows "Calling..." button)
  // Uses API status from activeCalls (updated by polling) to determine if call is active
  const isCallActive = (patient: Patient): boolean => {
    const callKey = getPatientCallKey(patient);
    if (!callKey || !activeCalls.has(callKey)) return false;
    
    const callData = activeCalls.get(callKey)!;
    
    // Check real-time API status if available (from status endpoint polling)
    if (callData.twilioStatus) {
      // Show "Calling..." for: queued, ringing, in-progress
      // Hide for: completed, busy, failed, no-answer, canceled, error, not_found
      const activeStatuses = ['queued', 'ringing', 'in-progress'];
      return activeStatuses.includes(callData.twilioStatus.toLowerCase());
    }
    
    // Fallback: If no API status yet, check time and database status
    const now = Date.now();
    const timeSinceCall = now - callData.timestamp;
    
    // Don't show "Calling..." if database already shows completed/failed
    if (patient.call_status === 'completed' || patient.call_status === 'failed') {
      return false;
    }
    
    // Consider call active if initiated within last 5 minutes
    return timeSinceCall < 5 * 60 * 1000;
  };

  // Check if disconnect button should be visible (including post-call processing time)
  // Button stays visible while call is active OR during post-call processing
  const shouldShowDisconnectButton = (patient: Patient): boolean => {
    const callKey = getPatientCallKey(patient);
    const callData = activeCalls.get(callKey);
    
    // No call data - don't show button
    if (!callData) return false;
    
    const now = Date.now();
    const timeSinceCall = now - callData.timestamp;
    
    // Keep button visible for up to 10 minutes (enough time for post-call processing)
    if (timeSinceCall > 10 * 60 * 1000) {
      return false; // More than 10 minutes - hide button
    }
    
    // Show button as long as we have call data (activeCalls entry exists)
    // This ensures button is visible during entire call + post-call processing
    return true;
  };

  // Check if disconnect button should be disabled (shows "Processing..." when disabled)
  // Disable when call has ended (based on API status from status endpoint)
  const isDisconnectButtonDisabled = (patient: Patient): boolean => {
    const callKey = getPatientCallKey(patient);
    const callData = activeCalls.get(callKey);
    
    if (!callData) return false;
    
    // Check real-time API status if available (from status endpoint polling)
    if (callData.twilioStatus) {
      const apiStatus = callData.twilioStatus.toLowerCase();
      
      // Disable (show "Processing...") if call has ended
      // Statuses: completed, busy, failed, no-answer, canceled, error, not_found
      // Enable (show "Disconnect") for: queued, ringing, in-progress, unknown
      const callHasEnded = ['completed', 'busy', 'failed', 'no-answer', 'canceled', 'error', 'not_found'].includes(apiStatus);
      return callHasEnded;
    }
    
    // Fallback: If no API status yet, check database status
    // But keep enabled for first 10 seconds (call initiating)
    const now = Date.now();
    const timeSinceCall = now - callData.timestamp;
    
    if (timeSinceCall < 10000) {
      return false; // Keep enabled while call is initiating
    }
    
    // If database shows completed/failed after 10 seconds, disable (show "Processing...")
    if (patient.call_status === 'completed' || patient.call_status === 'failed') {
      return true;
    }
    
    // Otherwise, keep button enabled (show "Disconnect")
    return false;
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

  // Format date string without timezone conversion (e.g., "2025-12-03" -> "Dec 3, 2025")
  const formatDateString = (dateString: string): string => {
    if (!dateString) return '';
    
    // Parse YYYY-MM-DD format directly without timezone conversion
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString; // Return as-is if format is unexpected
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) return dateString;
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${monthNames[month - 1]} ${day}, ${year}`;
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
  // Note: invoice_number is no longer required, so we don't check it
  const hasMissingData = (patient: Patient): boolean => {
    const phone = patient.phone_number && patient.phone_number.toLowerCase() !== 'nan' && patient.phone_number.length >= 10;
    const firstName = patient.patient_first_name && patient.patient_first_name.toLowerCase() !== 'nan' && patient.patient_first_name !== '';
    const lastName = patient.patient_last_name && patient.patient_last_name.toLowerCase() !== 'nan' && patient.patient_last_name !== '';
    
    // Check if names match MISSING pattern (e.g., "MISSING_0", "MISSING_1", etc.)
    const hasValidFirstName = firstName && !/^MISSING(_\d+)?$/i.test(patient.patient_first_name || '');
    const hasValidLastName = lastName && !/^MISSING(_\d+)?$/i.test(patient.patient_last_name || '');
    
    return !phone || !hasValidFirstName || !hasValidLastName;
  };

  // Handle patient selection
  const handlePatientToggle = (patientId: number | undefined) => {
    if (!onSelectionChange || !patientId) return;
    
    const newSelection = new Set(selectedPatientIds);
    if (newSelection.has(patientId)) {
      newSelection.delete(patientId);
    } else {
      newSelection.add(patientId);
    }
    onSelectionChange(newSelection);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    
    const visiblePatientIds = patients
      .filter(p => p.id !== undefined)
      .map(p => p.id as number);
    
    const allSelected = visiblePatientIds.every(id => selectedPatientIds.has(id));
    
    if (allSelected) {
      // Deselect all visible patients
      const newSelection = new Set(selectedPatientIds);
      visiblePatientIds.forEach(id => newSelection.delete(id));
      onSelectionChange(newSelection);
    } else {
      // Select all visible patients
      const newSelection = new Set(selectedPatientIds);
      visiblePatientIds.forEach(id => newSelection.add(id));
      onSelectionChange(newSelection);
    }
  };

  // Check if all visible patients are selected
  const allVisibleSelected = patients.length > 0 && patients
    .filter(p => p.id !== undefined)
    .every(p => selectedPatientIds.has(p.id as number));

  // Check if some (but not all) visible patients are selected
  const someVisibleSelected = patients.some(p => p.id !== undefined && selectedPatientIds.has(p.id as number));

  // Set indeterminate state on select all checkbox
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    setSortConfigs(prevConfigs => {
      const existingIndex = prevConfigs.findIndex(config => config.column === column);
      
      if (existingIndex !== -1) {
        // Column already sorted
        const currentConfig = prevConfigs[existingIndex];
        
        if (currentConfig.direction === 'asc') {
          // First click was asc, now change to desc
          const newConfigs = [...prevConfigs];
          newConfigs[existingIndex] = {
            ...currentConfig,
            direction: 'desc' as SortDirection
          };
          return newConfigs;
        } else {
          // Second click was desc, now remove sorting (back to original)
          return prevConfigs.filter((_, index) => index !== existingIndex);
        }
      } else {
        // Add new sort column - start with ascending
        const newConfig = { column, direction: 'asc' as SortDirection };
        return [...prevConfigs, newConfig];
      }
    });
  };

  // Get sort state for a specific column
  const getSortState = (column: SortColumn): { active: boolean; direction?: SortDirection; priority?: number } => {
    const index = sortConfigs.findIndex(config => config.column === column);
    if (index === -1) {
      return { active: false };
    }
    return {
      active: true,
      direction: sortConfigs[index].direction,
      priority: index + 1 // 1 for primary, 2 for secondary
    };
  };

  // Sort patients based on current sort settings
  const sortPatients = (patientsToSort: Patient[]): Patient[] => {
    if (sortConfigs.length === 0) return patientsToSort;

    return [...patientsToSort].sort((a, b) => {
      // Apply sorts in order of priority
      for (const config of sortConfigs) {
        let comparison = 0;

        if (config.column === 'name') {
          const nameA = getFullName(a).toLowerCase();
          const nameB = getFullName(b).toLowerCase();
          comparison = nameA.localeCompare(nameB);
        } else if (config.column === 'date') {
          const hasDateA = !!a.invoice_date;
          const hasDateB = !!b.invoice_date;
          
          // Always put records without dates at the end, regardless of sort direction
          if (!hasDateA && !hasDateB) {
            comparison = 0; // Both missing - keep original order
          } else if (!hasDateA) {
            return 1; // A is missing - put A after B (always at end)
          } else if (!hasDateB) {
            return -1; // B is missing - put A before B (always at end)
          } else if (a.invoice_date && b.invoice_date) {
            // Both have dates, compare them normally
            const dateA = new Date(a.invoice_date).getTime();
            const dateB = new Date(b.invoice_date).getTime();
            comparison = dateA - dateB;
          }
        }

        // Apply direction
        const result = config.direction === 'asc' ? comparison : -comparison;
        
        // If this sort resulted in a difference, return it
        // Otherwise, continue to next sort config
        if (result !== 0) {
          return result;
        }
      }

      return 0; // All sorts resulted in equality
    });
  };

  // Separate patients into complete and missing records
  const completePatients = sortPatients(patients.filter(p => !hasMissingData(p)));
  const missingPatients = sortPatients(patients.filter(p => hasMissingData(p)));

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
        <table className="w-full text-sm table-auto">
          <thead className="border-b-2 border-teal-700 sticky top-0 bg-white z-10">
            <tr>
              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-tight text-teal-700 w-[50px]">
                {onSelectionChange && (
                  <input
                    type="checkbox"
                    ref={selectAllCheckboxRef}
                    checked={allVisibleSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                    title={allVisibleSelected ? "Deselect all" : someVisibleSelected ? "Some selected" : "Select all"}
                  />
                )}
              </th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[150px]">
                <div className="flex items-center gap-1.5">
                  <span>Patient Name</span>
                  <button 
                    onClick={() => handleSort('name')}
                    className={(() => {
                      const sortState = getSortState('name');
                      if (!sortState.active) {
                        return 'border border-gray-300 hover:border-teal-400 transition-all cursor-pointer p-1 rounded-md';
                      }
                      if (sortState.priority === 1) {
                        return sortState.direction === 'asc' 
                          ? 'border-2 border-teal-600 hover:border-teal-700 transition-all cursor-pointer p-1 rounded-md' 
                          : 'border-2 border-teal-900 hover:border-teal-950 transition-all cursor-pointer p-1 rounded-md';
                      } else {
                        return sortState.direction === 'asc' 
                          ? 'border-2 border-teal-400 hover:border-teal-500 transition-all cursor-pointer p-1 rounded-md' 
                          : 'border-2 border-teal-700 hover:border-teal-800 transition-all cursor-pointer p-1 rounded-md';
                      }
                    })()}
                    title={(() => {
                      const sortState = getSortState('name');
                      if (!sortState.active) return 'Click to sort';
                      const priorityText = sortState.priority === 1 ? 'Primary' : 'Secondary';
                      const directionText = sortState.direction === 'asc' ? 'A-Z' : 'Z-A';
                      return `${priorityText} sort: ${directionText} - Click to toggle`;
                    })()}
                  >
                    <FiFilter 
                      size={12} 
                      className={(() => {
                        const sortState = getSortState('name');
                        if (!sortState.active) return 'text-gray-400';
                        if (sortState.priority === 1) {
                          return sortState.direction === 'asc' ? 'text-teal-600' : 'text-teal-900';
                        } else {
                          return sortState.direction === 'asc' ? 'text-teal-400' : 'text-teal-700';
                        }
                      })()}
                    />
                  </button>
                </div>
              </th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[150px]">Phone Number</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[110px]">Invoice Date</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[90px]">Amount</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[130px]">Outstanding Balance</th>
              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-tight text-teal-700 w-[70px]">Link Req</th>
              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-tight text-teal-700 w-[70px]">Link Sent</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[100px]">Est Date</th>
              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-tight text-teal-700 w-[80px]">Call Status</th>
              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-tight text-teal-700 w-[60px]">Calls</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[180px]">Recent Notes</th>
              <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-tight text-teal-700 w-[150px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Complete Records */}
            {completePatients.map((patient, index) => (
              <tr key={`complete-${index}`} className={`hover:bg-gray-50 transition-colors ${selectedPatientIds.has(patient.id as number) ? 'bg-teal-50' : ''}`}>
                <td className="px-2 py-3 text-center">
                  {onSelectionChange && patient.id !== undefined && (
                    <input
                      type="checkbox"
                      checked={selectedPatientIds.has(patient.id)}
                      onChange={() => handlePatientToggle(patient.id)}
                      className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </td>
                <EditableCell
                  patient={patient}
                  field="patient_name"
                  displayValue={
                    getFullName(patient) !== 'Unknown' ? (
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
                    )
                  }
                  className="px-2 py-3 text-sm text-gray-900"
                />
                <EditableCell
                  patient={patient}
                  field="phone_number"
                  displayValue={
                    patient.phone_number && patient.phone_number.toLowerCase() !== 'nan' && patient.phone_number.length >= 10 ? (
                      patient.phone_number
                    ) : (
                      <span className="text-red-500 italic font-semibold" title="Phone number is missing or invalid">
                        Missing
                      </span>
                    )
                  }
                  className="px-2 py-3 text-sm text-gray-900 font-medium"
                />
                <td className="px-2 py-3 text-sm text-gray-700">
                  {patient.invoice_date ? (
                    formatDateString(patient.invoice_date)
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <EditableCell
                  patient={patient}
                  field="price"
                  displayValue={
                    patient.price ? (
                      <span className="text-gray-900 font-semibold">{formatCurrency(patient.price)}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )
                  }
                  className="px-2 py-3 text-sm"
                />
                <EditableCell
                  patient={patient}
                  field="outstanding_amount"
                  displayValue={
                    isPaid(patient) ? (
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
                    )
                  }
                  className="px-2 py-3 text-sm"
                />
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
                  <div className="group relative inline-block">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onViewCallHistory) {
                          onViewCallHistory(patient);
                        }
                      }}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      {patient.call_count || 0}
                    </button>
                    
                    {/* Hover Tooltip showing last 3 call attempts */}
                    {(patient.call_count ?? 0) > 0 && ((patient.last_3_attempts && patient.last_3_attempts.length > 0) || patient.recent_call_notes) && (
                      <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute z-50 left-1/2 transform -translate-x-1/2 top-full mt-2 w-72 bg-white border-2 border-teal-500 text-gray-900 text-xs rounded-lg shadow-2xl p-4 pointer-events-auto cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onViewCallHistory) {
                            onViewCallHistory(patient);
                          }
                        }}
                      >
                        {/* Arrow in top right */}
                        <div className="absolute top-3 right-3">
                          <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-6">
                          {patient.last_3_attempts && patient.last_3_attempts.length > 0 ? (
                            patient.last_3_attempts.map((attempt, idx) => {
                              // Parse attempt text (format: "Attempt X\nNotes here")
                              const lines = attempt.split('\n');
                              const attemptLabel = lines[0];
                              const noteContent = lines.slice(1).join('\n').trim();
                              
                              return (
                                <div key={idx} className="py-1 text-left">
                                  <div className="font-semibold text-gray-800 text-xs mb-0.5">{attemptLabel}</div>
                                  {noteContent && (
                                    <div className="text-gray-600 text-xs leading-relaxed">
                                      {noteContent}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : patient.recent_call_notes ? (
                            // Fallback to recent_call_notes if last_3_attempts not available yet
                            (() => {
                            const notesText = patient.recent_call_notes;
                            if (notesText.startsWith('Attempt ')) {
                              const lines = notesText.split('\n');
                              const attemptLabel = lines[0];
                              const noteContent = lines.slice(1).join('\n').trim();
                              
                              return (
                                  <div className="py-1 text-left">
                                    <div className="font-semibold text-gray-800 text-xs mb-0.5">{attemptLabel}</div>
                                  {noteContent && (
                                      <div className="text-gray-600 text-xs leading-relaxed">
                                      {noteContent}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return (
                                <div className="py-1 text-left">
                                  <div className="text-gray-600 text-xs leading-relaxed">
                                {notesText}
                                  </div>
                              </div>
                            );
                            })()
                          ) : null}
                        </div>
                        {/* Tooltip arrow pointing up */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-[-1px]">
                          <div className="border-8 border-transparent border-b-teal-500"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-2 py-3 text-sm w-[130px]">
                  {patient.recent_call_notes && patient.recent_call_notes.trim() ? (
                    <div className="group relative">
                      {(() => {
                        // Check if notes start with "Attempt X" (backend format)
                        const notesText = patient.recent_call_notes;
                        if (notesText.startsWith('Attempt ')) {
                          const lines = notesText.split('\n');
                          const attemptLabel = lines[0];
                          const noteContent = lines.slice(1).join('\n').trim();
                          
                          return (
                            <div className="space-y-0.5">
                              <span className="text-xs text-gray-900 font-bold block">
                                {attemptLabel}
                              </span>
                              {noteContent && (
                                <p className="text-xs text-gray-700 leading-tight break-words">
                                  {noteContent}
                                </p>
                              )}
                            </div>
                          );
                        }
                        
                        // Old format: Try parsing with timestamps
                        const parsedNotes = parseNotes(notesText);
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
                        {notesText}
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
                    {shouldShowDisconnectButton(patient) && onEndCall && (
                      <button
                        onClick={() => onEndCall(patient)}
                        disabled={isDisconnectButtonDisabled(patient)}
                        className={`inline-flex items-center gap-1 px-2 py-1 border rounded text-xs font-semibold transition-colors ${
                          isDisconnectButtonDisabled(patient)
                            ? 'border-gray-300 text-gray-400 cursor-not-allowed bg-gray-50'
                            : 'border-red-600 text-red-600 hover:bg-red-50'
                        }`}
                        title={isDisconnectButtonDisabled(patient) ? "Processing post-call updates..." : "End call"}
                      >
                        <FiPhoneOff size={12} />
                        {isDisconnectButtonDisabled(patient) ? 'Processing...' : 'Disconnect'}
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
                <td colSpan={13} className="px-0 py-0">
                  <div className="h-px bg-teal-700 w-full mx-auto"></div>
                </td>
              </tr>
            )}

            {/* Missing Records */}
            {missingPatients.map((patient, index) => (
              <tr key={`missing-${index}`} className={`hover:bg-gray-50 transition-colors bg-red-50/30 ${selectedPatientIds.has(patient.id as number) ? 'bg-teal-50' : ''}`}>
                <td className="px-2 py-3 text-center">
                  {onSelectionChange && patient.id !== undefined && (
                    <input
                      type="checkbox"
                      checked={selectedPatientIds.has(patient.id)}
                      onChange={() => handlePatientToggle(patient.id)}
                      className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </td>
                <EditableCell
                  patient={patient}
                  field="patient_name"
                  displayValue={
                    getFullName(patient) !== 'Unknown' ? (
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
                    )
                  }
                  className="px-2 py-3 text-sm text-gray-900"
                />
                <EditableCell
                  patient={patient}
                  field="phone_number"
                  displayValue={
                    patient.phone_number && patient.phone_number.toLowerCase() !== 'nan' && patient.phone_number.length >= 10 ? (
                      patient.phone_number
                    ) : (
                      <span className="text-red-500 italic font-semibold" title="Phone number is missing or invalid">
                        Missing
                      </span>
                    )
                  }
                  className="px-2 py-3 text-sm text-gray-900 font-medium"
                />
                <td className="px-2 py-3 text-sm text-gray-700">
                  {patient.invoice_date ? (
                    formatDateString(patient.invoice_date)
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <EditableCell
                  patient={patient}
                  field="price"
                  displayValue={
                    patient.price ? (
                      <span className="text-gray-900 font-semibold">{formatCurrency(patient.price)}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )
                  }
                  className="px-2 py-3 text-sm"
                />
                <EditableCell
                  patient={patient}
                  field="outstanding_amount"
                  displayValue={
                    isPaid(patient) ? (
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
                    )
                  }
                  className="px-2 py-3 text-sm"
                />
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
                  <div className="group relative inline-block">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onViewCallHistory) {
                          onViewCallHistory(patient);
                        }
                      }}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      {patient.call_count || 0}
                    </button>
                    
                    {/* Hover Tooltip showing last 3 call attempts */}
                    {(patient.call_count ?? 0) > 0 && ((patient.last_3_attempts && patient.last_3_attempts.length > 0) || patient.recent_call_notes) && (
                      <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute z-50 left-1/2 transform -translate-x-1/2 top-full mt-2 w-72 bg-white border-2 border-teal-500 text-gray-900 text-xs rounded-lg shadow-2xl p-4 pointer-events-auto cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onViewCallHistory) {
                            onViewCallHistory(patient);
                          }
                        }}
                      >
                        {/* Arrow in top right */}
                        <div className="absolute top-3 right-3">
                          <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-6">
                          {patient.last_3_attempts && patient.last_3_attempts.length > 0 ? (
                            patient.last_3_attempts.map((attempt, idx) => {
                              // Parse attempt text (format: "Attempt X\nNotes here")
                              const lines = attempt.split('\n');
                              const attemptLabel = lines[0];
                              const noteContent = lines.slice(1).join('\n').trim();
                              
                              return (
                                <div key={idx} className="py-1 text-left">
                                  <div className="font-semibold text-gray-800 text-xs mb-0.5">{attemptLabel}</div>
                                  {noteContent && (
                                    <div className="text-gray-600 text-xs leading-relaxed">
                                      {noteContent}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : patient.recent_call_notes ? (
                            // Fallback to recent_call_notes if last_3_attempts not available yet
                            (() => {
                            const notesText = patient.recent_call_notes;
                            if (notesText.startsWith('Attempt ')) {
                              const lines = notesText.split('\n');
                              const attemptLabel = lines[0];
                              const noteContent = lines.slice(1).join('\n').trim();
                              
                              return (
                                  <div className="py-1 text-left">
                                    <div className="font-semibold text-gray-800 text-xs mb-0.5">{attemptLabel}</div>
                                  {noteContent && (
                                      <div className="text-gray-600 text-xs leading-relaxed">
                                      {noteContent}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return (
                                <div className="py-1 text-left">
                                  <div className="text-gray-600 text-xs leading-relaxed">
                                {notesText}
                                  </div>
                              </div>
                            );
                            })()
                          ) : null}
                        </div>
                        {/* Tooltip arrow pointing up */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-[-1px]">
                          <div className="border-8 border-transparent border-b-teal-500"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-2 py-3 text-sm w-[130px]">
                  {patient.recent_call_notes && patient.recent_call_notes.trim() ? (
                    <div className="group relative">
                      {(() => {
                        // Check if notes start with "Attempt X" (backend format)
                        const notesText = patient.recent_call_notes;
                        if (notesText.startsWith('Attempt ')) {
                          const lines = notesText.split('\n');
                          const attemptLabel = lines[0];
                          const noteContent = lines.slice(1).join('\n').trim();
                          
                          return (
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-gray-900 font-bold block">
                                {attemptLabel}
                              </span>
                              {noteContent && (
                                <p className="text-[10px] text-gray-700 leading-tight break-words">
                                  {noteContent}
                                </p>
                              )}
                            </div>
                          );
                        }
                        
                        // Old format: Try parsing with timestamps
                        const parsedNotes = parseNotes(notesText);
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
                        {notesText}
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
                    {shouldShowDisconnectButton(patient) && onEndCall && (
                      <button
                        onClick={() => onEndCall(patient)}
                        disabled={isDisconnectButtonDisabled(patient)}
                        className={`inline-flex items-center gap-1 px-2 py-1 border rounded text-[10px] font-semibold transition-colors ${
                          isDisconnectButtonDisabled(patient)
                            ? 'border-gray-300 text-gray-400 cursor-not-allowed bg-gray-50'
                            : 'border-red-600 text-red-600 hover:bg-red-50'
                        }`}
                        title={isDisconnectButtonDisabled(patient) ? "Processing post-call updates..." : "End call"}
                      >
                        <FiPhoneOff size={10} />
                        {isDisconnectButtonDisabled(patient) ? 'Processing...' : 'Disconnect'}
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
