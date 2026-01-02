import { useEffect, useState, useRef } from 'react';
import { callPatient, endCall, getCallStatus, updatePatient } from '../services/api';
import { usePatientData } from '../hooks/usePatientData';
import { useFileUpload } from '../hooks/useFileUpload';
import type { Patient } from '../types';
import { formatDateTime } from '../utils/timezone';
import { getPatientCallKey } from '../utils/patientUtils';
import { PatientTable } from './PatientTable';
import { CallHistoryModal } from './CallHistoryModal';
import { NotesModal } from './NotesModal';
import { PatientDetails } from './PatientDetails';
import { ConfirmModal } from './ConfirmModal';
import { MessageAlert } from './MessageAlert';
import { useToast, ToastContainer } from './Toast';
import { BsFiletypePdf, BsFiletypeCsv, BsFileEarmarkExcel } from 'react-icons/bs';

interface FileUpload {
  id: number;
  filename: string;
  created_at: string | null;
  uploaded_at?: string | null; // Legacy field, use created_at
  patient_count?: number;
  new_count?: number;
  updated_count?: number;
  error_count?: number;
  appointment_count?: number;
  call_count?: number;
  uploaded_by_user_id?: number;
  clinic_id?: number;
}

interface InvoiceListProps {
  onFileSelect?: (uploadId: number) => void;
}

