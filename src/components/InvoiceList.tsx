import { useEffect, useState } from 'react';
import { getFileUploadHistory, getPatientsByUploadId, callPatient } from '../services/api';
import type { Patient } from '../types';
import { formatDateTime } from '../utils/timezone';
import { PatientTable } from './PatientTable';
import { CallHistoryModal } from './CallHistoryModal';
import { NotesModal } from './NotesModal';
import { PatientDetails } from './PatientDetails';
import { ConfirmModal } from './ConfirmModal';
import { MessageAlert } from './MessageAlert';

interface FileUpload {
  id: number;
  filename: string;
  uploaded_at: string | null;
  patient_count: number;
  new_count: number;
  updated_count: number;
  error_count: number;
}

interface InvoiceListProps {
  onFileSelect?: (uploadId: number) => void;
}

export const InvoiceList = ({ onFileSelect }: InvoiceListProps) => {
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUploadId, setSelectedUploadId] = useState<number | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [showCallHistoryModal, setShowCallHistoryModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showCallConfirmModal, setShowCallConfirmModal] = useState(false);
  const [showPatientDetailsModal, setShowPatientDetailsModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientToCall, setPatientToCall] = useState<Patient | null>(null);
  const [activeCalls, setActiveCalls] = useState<Map<string, number>>(new Map());
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);


  const loadUploads = async () => {
    try {
      setLoading(true);
      const response = await getFileUploadHistory();
      setUploads(response.history || []);
    } catch (error) {
      console.error('Failed to load uploads:', error);
      setUploads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUploads();
  }, []);

  const handleOpenUpload = async (uploadId: number) => {
    setSelectedUploadId(uploadId);
    setLoadingPatients(true);
    try {
      const response = await getPatientsByUploadId(uploadId);
      setPatients(response.patients || []);
      if (onFileSelect) {
        onFileSelect(uploadId);
      }
    } catch (error) {
      console.error('Failed to load patients:', error);
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  };

  const handleBack = () => {
    setSelectedUploadId(null);
    setPatients([]);
  };

  const handleViewNotes = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowNotesModal(true);
  };

  const handleViewCallHistory = (patient: Patient) => {
    if (!patient) {
      showMessage('error', 'Cannot view call history: Patient information is missing');
      return;
    }
    const phone = patient.phone_number && patient.phone_number.toLowerCase() !== 'nan' ? patient.phone_number : '';
    const invoice = patient.invoice_number && patient.invoice_number.toLowerCase() !== 'nan' ? patient.invoice_number : '';
    
    if (!phone) {
      showMessage('error', 'Cannot view call history: Phone number is missing or invalid');
      return;
    }
    if (!invoice) {
      showMessage('error', 'Cannot view call history: Invoice number is missing');
      return;
    }
    setSelectedPatient(patient);
    setShowCallHistoryModal(true);
  };

  const handleViewDetails = (patient: Patient) => {
    console.log('handleViewDetails called with patient:', patient);
    console.log('Patient ID:', patient.id);
    console.log('Phone:', patient.phone_number);
    console.log('Invoice:', patient.invoice_number);
    console.log('First Name:', patient.patient_first_name);
    console.log('Last Name:', patient.patient_last_name);
    setSelectedPatient(patient);
    setShowPatientDetailsModal(true);
  };

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCallPatient = (patient: Patient) => {
    const phone = patient.phone_number && patient.phone_number.toLowerCase() !== 'nan' ? patient.phone_number : '';
    const invoice = patient.invoice_number && patient.invoice_number.toLowerCase() !== 'nan' ? patient.invoice_number : '';
    
    if (!phone || phone.length < 10) {
      showMessage('error', 'Cannot make call: Phone number is missing or invalid (minimum 10 digits required)');
      return;
    }
    if (!invoice) {
      showMessage('error', 'Cannot make call: Invoice number is missing (required for identification)');
      return;
    }
    
    // Show confirmation modal first
    setPatientToCall(patient);
    setShowCallConfirmModal(true);
  };

  // Helper function to create unique key for each patient record
  const getPatientCallKey = (patient: Patient): string => {
    const phone = patient.phone_number || '';
    const invoice = patient.invoice_number || '';
    const firstName = patient.patient_first_name || '';
    const lastName = patient.patient_last_name || '';
    return `${phone}|${invoice}|${firstName}|${lastName}`;
  };

  const confirmCallPatient = async () => {
    if (!patientToCall) {
      setShowCallConfirmModal(false);
      return;
    }

    const phoneNumber = patientToCall.phone_number;
    const callKey = getPatientCallKey(patientToCall);
    
    try {
      // Track active call using unique key (phone + invoice + names)
      const now = Date.now();
      setActiveCalls(prev => {
        const newMap = new Map(prev);
        newMap.set(callKey, now);
        return newMap;
      });

      // Helper function to get full name
      const getFullName = (p: Patient): string => {
        const first = p.patient_first_name || '';
        const last = p.patient_last_name || '';
        return `${first} ${last}`.trim() || 'Unknown';
      };
      
      const fullName = getFullName(patientToCall);
      showMessage('info', `Calling ${fullName}...`);
      
      const result = await callPatient(
        phoneNumber, 
        patientToCall.invoice_number, 
        patientToCall.patient_first_name,
        patientToCall.patient_last_name
      );
      
      if (result.success) {
        showMessage('success', `Call initiated to ${fullName}`);
        // Reload patients to refresh call count and status
        if (selectedUploadId) {
          const response = await getPatientsByUploadId(selectedUploadId);
          setPatients(response.patients || []);
        }
      } else {
        showMessage('error', result.message || 'Failed to initiate call');
        // Remove from active calls on failure
        setActiveCalls(prev => {
          const newMap = new Map(prev);
          newMap.delete(callKey);
          return newMap;
        });
      }
    } catch (error) {
      console.error('Call error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to initiate call';
      showMessage('error', errorMessage);
      // Remove from active calls on error
      setActiveCalls(prev => {
        const newMap = new Map(prev);
        newMap.delete(callKey);
        return newMap;
      });
    } finally {
      setShowCallConfirmModal(false);
      setPatientToCall(null);
      
      // Remove from active calls after 5 minutes
      setTimeout(() => {
        setActiveCalls(prev => {
          const newMap = new Map(prev);
          newMap.delete(callKey);
          return newMap;
        });
      }, 5 * 60 * 1000);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      </div>
    );
  }

  // Show invoice list if upload is selected
  if (selectedUploadId) {
    const selectedUpload = uploads.find(u => u.id === selectedUploadId);
    return (
      <>
        <div className="space-y-6">
          {message && (
            <MessageAlert message={message} />
          )}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <button
                  onClick={handleBack}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium mb-2 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Uploads
                </button>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedUpload?.filename || 'Invoice List'}
                </h2>
                {selectedUpload && (
                  <p className="text-sm text-gray-500 mt-1">
                    Uploaded: {formatDateTime(selectedUpload.uploaded_at)} • 
                    {selectedUpload.new_count} new • {selectedUpload.updated_count} updated
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {loadingPatients ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <PatientTable 
                patients={patients} 
                loading={false}
                onViewNotes={handleViewNotes}
                onCallPatient={handleCallPatient}
                onViewCallHistory={handleViewCallHistory}
                onViewDetails={handleViewDetails}
                activeCalls={activeCalls}
              />
            </div>
          )}
        </div>

        {/* Modals - always render */}
        <ConfirmModal
          isOpen={showCallConfirmModal}
          title="Call Patient"
          message={`Are you sure you want to call ${patientToCall ? `${patientToCall.patient_first_name || ''} ${patientToCall.patient_last_name || ''}`.trim() || 'this patient' : 'this patient'} at ${patientToCall?.phone_number || ''}?`}
          onConfirm={confirmCallPatient}
          onCancel={() => {
            setShowCallConfirmModal(false);
            setPatientToCall(null);
          }}
        />

        <CallHistoryModal
          isOpen={showCallHistoryModal}
          patientFirstName={selectedPatient?.patient_first_name || ''}
          patientLastName={selectedPatient?.patient_last_name || ''}
          phoneNumber={selectedPatient?.phone_number || ''}
          invoiceNumber={selectedPatient?.invoice_number || ''}
          onClose={() => {
            setShowCallHistoryModal(false);
            setSelectedPatient(null);
          }}
        />

        <NotesModal
          isOpen={showNotesModal}
          patientFirstName={selectedPatient?.patient_first_name || ''}
          patientLastName={selectedPatient?.patient_last_name || ''}
          notes={selectedPatient?.notes || ''}
          onClose={() => {
            setShowNotesModal(false);
            setSelectedPatient(null);
          }}
        />

        <PatientDetails
          isOpen={showPatientDetailsModal}
          invoiceId={selectedPatient?.id}
          phoneNumber={selectedPatient?.phone_number || ''}
          invoiceNumber={selectedPatient?.invoice_number || ''}
          patientFirstName={selectedPatient?.patient_first_name || ''}
          patientLastName={selectedPatient?.patient_last_name || ''}
          onClose={() => {
            setShowPatientDetailsModal(false);
            setSelectedPatient(null);
          }}
        />
      </>
    );
  }

  // Show upload list
  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {message && (
        <MessageAlert message={message} />
      )}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Uploaded CSV Files</h2>
        <button
          onClick={loadUploads}
          className="px-4 py-2 text-sm font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {uploads.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-lg font-medium mb-2">No files uploaded yet</p>
          <p className="text-gray-400 text-sm">Upload a CSV file to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-colors cursor-pointer"
              onClick={() => handleOpenUpload(upload.id)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{upload.filename}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDateTime(upload.uploaded_at)} • {upload.patient_count} patients
                      {upload.new_count > 0 && ` • ${upload.new_count} new`}
                      {upload.updated_count > 0 && ` • ${upload.updated_count} updated`}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenUpload(upload.id);
                }}
                className="ml-4 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
              >
                View
              </button>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Modals - always render */}
      <ConfirmModal
        isOpen={showCallConfirmModal}
        title="Call Patient"
        message={`Are you sure you want to call ${patientToCall ? `${patientToCall.patient_first_name || ''} ${patientToCall.patient_last_name || ''}`.trim() || 'this patient' : 'this patient'} at ${patientToCall?.phone_number || ''}?`}
        onConfirm={confirmCallPatient}
        onCancel={() => {
          setShowCallConfirmModal(false);
          setPatientToCall(null);
        }}
      />

      <CallHistoryModal
        isOpen={showCallHistoryModal}
        patientFirstName={selectedPatient?.patient_first_name || ''}
        patientLastName={selectedPatient?.patient_last_name || ''}
        phoneNumber={selectedPatient?.phone_number || ''}
        invoiceNumber={selectedPatient?.invoice_number || ''}
        onClose={() => {
          setShowCallHistoryModal(false);
          setSelectedPatient(null);
        }}
      />

      <NotesModal
        isOpen={showNotesModal}
        patientFirstName={selectedPatient?.patient_first_name || ''}
        patientLastName={selectedPatient?.patient_last_name || ''}
        notes={selectedPatient?.notes || ''}
        onClose={() => {
          setShowNotesModal(false);
          setSelectedPatient(null);
        }}
      />

      <PatientDetails
        isOpen={showPatientDetailsModal}
        invoiceId={selectedPatient?.id}
        phoneNumber={selectedPatient?.phone_number || ''}
        invoiceNumber={selectedPatient?.invoice_number || ''}
        patientFirstName={selectedPatient?.patient_first_name || ''}
        patientLastName={selectedPatient?.patient_last_name || ''}
        onClose={() => {
          setShowPatientDetailsModal(false);
          setSelectedPatient(null);
        }}
      />
    </>
  );
};

export default InvoiceList;

