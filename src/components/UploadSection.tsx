import { useState, useMemo, useRef } from 'react';
import { FileSelectorDropdown, PatientTable, ConfirmModal } from './';
import { AppointmentsModal } from './AppointmentsModal';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { Patient } from '../types';
import { FiDownload, FiPhone, FiUpload } from 'react-icons/fi';
import { IconFilter } from '@tabler/icons-react';
import { exportARTestingCSV, updatePatient, exportSelectedPatients } from '../services/api';
import api from '../services/api';

interface FileOption {
  id: number;
  filename: string;
  displayName: string;
  uploaded_at: string | null;
  patient_count: number;
}

interface UploadSectionProps {
  availableFiles: FileOption[];
  selectedUploadId: number | null;
  patients: Patient[];
  loading: boolean;
  uploadLoading: boolean;
  callingInProgress: boolean;
  activeCalls: Map<string, { timestamp: number; conversationId?: string; callSid?: string; twilioStatus?: string }>;
  batchCallProgress: { total: number; completed: number } | null;
  currentFile: string;
  onFileUpload: (file: File) => Promise<void>;
  onFileSelect: (uploadId: number | null) => Promise<void>;
  onBatchCall: (invoiceIds?: number[]) => void;  // Pass filtered invoice IDs
  onViewNotes: (patient: Patient) => void;
  onCallPatient: (patient: Patient) => void;
  onEndCall: (patient: Patient) => void;
  onViewCallHistory: (patient: Patient) => void;
  onViewDetails: (patient: Patient) => void;
  onRefreshPatients?: () => Promise<void>;
}

type CallStatusFilter = 'all' | 'pending' | 'sent' | 'completed';