export const InvoiceList = ({ onFileSelect }: InvoiceListProps) => {
  const { patients, loading: patientsLoading, loadPatientData } = usePatientData();
  const { availableFiles, loadAvailableFiles } = useFileUpload({});
  const [selectedUploadId, setSelectedUploadId] = useState<number | null>(null);
  const [disableAnimations, setDisableAnimations] = useState(true);
  const { toasts, showToast, removeToast } = useToast();
  const patientsRef = useRef<Patient[]>([]);
  
  // Keep ref in sync with patients state
  useEffect(() => {
    patientsRef.current = patients;
  }, [patients]);
  
  // Convert availableFiles to FileUpload format for compatibility
  const uploads: FileUpload[] = availableFiles.map(file => ({
    id: file.id,
    filename: file.filename,
    created_at: file.uploaded_at,
    uploaded_at: file.uploaded_at,
    patient_count: file.patient_count
  }));
  
  const loading = availableFiles.length === 0 && !patientsLoading;

  // Load available files on mount
  useEffect(() => {
    loadAvailableFiles();
  }, [loadAvailableFiles]);

  // Re-enable transitions after initial render and when loading completes
  useEffect(() => {
    if (!loading) {
      setDisableAnimations(true);
      const timer = setTimeout(() => {
        setDisableAnimations(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, selectedUploadId]);

  const getFileIcon = (filename: string) => {
    const name = filename.toLowerCase();
    if (name.endsWith('.pdf')) {
      return <BsFiletypePdf className="w-5 h-5 text-destructive" />;
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      return <BsFileEarmarkExcel className="w-5 h-5 text-green-600" />;
    } else if (name.endsWith('.csv')) {
      return <BsFiletypeCsv className="w-5 h-5 text-primary" />;
    }
    return (
      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };
  const [showCallHistoryModal, setShowCallHistoryModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showCallConfirmModal, setShowCallConfirmModal] = useState(false);
  const [showPatientDetailsModal, setShowPatientDetailsModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientToCall, setPatientToCall] = useState<Patient | null>(null);
  const [activeCalls, setActiveCalls] = useState<Map<string, { timestamp: number; conversationId?: string; callSid?: string; twilioStatus?: string }>>(new Map());
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Clean up activeCalls when patient data changes - remove entries for completed/failed calls
  useEffect(() => {
    setActiveCalls(prev => {
      if (prev.size === 0 || patients.length === 0) {
        return prev;
      }

      const newMap = new Map(prev);
      let hasChanges = false;

      // Remove entries for patients whose call_status is completed or failed
      patients.forEach(patient => {
        if (patient.call_status === 'completed' || patient.call_status === 'failed') {
          const callKey = getPatientCallKey(patient);
          if (newMap.has(callKey)) {
            newMap.delete(callKey);
            hasChanges = true;
          }
        }
      });

      return hasChanges ? newMap : prev;
    });
  }, [patients]);

  const handleOpenUpload = async (uploadId: number) => {
    setSelectedUploadId(uploadId);
    try {
      await loadPatientData(uploadId, false);
      if (onFileSelect) {
        onFileSelect(uploadId);
      }
    } catch (error) {
      console.error('Failed to load patients:', error);
    }
  };

  const handleBack = async () => {
    setSelectedUploadId(null);
    await loadPatientData(null, false);
  };

  const handleUpdatePatient = async (invoiceId: number, updates: Record<string, any>) => {
    try {
      await updatePatient(invoiceId, updates);
      showMessage('success', 'Patient updated successfully');
      // Refresh patient data using hook
      await loadPatientData(selectedUploadId, true);
      // Refresh dashboard if available
      const refreshDashboard = (window as { refreshDashboard?: () => void }).refreshDashboard;
      if (typeof refreshDashboard === 'function') {
        refreshDashboard();
      }
    } catch (error) {
      console.error('Failed to update patient:', error);
      showMessage('error', 'Failed to update patient. Please try again.');
      throw error;
    }
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
    // invoice_number no longer required - removed from validation

    if (!phone || phone.length < 10) {
      showMessage('error', 'Cannot view call history: Phone number is missing or invalid');
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

    if (!phone || phone.length < 10) {
      showMessage('error', 'Cannot make call: Phone number is missing or invalid (minimum 10 digits required)');
      return;
    }
    // invoice_number no longer required - removed from validation
    // Validate patient name and DOB instead
    if (!patient.patient_first_name || !patient.patient_last_name) {
      showMessage('error', 'Cannot make call: Patient name is missing (required for identification)');
      return;
    }
    if (!patient.patient_dob) {
      showMessage('error', 'Cannot make call: Patient date of birth is missing (required for identification)');
      return;
    }

    // Show confirmation modal first
    setPatientToCall(patient);
    setShowCallConfirmModal(true);
  };

  const handleEndCall = async (patient: Patient) => {
    const callKey = getPatientCallKey(patient);
    const activeCall = activeCalls.get(callKey);

    if (!activeCall || !activeCall.conversationId) {
      showMessage('error', 'No active call found for this patient');
      return;
    }

    try {
      const getFullName = (p: Patient): string => {
        const first = p.patient_first_name || '';
        const last = p.patient_last_name || '';
        return `${first} ${last}`.trim() || 'Unknown';
      };

      const fullName = getFullName(patient);
      showToast('info', `Ending call with ${fullName}...`);

      const response = await endCall(activeCall.conversationId);

      if (response.success) {
        // Remove from activeCalls
        setActiveCalls(prev => {
          const newMap = new Map(prev);
          newMap.delete(callKey);
          return newMap;
        });

        showToast('success', `Call ended with ${fullName}`);

        // Refresh patient data to update call status using hook
        await loadPatientData(selectedUploadId, true);
      } else {
        showToast('error', 'Failed to end call');
      }
    } catch (error) {
      console.error('End call failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to end call';
      showToast('error', errorMessage);
    }
  };

  const confirmCallPatient = async () => {
    if (!patientToCall) {
      setShowCallConfirmModal(false);
      return;
    }

    const phoneNumber = patientToCall.phone_number;
    const callKey = getPatientCallKey(patientToCall);

    try {
      // Helper function to get full name
      const getFullName = (p: Patient): string => {
        const first = p.patient_first_name || '';
        const last = p.patient_last_name || '';
        return `${first} ${last}`.trim() || 'Unknown';
      };

      const fullName = getFullName(patientToCall);
      showToast('info', `Calling ${fullName} at ${phoneNumber}...`);

      const result = await callPatient(
        phoneNumber,
        patientToCall.invoice_number,
        patientToCall.patient_first_name,
        patientToCall.patient_last_name,
        patientToCall.patient_dob
      );

      if (result.success) {
        // Track active call using unique key (phone + invoice + names)
        const now = Date.now();
        // Update active calls with call_sid
        setActiveCalls(prev => {
          const newMap = new Map(prev);
          newMap.set(callKey, {
            timestamp: now,
            conversationId: result.conversation_id,
            callSid: (result as { call_sid?: string }).call_sid
          });
          return newMap;
        });

        showMessage('success', `Call initiated to ${fullName}`);
        // Reload patients to refresh call count and status using hook
        await loadPatientData(selectedUploadId, true);

        // Start polling call status using the new endpoint
        if ((result as { call_sid?: string }).call_sid) {
          const callSid = (result as { call_sid?: string }).call_sid!;
          let refreshCount = 0;
          const maxRefreshes = 60; // Max 3 minutes (60 * 3s)

          const singleCallRefreshInterval = setInterval(async () => {
            if (refreshCount < maxRefreshes) {
              try {
                // Check real-time call status from Twilio/ElevenLabs
                const statusResponse = await getCallStatus(callSid);

                // Twilio statuses: queued, ringing, in-progress, completed, busy, failed, no-answer, canceled
                const twilioStatus = statusResponse.twilio?.status;
                const isCallComplete = twilioStatus && ['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(twilioStatus);

                if (isCallComplete) {
                  // Call has ended - refresh patient data to get notes using hook
                  await loadPatientData(selectedUploadId, true);
                  
                  // Small delay to allow state update, then check notes using ref
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  // Check if notes are available using ref (has latest patients)
                  const patient = patientsRef.current.find(p =>
                    p.phone_number === phoneNumber &&
                    p.invoice_number === patientToCall.invoice_number &&
                    p.patient_first_name === patientToCall.patient_first_name &&
                    p.patient_last_name === patientToCall.patient_last_name
                  );

                  if (patient?.recent_call_notes && patient.recent_call_notes.trim()) {
                    // Notes are updated - stop polling and remove from activeCalls
                    setActiveCalls(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(callKey);
                      return newMap;
                    });
                    clearInterval(singleCallRefreshInterval);
                    return;
                  }
                  // If notes not updated yet, continue polling for a bit
                }
              } catch (error) {
                console.error('Failed to check call status:', error);
                // Note: Patient data will be refreshed when call completes
                // Only refresh here if we haven't already refreshed recently
              }

              refreshCount++;
            } else {
              // Max refreshes reached - clean up
              setActiveCalls(prev => {
                const newMap = new Map(prev);
                newMap.delete(callKey);
                return newMap;
              });
              // Final reload using hook
              try {
                await loadPatientData(selectedUploadId, true);
              } catch (error) {
                console.error('Failed to refresh patient data:', error);
              }
              clearInterval(singleCallRefreshInterval);
            }
          }, 3000); // Poll every 3 seconds
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
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center p-4 sm:p-6 md:p-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-sm text-foreground">Loading invoices...</div>
        </div>
      </div>
    );
  }

  // Show invoice list if upload is selected
  if (selectedUploadId) {
    const selectedUpload = uploads.find(u => u.id === selectedUploadId);
    return (
      <>
        <div className="space-y-6" style={disableAnimations ? { animation: 'none', transition: 'none' } : {}}>
          {message && (
            <MessageAlert message={message} />
          )}
          
          {/* Header Section */}
          <div className="space-y-4">
            <button
              onClick={handleBack}
              className="liquid-glass-btn-primary text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors w-fit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Uploads
            </button>
            
            {/* File Info Card */}
            <div className="liquid-glass-strong rounded-2xl p-4 sm:p-5 md:p-6" style={disableAnimations ? { transition: 'none' } : {}}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 liquid-glass-subtle rounded-xl">
                      {selectedUpload && getFileIcon(selectedUpload.filename)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">
                        {selectedUpload?.filename || 'Invoice List'}
                      </h2>
                      {selectedUpload && (
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-sm text-muted-foreground">
                            Uploaded: {formatDateTime(selectedUpload.created_at || selectedUpload.uploaded_at || null)}
                          </span>
                          {selectedUpload.new_count !== undefined && selectedUpload.new_count > 0 && (
                            <span className="liquid-glass-badge text-xs font-semibold text-green-600">
                              {selectedUpload.new_count} new
                            </span>
                          )}
                          {selectedUpload.updated_count !== undefined && selectedUpload.updated_count > 0 && (
                            <span className="liquid-glass-badge text-xs font-semibold text-primary">
                              {selectedUpload.updated_count} updated
                            </span>
                          )}
                          {selectedUpload.patient_count !== undefined && selectedUpload.patient_count > 0 && (
                            <span className="liquid-glass-badge text-xs font-semibold text-foreground">
                              {selectedUpload.patient_count} patients
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {patientsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center liquid-glass-strong rounded-2xl p-4 sm:p-6 md:p-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <div className="text-sm text-foreground">Loading patients...</div>
              </div>
            </div>
          ) : (
              <PatientTable
                patients={patients}
                loading={false}
                onViewNotes={handleViewNotes}
                onCallPatient={handleCallPatient}
                onEndCall={handleEndCall}
                onViewCallHistory={handleViewCallHistory}
                onViewDetails={handleViewDetails}
                onUpdatePatient={handleUpdatePatient}
                activeCalls={activeCalls}
              />
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

        {selectedPatient && (
          <CallHistoryModal
            isOpen={showCallHistoryModal}
            patient={selectedPatient}
            onClose={() => {
              setShowCallHistoryModal(false);
              setSelectedPatient(null);
            }}
          />
        )}

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

        {selectedPatient && (
          <PatientDetails
            patient={selectedPatient}
            isOpen={showPatientDetailsModal}
            onClose={() => {
              setShowPatientDetailsModal(false);
              setSelectedPatient(null);
            }}
          />
        )}
      </>
    );
  }

  // Show upload list
  return (
    <>
      <div className="liquid-glass-strong rounded-2xl p-4 sm:p-5 md:p-6" style={disableAnimations ? { animation: 'none', transition: 'none' } : {}}>
        {message && (
          <MessageAlert message={message} />
        )}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Uploaded Files</h2>
          <button
            onClick={loadAvailableFiles}
            className="liquid-glass-btn-primary px-4 py-2 text-sm font-medium rounded-xl transition-colors"
          >
            Refresh
          </button>
        </div>

        {uploads.length === 0 ? (
          <div className="text-center py-8 sm:py-10 md:py-12">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full liquid-glass mb-4">
              <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-foreground text-lg font-medium mb-2">No files uploaded yet</p>
            <p className="text-muted-foreground text-sm">Upload a file (CSV, Excel, or PDF) to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="flex items-center justify-between p-4 liquid-glass rounded-xl cursor-pointer transition-all"
                onClick={() => handleOpenUpload(upload.id)}
                style={disableAnimations ? { transition: 'none' } : {}}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 liquid-glass-subtle rounded-lg">
                      {getFileIcon(upload.filename)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{upload.filename}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDateTime(upload.created_at || upload.uploaded_at || null)}
                        {upload.patient_count !== undefined && ` • ${upload.patient_count} patients`}
                        {upload.new_count !== undefined && upload.new_count > 0 && ` • ${upload.new_count} new`}
                        {upload.updated_count !== undefined && upload.updated_count > 0 && ` • ${upload.updated_count} updated`}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenUpload(upload.id);
                  }}
                  className="ml-4 liquid-glass-btn-primary px-4 py-2 text-sm font-medium rounded-xl transition-colors"
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

      {selectedPatient && (
        <CallHistoryModal
          isOpen={showCallHistoryModal}
          patient={selectedPatient}
          onClose={() => {
            setShowCallHistoryModal(false);
            setSelectedPatient(null);
          }}
        />
      )}

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

      {selectedPatient && (
        <PatientDetails
          patient={selectedPatient}
          isOpen={showPatientDetailsModal}
          onClose={() => {
            setShowPatientDetailsModal(false);
            setSelectedPatient(null);
          }}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
};

export default InvoiceList;

