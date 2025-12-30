import { useState, useEffect, useMemo } from 'react';
import type { Patient } from '../types';
import { getAllPatients } from '../services/api';
import { PatientTable } from './PatientTable';
import { ConfirmModal } from './ConfirmModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { IconFilter } from '@tabler/icons-react';

interface PatientsTabProps {
  onViewNotes: (patient: Patient) => void;
  onViewCallHistory: (patient: Patient) => void;
  onViewDetails: (patient: Patient) => void;
  onBatchCall?: (invoiceIds?: number[]) => void;  // Pass filtered invoice IDs
  callingInProgress?: boolean;
  showMessage: (type: 'success' | 'error' | 'info', text: string) => void;
}

type CallStatusFilter = 'all' | 'pending' | 'sent' | 'completed';

export const PatientsTab = ({
  onViewNotes,
  onViewCallHistory,
  onViewDetails,
  onBatchCall,
  callingInProgress = false,
  showMessage
}: PatientsTabProps) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [callStatusFilter, setCallStatusFilter] = useState<CallStatusFilter>('all');
  const [showBatchCallModal, setShowBatchCallModal] = useState(false);

  // Load all patients
  const loadPatients = async () => {
    try {
      setLoading(true);
      const response = await getAllPatients();
      if (response.success) {
        setPatients(response.patients || []);
      } else {
        showMessage('error', 'Failed to load patients');
      }
    } catch (error) {
      console.error('Failed to load patients:', error);
      showMessage('error', 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter and search patients
  const filteredPatients = useMemo(() => {
    let filtered = [...patients];

    // Apply search filter (name or phone number)
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(patient => {
        const fullName = `${patient.patient_first_name || ''} ${patient.patient_last_name || ''}`.toLowerCase();
        const phone = (patient.phone_number || '').toLowerCase();
        return fullName.includes(search) || phone.includes(search);
      });
    }

    // Apply call status filter
    if (callStatusFilter !== 'all') {
      filtered = filtered.filter(patient => {
        const status = (patient.call_status || '').toLowerCase();
        
        if (callStatusFilter === 'pending') {
          // Pending: no call made yet or call_status is empty/pending
          return !status || status === 'pending' || status === '';
        } else if (callStatusFilter === 'sent') {
          // Sent: call initiated but not completed
          return status === 'initiated' || status === 'in_progress' || status === 'sent';
        } else if (callStatusFilter === 'completed') {
          // Completed calls
          return status === 'completed';
        }
        return true;
      });
    }

    return filtered;
  }, [patients, searchTerm, callStatusFilter]);

  // Get filter counts
  const filterCounts = useMemo(() => {
    const counts = {
      all: patients.length,
      pending: 0,
      sent: 0,
      completed: 0
    };

    patients.forEach(patient => {
      const status = (patient.call_status || '').toLowerCase();
      
      if (!status || status === 'pending' || status === '') {
        counts.pending++;
      } else if (status === 'initiated' || status === 'in_progress' || status === 'sent') {
        counts.sent++;
      } else if (status === 'completed') {
        counts.completed++;
      }
    });

    return counts;
  }, [patients]);

  const filterOptions = [
    { value: 'all', label: 'All calls', count: filterCounts.all },
    { value: 'pending', label: 'Pending calls', count: filterCounts.pending },
    { value: 'sent', label: 'Sent calls', count: filterCounts.sent },
    { value: 'completed', label: 'Completed calls', count: filterCounts.completed }
  ];

  return (
    <>
      {/* Header Section */}
      <div className="mb-4">
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          {/* Search Input */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              type="text"
              placeholder="Search by patient name or phone number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 h-9 px-3 text-sm liquid-glass-input !rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <IconFilter className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium whitespace-nowrap hidden sm:inline">Filter by:</span>
            <Select value={callStatusFilter} onValueChange={(value) => setCallStatusFilter(value as CallStatusFilter)}>
              <SelectTrigger className="w-48 liquid-glass-input border-white/30 !rounded-full">
                <SelectValue placeholder="Select filter" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Batch Call Button for Filtered Results */}
        {onBatchCall && filteredPatients.length > 0 && (callStatusFilter !== 'all' || searchTerm.trim()) && (
          <div className="flex items-center justify-end mt-3">
            <button
              onClick={() => setShowBatchCallModal(true)}
              disabled={callingInProgress}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                callingInProgress
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'liquid-glass-btn-primary'
              }`}
            >
              {callingInProgress ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Calling...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>Call Filtered ({filteredPatients.length})</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Patient Table */}
      <PatientTable
        patients={filteredPatients}
        loading={loading}
        onViewNotes={onViewNotes}
        onViewCallHistory={onViewCallHistory}
        onViewDetails={onViewDetails}
      />

      {/* Batch Call Confirmation Modal */}
      <ConfirmModal
        isOpen={showBatchCallModal}
        title="Start Batch Calls"
        message={`You are about to initiate calls to ${filteredPatients.length} filtered patient${filteredPatients.length !== 1 ? 's' : ''}. Calls will be made automatically and summaries will be generated after each call completes.`}
        onConfirm={() => {
          setShowBatchCallModal(false);
          if (onBatchCall) {
            // Pass filtered patient invoice IDs
            const filteredInvoiceIds = filteredPatients
              .filter(p => p.id !== undefined)
              .map(p => p.id as number);
            onBatchCall(filteredInvoiceIds.length > 0 ? filteredInvoiceIds : undefined);
          }
        }}
        onCancel={() => setShowBatchCallModal(false)}
      />
    </>
  );
};

export default PatientsTab;

