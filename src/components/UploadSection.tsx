import { useState, useMemo, useEffect, useRef } from 'react';
import { FileUpload, FileSelectorDropdown, BatchCallButton, DownloadButton, PatientTable, ConfirmModal } from './';
import type { Patient } from '../types';
import { FiSearch, FiX, FiChevronDown, FiCheck } from 'react-icons/fi';

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
  activeCalls: Map<string, number>;
  currentFile: string;
  onFileUpload: (file: File) => Promise<void>;
  onFileSelect: (uploadId: number | null) => Promise<void>;
  onBatchCall: () => void;
  onViewNotes: (patient: Patient) => void;
  onCallPatient: (patient: Patient) => void;
  onViewCallHistory: (patient: Patient) => void;
  onViewDetails: (patient: Patient) => void;
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
  currentFile,
  onFileUpload,
  onFileSelect,
  onBatchCall,
  onViewNotes,
  onCallPatient,
  onViewCallHistory,
  onViewDetails,
}: UploadSectionProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [callStatusFilter, setCallStatusFilter] = useState<CallStatusFilter>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showBatchCallModal, setShowBatchCallModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setIsDropdownOpen(false);
    };

    if (isDropdownOpen) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside, true);
      }, 0);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside, true);
      };
    }
  }, [isDropdownOpen]);

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

  const selectedFilterOption = filterOptions.find(opt => opt.value === callStatusFilter);

  return (
    <div className="space-y-6">
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left Section: Upload CSV */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload CSV File</h2>
          <FileUpload onUpload={onFileUpload} loading={uploadLoading} />
        </div>

        {/* Right Section: Patient Display Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">View Patients</h2>
          
          {/* File Selector */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">
              Select CSV File
            </label>
            <FileSelectorDropdown
              options={availableFiles}
              selectedUploadId={selectedUploadId}
              onSelect={onFileSelect}
            />
          </div>

          {/* Patient Count & Actions */}
          <div className="space-y-3">
            <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Patients</p>
                  <p className="text-sm text-gray-900 font-medium mt-0.5">
                    {selectedUploadId 
                      ? (() => {
                          const selectedUpload = availableFiles.find(f => f.id === selectedUploadId);
                          return selectedUpload ? `From: ${selectedUpload.displayName}` : 'All Files';
                        })()
                      : 'All Files'}
                  </p>
                </div>
                <span className="px-3 py-1 bg-gray-600 text-white text-xs font-semibold rounded-full">
                  {loading ? (
                    <span className="flex items-center gap-1.5">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Loading...
                    </span>
                  ) : (
                    `${patients.length} patients`
                  )}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <BatchCallButton 
                onClick={onBatchCall}
                disabled={patients.length === 0 || callingInProgress}
                loading={callingInProgress}
              />
              
              <DownloadButton 
                filename={selectedUploadId 
                  ? (() => {
                      const selectedUpload = availableFiles.find(f => f.id === selectedUploadId);
                      return selectedUpload?.filename || currentFile;
                    })()
                  : currentFile}
                uploadId={selectedUploadId || undefined}
                disabled={patients.length === 0}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Patient Table with Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header with Search and Filter */}
        <div className="px-6 py-4 border-b border-gray-200">
          {/* Title on Left, Search and Filter on Right */}
          <div className="flex items-center justify-between gap-4">
            {/* Title - Left Side */}
            <div className="flex-shrink-0">
              <h3 className="text-xl font-bold text-gray-900 whitespace-nowrap">All Patients</h3>
              <p className="text-xs text-gray-500 whitespace-nowrap">
                {filteredPatients.length} of {patients.length}
              </p>
            </div>

            {/* Search and Filter - Right Side */}
            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="w-80 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by patient name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-9 pr-9 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Custom Filter Dropdown */}
              <div className="w-56 flex-shrink-0 relative" ref={dropdownRef}>
                <button
                  ref={buttonRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(!isDropdownOpen);
                  }}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 font-medium flex items-center justify-between hover:border-teal-500 hover:shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                >
                  <span className="truncate">
                    {selectedFilterOption?.label} ({selectedFilterOption?.count})
                  </span>
                  <FiChevronDown 
                    className={`ml-2 h-5 w-5 text-gray-500 flex-shrink-0 transition-transform duration-200 ${
                      isDropdownOpen ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>

                {isDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-xl border border-gray-200 py-2">
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setCallStatusFilter(option.value as CallStatusFilter);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                          callStatusFilter === option.value
                            ? 'bg-teal-50 text-teal-700 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>{option.label} ({option.count})</span>
                        {callStatusFilter === option.value && (
                          <FiCheck className="h-5 w-5 text-teal-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Active Filters and Batch Call */}
          {(searchTerm || callStatusFilter !== 'all' || (callStatusFilter === 'all' && filteredPatients.length > 0)) && (
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                {(searchTerm || callStatusFilter !== 'all') && (
                  <>
                    <span className="text-xs text-gray-600">Active:</span>
                    {searchTerm && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 rounded text-xs">
                        "{searchTerm}"
                        <button onClick={() => setSearchTerm('')} className="hover:text-teal-900">
                          <FiX className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {callStatusFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 rounded text-xs">
                        {callStatusFilter}
                        <button onClick={() => setCallStatusFilter('all')} className="hover:text-teal-900">
                          <FiX className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </>
                )}
                <span className="text-xs text-gray-500">
                  ({filteredPatients.length} {filteredPatients.length === 1 ? 'patient' : 'patients'})
                </span>
              </div>
              
              {/* Batch Call Button for All or Filtered Results */}
              {filteredPatients.length > 0 && (
                <button
                  onClick={() => setShowBatchCallModal(true)}
                  disabled={callingInProgress}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    callingInProgress
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-teal-600 text-white hover:bg-teal-700 hover:shadow-md'
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
              )}
            </div>
          )}
        </div>

        {/* Patient Table */}
        <PatientTable 
          patients={filteredPatients} 
          loading={loading} 
          onViewNotes={onViewNotes}
          onCallPatient={onCallPatient}
          onViewCallHistory={onViewCallHistory}
          onViewDetails={onViewDetails}
          activeCalls={activeCalls}
        />
      </div>

      {/* Batch Call Confirmation Modal */}
      <ConfirmModal
        isOpen={showBatchCallModal}
        title="Start Batch Calls"
        message={`You are about to initiate calls to ${filteredPatients.length} filtered patient${filteredPatients.length !== 1 ? 's' : ''}. Calls will be made automatically and summaries will be generated after each call completes.`}
        onConfirm={() => {
          setShowBatchCallModal(false);
          onBatchCall();
        }}
        onCancel={() => setShowBatchCallModal(false)}
      />
    </div>
  );
};

