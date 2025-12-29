import type { Patient } from '../types';
import { FiEye, FiPhone, FiPhoneOff, FiUser, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import {
  IconSortAscending,
  IconSortDescending,
  IconArrowsSort
} from '@tabler/icons-react';
import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { parseNotes } from '../utils/notesParser';

interface PatientTableProps {
  patients: Patient[];
  loading: boolean;
  onViewNotes?: (patient: Patient) => void;
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

export const PatientTable = ({
  patients,
  loading,
  onViewNotes,
  onCallPatient,
  onEndCall,
  onViewCallHistory,
  onViewDetails,
  onUpdatePatient,
  activeCalls = new Map(),
  selectedPatientIds = new Set(),
  onSelectionChange
}: PatientTableProps) => {
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([]);
  const [editingCell, setEditingCell] = useState<{ patientId: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  // Helper function to get full name
  const getFullName = (patient: Patient): string => {
    const first = patient.patient_first_name || '';
    const last = patient.patient_last_name || '';
    const fullName = `${first} ${last}`.trim();

    if (!fullName || /^MISSING(_\d+)?$/i.test(first) || /^MISSING(_\d+)?$/i.test(last) || /^MISSING(_\d+)?\s*MISSING(_\d+)?$/i.test(fullName)) {
      return 'Unknown';
    }

    return fullName || 'Unknown';
  };

  // Format currency
  const formatCurrency = (amount: string | number): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(numAmount);
  };

  // Format date string
  const formatDateString = (dateString: string): string => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return dateString;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[month - 1]} ${day}, ${year}`;
  };

  // Check if patient is paid
  const isPaid = (patient: Patient): boolean => {
    return patient.payment_status === 'completed' && parseFloat(patient.amount_paid || '0') > 0;
  };

  // Check if patient has missing data
  const hasMissingData = (patient: Patient): boolean => {
    const phone = patient.phone_number && patient.phone_number.toLowerCase() !== 'nan' && patient.phone_number.length >= 10;
    const firstName = patient.patient_first_name && patient.patient_first_name.toLowerCase() !== 'nan' && patient.patient_first_name !== '';
    const lastName = patient.patient_last_name && patient.patient_last_name.toLowerCase() !== 'nan' && patient.patient_last_name !== '';

    const hasValidFirstName = firstName && !/^MISSING(_\d+)?$/i.test(patient.patient_first_name || '');
    const hasValidLastName = lastName && !/^MISSING(_\d+)?$/i.test(patient.patient_last_name || '');

    return !phone || !hasValidFirstName || !hasValidLastName;
  };

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

  // Editable cell component with neumorphic styling
  const EditableCell = ({
    patient,
    field,
    displayValue,
    className = ''
  }: {
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
      return (
        <td className={className}>
          <div className="flex items-center gap-1.5 min-w-0">
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
              className="flex-1 min-w-0 px-1.5 py-0.5 text-xs neumorphic-inset rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              disabled={updating}
            />
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => handleSaveEdit(patient)}
                disabled={updating}
                className="p-0.5 text-green-600 hover:text-green-800 disabled:opacity-50 flex-shrink-0"
                title="Save"
              >
                <FiCheck size={12} />
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={updating}
                className="p-0.5 text-red-600 hover:text-red-800 disabled:opacity-50 flex-shrink-0"
                title="Cancel"
              >
                <FiX size={12} />
              </button>
            </div>
          </div>
        </td>
      );
    }

    return (
      <td className={`${className} group relative`}>
        <div className="flex items-center gap-1">
          <div
            className="flex-1"
            onClick={(e) => {
              if ((e.target as HTMLElement).tagName === 'BUTTON') {
                return;
              }
              handleStartEdit(patient, field);
            }}
          >
            {displayValue}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit(patient, field);
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-primary hover:text-primary/80 transition-opacity"
            title={`Edit ${field}`}
          >
            <FiEdit2 size={10} />
          </button>
        </div>
      </td>
    );
  };

  // Check if call is currently active
  const getPatientCallKey = (patient: Patient): string => {
    const phone = patient.phone_number || '';
    const invoice = patient.invoice_number || '';
    const firstName = patient.patient_first_name || '';
    const lastName = patient.patient_last_name || '';
    return `${phone}|${invoice}|${firstName}|${lastName}`;
  };

  const isCallActive = (patient: Patient): boolean => {
    const callKey = getPatientCallKey(patient);
    if (!callKey || !activeCalls.has(callKey)) return false;

    const callData = activeCalls.get(callKey)!;

    if (callData.twilioStatus) {
      const activeStatuses = ['queued', 'ringing', 'in-progress'];
      return activeStatuses.includes(callData.twilioStatus.toLowerCase());
    }

    const now = Date.now();
    const timeSinceCall = now - callData.timestamp;

    if (patient.call_status === 'completed' || patient.call_status === 'failed') {
      return false;
    }

    return timeSinceCall < 5 * 60 * 1000;
  };

  const shouldShowDisconnectButton = (patient: Patient): boolean => {
    const callKey = getPatientCallKey(patient);
    const callData = activeCalls.get(callKey);

    if (!callData) return false;

    const now = Date.now();
    const timeSinceCall = now - callData.timestamp;

    if (timeSinceCall > 10 * 60 * 1000) {
      return false;
    }

    return true;
  };

  const isDisconnectButtonDisabled = (patient: Patient): boolean => {
    const callKey = getPatientCallKey(patient);
    const callData = activeCalls.get(callKey);

    if (!callData) return false;

    if (callData.twilioStatus) {
      const apiStatus = callData.twilioStatus.toLowerCase();
      const callHasEnded = ['completed', 'busy', 'failed', 'no-answer', 'canceled', 'error', 'not_found'].includes(apiStatus);
      return callHasEnded;
    }

    const now = Date.now();
    const timeSinceCall = now - callData.timestamp;

    if (timeSinceCall < 10000) {
      return false;
    }

    if (patient.call_status === 'completed' || patient.call_status === 'failed') {
      return true;
    }

    return false;
  };

  const hasOutstandingBalance = (patient: Patient): boolean => {
    if (isPaid(patient)) return false;
    const outstanding = parseFloat(patient.outstanding_amount?.toString() || '0');
    return outstanding > 0;
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
      const newSelection = new Set(selectedPatientIds);
      visiblePatientIds.forEach(id => newSelection.delete(id));
      onSelectionChange(newSelection);
    } else {
      const newSelection = new Set(selectedPatientIds);
      visiblePatientIds.forEach(id => newSelection.add(id));
      onSelectionChange(newSelection);
    }
  };

  const allVisibleSelected = patients.length > 0 && patients
    .filter(p => p.id !== undefined)
    .every(p => selectedPatientIds.has(p.id as number));

  const someVisibleSelected = patients.some(p => p.id !== undefined && selectedPatientIds.has(p.id as number));

  // Set indeterminate state on select all checkbox
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  // Toggle sort
  const toggleSort = (column: SortColumn) => {
    setSortConfigs(prevConfigs => {
      const existingIndex = prevConfigs.findIndex(config => config.column === column);

      if (existingIndex !== -1) {
        const currentConfig = prevConfigs[existingIndex];

        if (currentConfig.direction === 'asc') {
          const newConfigs = [...prevConfigs];
          newConfigs[existingIndex] = {
            ...currentConfig,
            direction: 'desc' as SortDirection
          };
          return newConfigs;
        } else {
          return prevConfigs.filter((_, index) => index !== existingIndex);
        }
      } else {
        const newConfig = { column, direction: 'asc' as SortDirection };
        return [...prevConfigs, newConfig];
      }
    });
  };

  // Get sort state for a column
  const getSortState = (column: SortColumn): { active: boolean; direction?: SortDirection } => {
    const index = sortConfigs.findIndex(config => config.column === column);
    if (index === -1) {
      return { active: false };
    }
    return {
      active: true,
      direction: sortConfigs[index].direction
    };
  };

  // Sort patients based on current sort settings
  const sortPatients = (patientsToSort: Patient[]): Patient[] => {
    if (sortConfigs.length === 0) return patientsToSort;

    return [...patientsToSort].sort((a, b) => {
      for (const config of sortConfigs) {
        let comparison = 0;

        if (config.column === 'name') {
          const nameA = getFullName(a).toLowerCase();
          const nameB = getFullName(b).toLowerCase();
          comparison = nameA.localeCompare(nameB);
        } else if (config.column === 'date') {
          const hasDateA = !!a.invoice_date;
          const hasDateB = !!b.invoice_date;

          if (!hasDateA && !hasDateB) {
            comparison = 0;
          } else if (!hasDateA) {
            return 1;
          } else if (!hasDateB) {
            return -1;
          } else if (a.invoice_date && b.invoice_date) {
            const dateA = new Date(a.invoice_date).getTime();
            const dateB = new Date(b.invoice_date).getTime();
            comparison = dateA - dateB;
          }
        }

        const result = config.direction === 'asc' ? comparison : -comparison;

        if (result !== 0) {
          return result;
        }
      }

      return 0;
    });
  };

  // Separate patients into complete and missing records
  const sortedPatients = sortPatients(patients);

  // Loading state
  if (loading) {
    return (
      <div className="liquid-glass-table p-12 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-medium text-foreground">Loading patients...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (patients.length === 0) {
    return (
      <div className="liquid-glass-table p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 border border-white/30">
          <FiUser className="w-8 h-8 text-foreground" />
        </div>
        <p className="text-foreground text-xl font-bold mb-2">No patient data available</p>
        <p className="text-muted-foreground">Upload a CSV, XLSX, or XLS file to get started</p>
      </div>
    );
  }

  return (
    <div className="relative bg-gradient-to-br from-[#9a8ea2]/80 to-[#b0a4b2]/60 backdrop-blur-xl rounded-xl p-4 border-[3px] border-[#e8a855]/70 shadow-[0_0_30px_rgba(232,168,85,0.5),0_0_60px_rgba(232,168,85,0.2),0_8px_32px_rgba(150,130,160,0.25),inset_0_1px_0_rgba(255,255,255,0.4)] flex flex-col overflow-hidden glass-shine">
      {/* Glossy Top Highlight */}
      <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-white/25 via-white/10 to-transparent rounded-t-xl pointer-events-none" />

      <div className="overflow-hidden rounded-xl flex-1 flex flex-col relative z-10">
        {/* Fixed Header Table */}
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[3%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[7%]" />
            <col className="w-[5%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="bg-[#9a8ea2]">
            <tr>
              {/* Checkbox */}
              <th className="text-center font-semibold py-2 px-1 text-foreground text-sm">
                {onSelectionChange && (
                  <input
                    type="checkbox"
                    ref={selectAllCheckboxRef}
                    checked={allVisibleSelected}
                    onChange={handleSelectAll}
                    className="w-3 h-3 text-primary border-muted rounded focus:ring-primary cursor-pointer"
                    title={allVisibleSelected ? "Deselect all" : someVisibleSelected ? "Some selected" : "Select all"}
                  />
                )}
              </th>

              {/* Patient Name with Sort */}
              <th className="text-left font-semibold py-2 px-2 text-foreground text-sm">
                <div className="flex items-center gap-1 group">
                  <span>Patient Name</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => toggleSort('name')}
                          className="focus:outline-none"
                        >
                          {getSortState('name').active && getSortState('name').direction === 'asc' ? (
                            <IconSortAscending className="w-3 h-3 text-primary" />
                          ) : getSortState('name').active && getSortState('name').direction === 'desc' ? (
                            <IconSortDescending className="w-3 h-3 text-primary" />
                          ) : (
                            <IconArrowsSort className="w-3 h-3 text-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {getSortState('name').active
                          ? (getSortState('name').direction === 'asc' ? 'Sort Z to A' : 'Sort A to Z')
                          : 'Sort A to Z'
                        }
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </th>

              {/* Phone Number */}
              <th className="text-left font-semibold py-2 px-2 text-foreground text-sm">Phone</th>

              {/* Invoice Date with Sort */}
              <th className="text-left font-semibold py-2 px-2 text-foreground text-sm">
                <div className="flex items-center gap-1 group">
                  <span>Date</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => toggleSort('date')}
                          className="focus:outline-none"
                        >
                          {getSortState('date').active && getSortState('date').direction === 'asc' ? (
                            <IconSortAscending className="w-3 h-3 text-primary" />
                          ) : getSortState('date').active && getSortState('date').direction === 'desc' ? (
                            <IconSortDescending className="w-3 h-3 text-primary" />
                          ) : (
                            <IconArrowsSort className="w-3 h-3 text-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {getSortState('date').active
                          ? (getSortState('date').direction === 'asc' ? 'Sort Newest First' : 'Sort Oldest First')
                          : 'Sort Oldest First'
                        }
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </th>

              {/* Amount */}
              <th className="text-left font-semibold py-2 px-2 text-foreground text-sm">Amount</th>

              {/* Outstanding */}
              <th className="text-left font-semibold py-2 px-2 text-foreground text-sm">Outstanding</th>

              {/* Link Req */}
              <th className="text-center font-semibold py-2 px-1 text-foreground text-sm">Link Req</th>

              {/* Link Sent */}
              <th className="text-center font-semibold py-2 px-1 text-foreground text-sm">Link Sent</th>

              {/* Call Status */}
              <th className="text-center font-semibold py-2 px-1 text-foreground text-sm">Status</th>

              {/* Calls */}
              <th className="text-center font-semibold py-2 px-1 text-foreground text-sm">Calls</th>

              {/* Recent Notes */}
              <th className="text-left font-semibold py-2 px-2 text-foreground text-sm">Recent Notes</th>

              {/* Actions */}
              <th className="text-left font-semibold py-2 px-2 text-foreground text-sm">Actions</th>
            </tr>
          </thead>
        </table>

        {/* Scrollable Body Container */}
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto flex-1 bg-white/80 rounded-lg">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[3%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[7%]" />
              <col className="w-[8%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[5%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
            </colgroup>
            <tbody className="divide-y divide-[#9a8ea2]/30">


              {sortedPatients.map((patient, index) => {
                const isMissing = hasMissingData(patient);
                return (
                  <tr
                    key={patient.id || index}
                    className={`bg-transparent hover:bg-white/10 transition-all duration-200 ${isMissing ? 'bg-red-500/5' : ''} ${selectedPatientIds.has(patient.id as number) ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="py-2 px-1 text-center">

                      {onSelectionChange && patient.id !== undefined && (
                        <input
                          type="checkbox"
                          checked={selectedPatientIds.has(patient.id)}
                          onChange={() => handlePatientToggle(patient.id)}
                          className="w-3 h-3 text-primary border-muted rounded focus:ring-primary cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </td>

                    {/* Patient Name - Editable */}
                    <EditableCell
                      patient={patient}
                      field="patient_name"
                      displayValue={
                        <div className="flex items-center">
                          {getFullName(patient) !== 'Unknown' ? (
                            onViewDetails ? (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onViewDetails(patient);
                                }}
                                className="text-primary hover:text-primary/80 hover:underline font-medium transition-colors cursor-pointer text-left"
                              >
                                {getFullName(patient)}
                              </button>
                            ) : (
                              <span className="font-medium">{getFullName(patient)}</span>
                            )
                          ) : (
                            <span className="text-destructive italic font-semibold">Missing</span>
                          )}
                        </div>
                      }
                      className="py-2 px-2"
                    />

                    {/* Phone Number - Editable */}
                    <EditableCell
                      patient={patient}
                      field="phone_number"
                      displayValue={
                        patient.phone_number && patient.phone_number.toLowerCase() !== 'nan' && patient.phone_number.length >= 10 ? (
                          <span className="font-medium">{patient.phone_number}</span>
                        ) : (
                          <span className="text-destructive italic font-semibold">Missing</span>
                        )
                      }
                      className="py-2 px-2"
                    />

                    <td className="py-2 px-2 text-foreground">
                      {patient.invoice_date ? formatDateString(patient.invoice_date) : '-'}
                    </td>

                    {/* Amount - Editable */}
                    <EditableCell
                      patient={patient}
                      field="price"
                      displayValue={
                        patient.price ? (
                          <span className="font-semibold">{formatCurrency(patient.price)}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )
                      }
                      className="py-2 px-2"
                    />

                    {/* Outstanding - Editable */}
                    <EditableCell
                      patient={patient}
                      field="outstanding_amount"
                      displayValue={
                        isPaid(patient) ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-green-600 font-bold">Paid</span>
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(patient.amount_paid || '0')}
                            </span>
                          </div>
                        ) : patient.outstanding_amount && patient.outstanding_amount !== '' ? (
                          <span className="text-destructive font-bold">{formatCurrency(patient.outstanding_amount)}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )
                      }
                      className="py-2 px-2"
                    />

                    {/* Link Req */}
                    <td className="py-2 px-1 text-center">
                      {patient.link_requested ? (
                        patient.link_requested.toLowerCase() === 'yes' ? (
                          <span className="text-green-600 text-base font-bold" title="Yes">✓</span>
                        ) : patient.link_requested.toLowerCase() === 'no' ? (
                          <span className="text-destructive text-base font-bold" title="No">✗</span>
                        ) : (
                          <span className="px-2 py-1 bg-sky-500/20 text-sky-700 backdrop-blur-sm border border-sky-500/30 rounded-full text-xs font-medium">
                            {patient.link_requested}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Link Sent */}
                    <td className="py-2 px-1 text-center">
                      {patient.link_sent ? (
                        patient.link_sent.toLowerCase() === 'yes' ? (
                          <span className="text-green-600 text-base font-bold" title="Yes">✓</span>
                        ) : patient.link_sent.toLowerCase() === 'no' ? (
                          <span className="text-destructive text-base font-bold" title="No">✗</span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-700 backdrop-blur-sm border border-emerald-500/30 rounded-full text-xs font-medium">
                            {patient.link_sent}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Call Status */}
                    <td className="py-2 px-1 text-center">
                      {patient.call_status ? (
                        patient.call_status === 'completed' ? (
                          <span className="text-green-600 text-base font-bold" title="Completed">✓</span>
                        ) : patient.call_status === 'failed' ? (
                          <span className="text-destructive text-base font-bold" title="Failed">✗</span>
                        ) : (
                          <span className="px-2 py-1 bg-amber-500/20 text-amber-700 backdrop-blur-sm border border-amber-500/30 rounded-full text-xs font-medium">
                            {patient.call_status.charAt(0).toUpperCase() + patient.call_status.slice(1)}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Calls */}
                    <td className="py-2 px-1 text-center">
                      {onViewCallHistory ? (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onViewCallHistory(patient);
                          }}
                          className="font-semibold hover:text-primary transition-colors"
                        >
                          {patient.call_count || 0}
                        </button>
                      ) : (
                        <span className="font-semibold">{patient.call_count || 0}</span>
                      )}
                    </td>

                    {/* Recent Notes */}
                    <td className="py-2 px-2">
                      {patient.recent_call_notes && patient.recent_call_notes.trim() ? (
                        <div className="group relative">
                          {(() => {
                            const notesText = patient.recent_call_notes;
                            if (notesText.startsWith('Attempt ')) {
                              const lines = notesText.split('\n');
                              const attemptLabel = lines[0];
                              const noteContent = lines.slice(1).join('\n').trim();

                              return (
                                <div className="space-y-0.5">
                                  <span className="text-xs text-foreground font-bold block">
                                    {attemptLabel}
                                  </span>
                                  {noteContent && (
                                    <p className="text-xs text-muted-foreground leading-tight break-words">
                                      {noteContent}
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            const parsedNotes = parseNotes(notesText);
                            const latestNote = parsedNotes.length > 0 ? parsedNotes[parsedNotes.length - 1] : null;

                            if (latestNote && latestNote.timestamp) {
                              return (
                                <div className="space-y-0.5">
                                  <span className="text-xs text-muted-foreground font-medium">
                                    {latestNote.timestamp.split(' ')[0]}
                                  </span>
                                  <p className="text-xs text-foreground leading-tight break-words">
                                    {latestNote.content}
                                  </p>
                                  {parsedNotes.length > 1 && (
                                    <p className="text-xs text-muted-foreground/70 italic">
                                      +{parsedNotes.length - 1} more
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <p className="text-xs text-foreground leading-tight whitespace-pre-wrap break-words">
                                {notesText}
                              </p>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">No notes</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-2">
                      <div className="flex flex-col gap-1">

                        {/* Call buttons */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {hasOutstandingBalance(patient) && onCallPatient && (
                            !patient.phone_number || patient.phone_number.toLowerCase() === 'nan' || patient.phone_number.length < 10 ? (
                              <Button
                                size="sm"
                                disabled
                                className="neumorphic-button-primary px-4 py-2 h-auto text-sm"
                                title="Phone number is missing or invalid"
                              >
                                <FiPhone className="w-4 h-4" />
                                <span>Missing</span>
                              </Button>
                            ) : !patient.patient_first_name || !patient.patient_last_name || patient.patient_first_name.toLowerCase() === 'nan' || patient.patient_last_name.toLowerCase() === 'nan' ? (
                              <Button
                                size="sm"
                                disabled
                                className="neumorphic-button-primary px-4 py-2 h-auto text-sm"
                                title="Patient name is missing"
                              >
                                <FiPhone className="w-4 h-4" />
                                <span>Missing</span>
                              </Button>
                            ) : isCallActive(patient) ? (
                              <Button
                                size="sm"
                                disabled
                                className="neumorphic-button-primary px-4 py-2 h-auto text-sm"
                                title="Call in progress..."
                              >
                                <FiPhone className="w-4 h-4" />
                                <span>Calling...</span>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="neumorphic-button-primary px-4 py-2 h-auto text-sm"
                                onClick={() => onCallPatient(patient)}
                                title="Call patient"
                              >
                                <FiPhone className="w-4 h-4" />
                                <span>Call</span>
                              </Button>
                            )
                          )}

                          {shouldShowDisconnectButton(patient) && onEndCall && (
                            <Button
                              size="sm"
                              className="neumorphic-button-primary px-4 py-2 h-auto text-sm"
                              onClick={() => onEndCall(patient)}
                              disabled={isDisconnectButtonDisabled(patient)}
                              title={isDisconnectButtonDisabled(patient) ? "Processing post-call updates..." : "End call"}
                            >
                              <FiPhoneOff className="w-4 h-4" />
                              <span>{isDisconnectButtonDisabled(patient) ? 'Processing...' : 'Disconnect'}</span>
                            </Button>
                          )}
                        </div>

                        {/* Notes button */}
                        {(patient.call_count || 0) > 0 && onViewNotes && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              className="neumorphic-button-primary px-4 py-2 h-auto text-sm"
                              onClick={() => onViewNotes(patient)}
                              title="View notes"
                            >
                              <FiEye className="w-4 h-4" />
                              <span>Notes</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PatientTable;