export const UploadSection = ({
  availableFiles,
  selectedUploadId,
  patients,
  loading,
  uploadLoading,
  callingInProgress,
  activeCalls,
  batchCallProgress,
  currentFile,
  onFileUpload,
  onFileSelect,
  onBatchCall,
  onViewNotes,
  onCallPatient,
  onEndCall,
  onViewCallHistory,
  onViewDetails,
  onRefreshPatients,
}: UploadSectionProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [callStatusFilter, setCallStatusFilter] = useState<CallStatusFilter>('all');
  const [showBatchCallModal, setShowBatchCallModal] = useState(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<number>>(new Set());
  const [showSelectedCallModal, setShowSelectedCallModal] = useState(false);
  const [downloadingARTesting, setDownloadingARTesting] = useState(false);
  const [downloadingSelected, setDownloadingSelected] = useState(false);
  const [appointmentsPatient, setAppointmentsPatient] = useState<Patient | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // File upload handlers
  const validateFile = (file: File): boolean => {
    const validExtensions = ['.csv', '.xlsx', '.xls', '.pdf'];
    const isValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!isValid) {
      alert('Please select a CSV, XLSX, XLS, or PDF file');
      return false;
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (validateFile(file)) {
        // Auto-upload immediately on file selection
        onFileUpload(file);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Export AR Testing format CSV
  // Handle patient update
  const handleUpdatePatient = async (invoiceId: number, updates: Record<string, string | number>) => {
    try {
      await updatePatient(invoiceId, updates);
      // Refresh patient data after update
      if (onRefreshPatients) {
        await onRefreshPatients();
      }
    } catch (error) {
      console.error('Failed to update patient:', error);
      throw error; // Re-throw to let PatientTable handle the error display
    }
  };

  // Handle export selected patients
  const handleExportSelected = async () => {
    if (filteredPatients.length === 0 || downloadingSelected) return;

    try {
      setDownloadingSelected(true);
      const invoiceIds = filteredPatients
        .filter(p => p.id)
        .map(p => p.id!);

      if (invoiceIds.length === 0) {
        alert('No patients selected to export');
        return;
      }

      const blob = await exportSelectedPatients(invoiceIds);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `selected_patients_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export selected patients:', error);
      alert('Failed to export selected patients. Please try again.');
    } finally {
      setDownloadingSelected(false);
    }
  };

  const handleExportARTesting = async () => {
    if (downloadingARTesting) return;

    try {
      setDownloadingARTesting(true);
      const filename = selectedUploadId
        ? (() => {
          const selectedUpload = availableFiles.find(f => f.id === selectedUploadId);
          return selectedUpload?.filename || currentFile;
        })()
        : currentFile;

      const blob = await exportARTestingCSV(filename, selectedUploadId || undefined);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const downloadFilename = filename.replace('.csv', '') + '_AR_Testing.csv';
      link.setAttribute('download', downloadFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export AR Testing CSV:', error);
      alert('Failed to export AR Testing CSV. Please try again.');
    } finally {
      setDownloadingARTesting(false);
    }
  };


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
          return !status || status === 'pending' || status === '';
        } else if (callStatusFilter === 'sent') {
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
    <div className="space-y-4">
      {/* Combined View Patients Section */}
      <div className="liquid-glass-table p-4 space-y-4 overflow-visible">

        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">Manage and export patient data</h3>
          </div>
          <label
            className={`relative overflow-hidden rounded-xl px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 transition-all duration-300 group
              bg-gradient-to-br from-primary/80 to-[#26C6C0]/80 backdrop-blur-xl border border-white/30
              shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_0_25px_rgba(14,165,163,0.4)]
              hover:scale-[1.02] text-white ${uploadLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {/* Sliding Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />
            <FiUpload size={16} className="relative z-10" />
            <span className="relative z-10">{uploadLoading ? 'Uploading...' : 'Upload New File'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              onChange={handleFileChange}
              disabled={uploadLoading}
              className="hidden"
            />
          </label>
        </div>


        {/* File Selection Section */}
        <div className="space-y-2 -mt-2 relative z-50 overflow-visible">
          <label className="block text-sm text-foreground font-semibold tracking-wide">
            Selected File
          </label>
          <FileSelectorDropdown
            options={availableFiles}
            selectedUploadId={selectedUploadId}
            onSelect={onFileSelect}
          />
        </div>


        {/* Batch Call Progress Bar */}
        {batchCallProgress && batchCallProgress.total > 0 && (
          <div className="liquid-glass-subtle p-3 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-primary">
                Batch Call Progress
              </span>
              <span className="text-sm font-medium text-foreground">
                {batchCallProgress.completed} / {batchCallProgress.total} completed
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden border border-white/30">
              <div
                className="bg-gradient-to-r from-primary to-[#26C6C0] h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(14,165,163,0.5)]"
                style={{
                  width: `${Math.min(100, (batchCallProgress.completed / batchCallProgress.total) * 100)}%`
                }}
              />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {batchCallProgress.completed === batchCallProgress.total
                ? 'All calls completed!'
                : `Processing ${batchCallProgress.total - batchCallProgress.completed} remaining call${batchCallProgress.total - batchCallProgress.completed !== 1 ? 's' : ''}...`}
            </div>
          </div>
        )}

        {/* All Patients Section */}
        <div className="space-y-4 pt-2 border-t border-white/20">

          {/* Title */}
          {/* <div>
            <h3 className="text-lg font-bold text-foreground">
              All Patients {selectedUploadId ? `(${availableFiles.find(f => f.id === selectedUploadId)?.displayName || 'Selected File'})` : '(All Files)'}
            </h3>
          </div> */}

          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                placeholder="Search by patient name or phone..."
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

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/20">

            {/* Call-related buttons on the left */}
            <div className="flex flex-wrap gap-2">
              <Button
                className="liquid-glass-btn-primary"
                onClick={() => onBatchCall()}
                disabled={patients.length === 0 || callingInProgress}
              >
                <FiPhone size={18} />
                <span>{callingInProgress ? 'Calling...' : 'Start Calls'}</span>
              </Button>

              {selectedPatientIds.size > 0 && (
                <Button
                  className="liquid-glass-btn-primary text-sm"
                  onClick={() => setShowSelectedCallModal(true)}
                  disabled={callingInProgress}
                >
                  {callingInProgress ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Calling...</span>
                    </>
                  ) : (
                    <>
                      <FiPhone className="w-4 h-4" />
                      <span>Call Selected ({selectedPatientIds.size})</span>
                    </>
                  )}
                </Button>
              )}

              {filteredPatients.length > 0 && (callStatusFilter !== 'all' || searchTerm.trim()) && selectedPatientIds.size === 0 && (
                <Button
                  className="liquid-glass-btn-primary text-sm"
                  onClick={() => setShowBatchCallModal(true)}
                  disabled={callingInProgress}
                >
                  {callingInProgress ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Calling...</span>
                    </>
                  ) : (
                    <>
                      <FiPhone className="w-4 h-4" />
                      <span>Call Filtered ({filteredPatients.length})</span>
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Download/Export-related buttons on the right */}
            <div className="flex flex-wrap gap-2">
              {/* Export AR Testing CSV button - Only show when a specific file is selected (not All Patients) */}
              {selectedUploadId && patients.length > 0 && (
                <Button
                  className="liquid-glass-btn-primary"
                  onClick={handleExportARTesting}
                  disabled={downloadingARTesting}
                  title="Export AR Testing format CSV"
                >
                  {downloadingARTesting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <FiDownload size={18} />
                      <span>Export Invoice File</span>
                    </>
                  )}
                </Button>
              )}

              {/* Export Selected Button */}
              {filteredPatients.length > 0 && (searchTerm.trim() || callStatusFilter !== 'all') && (
                <Button
                  className="liquid-glass-btn-primary text-sm"
                  onClick={handleExportSelected}
                  disabled={downloadingSelected || filteredPatients.length === 0}
                  title="Export filtered/selected patients as CSV"
                >
                  <FiDownload size={16} />
                  <span>{downloadingSelected ? 'Exporting...' : 'Export Selected'}</span>
                </Button>
              )}

              {/* Export Results Button */}
              {patients.length > 0 && (
                <Button
                  className="liquid-glass-btn-primary text-sm"
                  onClick={async () => {
                    if (patients.length === 0) return;

                    try {
                      const filename = selectedUploadId
                        ? (() => {
                          const selectedUpload = availableFiles.find(f => f.id === selectedUploadId);
                          return selectedUpload?.filename || currentFile;
                        })()
                        : currentFile;

                      const params: { upload_id?: number } = {};
                      if (selectedUploadId) {
                        params.upload_id = selectedUploadId;
                      }

                      const response = await api.get(`/download/${filename}`, {
                        params,
                        responseType: 'blob',
                      });

                      const blob = new Blob([response.data], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;

                      const contentDisposition = response.headers['content-disposition'];
                      let downloadFilename = filename;
                      if (contentDisposition) {
                        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/i);
                        if (filenameMatch) {
                          downloadFilename = filenameMatch[1];
                        }
                      }

                      if (!downloadFilename.endsWith('.csv')) {
                        downloadFilename = `${downloadFilename}.csv`;
                      }

                      link.setAttribute('download', downloadFilename);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (err) {
                      console.error('Download failed:', err);
                      let errorMessage = 'Failed to download file';
                      const error = err as { response?: { status?: number; data?: Blob | { detail?: string; message?: string } }; message?: string };

                      if (error.response?.data instanceof Blob) {
                        try {
                          const text = await error.response.data.text();
                          const jsonError = JSON.parse(text) as { detail?: string; message?: string };
                          errorMessage = jsonError.detail || jsonError.message || errorMessage;
                        } catch {
                          errorMessage = error.response?.status === 401
                            ? 'Not authenticated. Please log in again.'
                            : 'Failed to download file';
                        }
                      } else {
                        const data = error.response?.data as { detail?: string; message?: string } | undefined;
                        errorMessage = data?.detail || data?.message || error.message || errorMessage;
                      }

                      alert(`Download failed: ${errorMessage}`);

                      if (error.response?.status === 401) {
                        const shouldRelogin = confirm('Your session may have expired. Would you like to reload the page to log in again?');
                        if (shouldRelogin) {
                          window.location.reload();
                        }
                      }
                    }
                  }}
                  disabled={patients.length === 0}
                  title="Export Results"
                >
                  <FiDownload size={16} />
                  <span>Export Results</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Patient Table */}
      <PatientTable
        patients={filteredPatients}
        loading={loading}
        onViewNotes={onViewNotes}
        onCallPatient={onCallPatient}
        onEndCall={onEndCall}
        onViewCallHistory={onViewCallHistory}
        onViewDetails={onViewDetails}
        onViewAppointments={(patient) => setAppointmentsPatient(patient)}
        onUpdatePatient={handleUpdatePatient}
        activeCalls={activeCalls}
        selectedPatientIds={selectedPatientIds}
        onSelectionChange={setSelectedPatientIds}
      />

      {/* Selected Patients Call Confirmation Modal */}
      <ConfirmModal
        isOpen={showSelectedCallModal}
        title="Initiate Calls to Selected Patients"
        message={`You are about to initiate calls to ${selectedPatientIds.size} selected patient${selectedPatientIds.size !== 1 ? 's' : ''}. Calls will be made automatically and summaries will be generated after each call completes. Patients with the same phone number will be grouped into a single call.`}
        onConfirm={() => {
          setShowSelectedCallModal(false);
          // Capture invoice IDs before clearing selection to prevent count changes
          const selectedInvoiceIds = Array.from(selectedPatientIds);
          // Clear selection immediately to prevent UI issues
          setSelectedPatientIds(new Set());
          // Pass selected patient invoice IDs (this will skip App.tsx modal)
          onBatchCall(selectedInvoiceIds.length > 0 ? selectedInvoiceIds : undefined);
        }}
        onCancel={() => setShowSelectedCallModal(false)}
      />

      {/* Batch Call Confirmation Modal */}
      <ConfirmModal
        isOpen={showBatchCallModal}
        title="Start Batch Calls"
        message={`You are about to initiate calls to ${filteredPatients.length} filtered patient${filteredPatients.length !== 1 ? 's' : ''}. Calls will be made automatically and summaries will be generated after each call completes.`}
        onConfirm={() => {
          setShowBatchCallModal(false);
          // Pass filtered patient invoice IDs
          const filteredInvoiceIds = filteredPatients
            .filter(p => p.id !== undefined)
            .map(p => p.id as number);
          onBatchCall(filteredInvoiceIds.length > 0 ? filteredInvoiceIds : undefined);
        }}
        onCancel={() => setShowBatchCallModal(false)}
      />

      {/* Appointments Modal */}
      {appointmentsPatient && (
        <AppointmentsModal
          patient={appointmentsPatient}
          onClose={() => setAppointmentsPatient(null)}
          isOpen={true}
        />
      )}
    </div>
  );
};

