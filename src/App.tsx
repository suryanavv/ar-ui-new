import { useState, useEffect, useRef } from 'react';
import './App.css';
import {
  Header,
  MessageAlert,
  UploadSection,
  NavigationTabs,
  ConfirmModal,
  NotesModal,
  CallHistoryModal,
  PatientDetails,
  LoginPage,
  SSOLogin,
  Dashboard,
  InvoiceList,
  UserManagement,
  PatientsTab,
  ToastContainer,
  useToast
} from './components';
// Keep import available for easy re-enable of user management
void UserManagement;
import { triggerBatchCall, callPatient, endCall, getCallStatus } from './services/api';
import { usePatientData } from './hooks/usePatientData';
import { useFileUpload } from './hooks/useFileUpload';
import { useAutoRefresh } from './hooks/useAutoRefresh';
import { getPatientCallKey, getPatientFullName } from './utils/patientUtils';
import type { Patient, Message, User } from './types';

function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isSSOMode, setIsSSOMode] = useState(false);

  // UI state
  const [currentFile, setCurrentFile] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [selectedUploadId, setSelectedUploadId] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'upload' | 'invoice-list' | 'patients' | 'users'>(() => {
    // Restore active section from localStorage on page load
    const storedSection = localStorage.getItem('activeSection');
    return (storedSection as 'dashboard' | 'upload' | 'invoice-list' | 'patients' | 'users') || 'dashboard';
  });
  const [message, setMessage] = useState<Message | null>(null);
  const [callingInProgress, setCallingInProgress] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCallConfirmModal, setShowCallConfirmModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showCallHistoryModal, setShowCallHistoryModal] = useState(false);
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientToCall, setPatientToCall] = useState<Patient | null>(null);
  const [activeCalls, setActiveCalls] = useState<Map<string, { timestamp: number; conversationId?: string; callSid?: string; twilioStatus?: string }>>(new Map());
  const activeCallsRef = useRef<Map<string, { timestamp: number; conversationId?: string; callSid?: string; twilioStatus?: string }>>(new Map());
  const pollingIntervalsRef = useRef<Map<string, number>>(new Map()); // Track polling intervals per call

  // Custom hooks
  const {
    patients,
    loading,
    selectedUploadIdRef,
    loadPatientData,
    setSelectedUploadId: setSelectedUploadIdRef,
    getSelectedUploadId,
  } = usePatientData();

  const {
    uploadLoading,
    availableFiles,
    handleFileUpload: handleFileUploadBase,
    loadAvailableFiles,
    lastUploadResponse,
  } = useFileUpload({
    showMessage: (type, text) => showMessage(type, text),
    onUploadSuccess: async (filename, uploadId) => {
      setCurrentFile(filename || 'database');
      setSelectedFile(filename);
      localStorage.setItem('currentFile', filename || 'database');
      await loadAvailableFiles();
      
      // Use the upload_id directly from the API response instead of searching for it
      if (uploadId) {
        setSelectedUploadId(uploadId);
        setSelectedUploadIdRef(uploadId);
        await loadPatientData(uploadId, false);
      } else {
        setSelectedUploadId(null);
        setSelectedUploadIdRef(null);
        await loadPatientData(null, false);
      }
      
      const refreshDashboard = (window as { refreshDashboard?: () => void }).refreshDashboard;
      if (refreshDashboard) {
        refreshDashboard();
      }
    },
  });

  const { stopAutoRefresh } = useAutoRefresh({
    activeSection,
    callingInProgress,
    setCallingInProgress,
    setActiveCalls,
    activeCallsRef,
    loadPatientData,
    getSelectedUploadId,
  });

  const { toasts, showToast, removeToast } = useToast();

  // Keep ref in sync with state
  useEffect(() => {
    selectedUploadIdRef.current = selectedUploadId;
  }, [selectedUploadId, selectedUploadIdRef]);

  // Check if user is already logged in on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ssoToken = urlParams.get('token');
    
    if (ssoToken) {
      // Fresh SSO login: wipe any stale tokens/user data so we don't mix clinics
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('currentFile');
      localStorage.removeItem('callingInProgress');
      localStorage.removeItem('activeCalls');
      setIsSSOMode(true);
      setCheckingAuth(false);
      return;
    }
    
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(storedUser));
    }
    
    const storedCurrentFile = localStorage.getItem('currentFile');
    if (storedCurrentFile) {
      setCurrentFile(storedCurrentFile);
    }
    
    selectedUploadIdRef.current = null;
    localStorage.removeItem('callingInProgress');
    localStorage.removeItem('activeCalls');
    
    setCheckingAuth(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load patient data and available files when app loads
  useEffect(() => {
    if (!checkingAuth && isAuthenticated) {
      loadAvailableFiles();
      if (activeSection === 'upload') {
        const currentUploadId = getSelectedUploadId();
        loadPatientData(currentUploadId, false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAuth, isAuthenticated, activeSection]);

  // Clean up activeCalls when patient data changes - remove entries for completed/failed calls
  // ONLY after post-call notes are updated
  useEffect(() => {
    setActiveCalls(prev => {
      if (prev.size === 0 || patients.length === 0) {
        return prev;
      }
      
      const newMap = new Map(prev);
      let hasChanges = false;
      
      // Remove entries for patients whose call_status is completed/failed
      // AND recent_call_notes have been updated (indicating post-call processing is done)
      patients.forEach(patient => {
        if ((patient.call_status === 'completed' || patient.call_status === 'failed') && 
            patient.recent_call_notes && patient.recent_call_notes.trim()) {
          const callKey = getPatientCallKey(patient);
          const callData = newMap.get(callKey);
          
          // Only remove if notes were likely updated after this call (1 minute grace period)
          if (callData) {
            const timeSinceCall = Date.now() - callData.timestamp;
            // Keep for at least 1 minute after notes appear to ensure UI updates properly
            if (timeSinceCall > 1 * 60 * 1000) {
              newMap.delete(callKey);
              hasChanges = true;
            }
          }
        }
      });
      
      if (hasChanges) {
        activeCallsRef.current = newMap;
        return newMap;
      }
      return prev;
    });
  }, [patients]);

  // Handle login
  const handleLogin = (_token: string, userData: User) => {
    setIsSSOMode(false);
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    // Persist latest user for downstream clinic scoping
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
    localStorage.setItem('activeSection', 'dashboard');
    setActiveSection('dashboard');
  };

  // Handle logout
  const handleLogout = () => {
    stopAutoRefresh();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentFile');
    localStorage.removeItem('callingInProgress');
    localStorage.removeItem('activeCalls');
    localStorage.setItem('activeSection', 'dashboard');
    setIsAuthenticated(false);
    setUser(null);
    setCurrentFile('');
    setActiveSection('dashboard');
  };

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleFileUpload = async (file: File) => {
    try {
      await handleFileUploadBase(file);
    } catch {
      // Error already handled in hook
    }
  };

  const handleFileSelect = async (uploadId: number | null) => {
    if (uploadId === null) {
      setSelectedUploadId(null);
      setSelectedUploadIdRef(null);
      setSelectedFile('');
      setCurrentFile('database');
      await loadPatientData(null, false);
      } else {
      const selectedUpload = availableFiles.find(f => f.id === uploadId);
      setSelectedUploadId(uploadId);
      setSelectedUploadIdRef(uploadId);
      setSelectedFile(selectedUpload?.filename || '');
      setCurrentFile(selectedUpload?.filename || 'database');
      await loadPatientData(uploadId, false);
    }
  };

  const handleBatchCall = () => {
    setShowConfirmModal(true);
  };

  const confirmBatchCall = async () => {
    setShowConfirmModal(false);
    setCallingInProgress(true);
    localStorage.setItem('callingInProgress', 'true');
    showMessage('info', 'Starting batch calls... This may take a few minutes.');

    try {
      const currentUploadId = getSelectedUploadId();
      let filenameToUse: string | undefined = undefined;
      let uploadIdToUse: number | undefined = undefined;
      
      if (currentUploadId) {
        uploadIdToUse = currentUploadId;
      } else if (selectedFile) {
        filenameToUse = selectedFile;
      }
      
      const response = await triggerBatchCall(filenameToUse, 0.01, undefined, uploadIdToUse);
      
      if (response.results?.total_attempted === 0) {
        let message = 'No patients were eligible for calling.';
        const totalPatients = response.results?.total_patients;
        const filteredOutCount = response.results?.filtered_out_count;
        if (totalPatients !== undefined && totalPatients !== null && totalPatients > 0) {
          message = `No eligible patients found (out of ${totalPatients} total patients). `;
          if (filteredOutCount !== undefined && filteredOutCount !== null && filteredOutCount > 0) {
            message += `${filteredOutCount} patient(s) were filtered out due to outstanding amount ≤ $0.01 or estimated_date in the future.`;
          } else {
            message += 'All patients have already been called or do not meet the criteria.';
          }
        } else {
          message = 'All eligible patients have already been called. Upload a new file or check existing patient data.';
        }
        showMessage('info', message);
        setCallingInProgress(false);
        localStorage.removeItem('callingInProgress');
        return;
      }
      
      const newActiveCalls = new Map(activeCalls);
      const now = Date.now();
      const batchCallSids: Array<{ callKey: string; callSid: string }> = [];
      
      if (response.results?.calls) {
        response.results.calls.forEach((call) => {
          if (call.success && call.phone_number && call.call_sid) {
            const patient = patients.find(p => 
              p.phone_number === call.phone_number &&
              p.patient_first_name === call.patient_first_name &&
              p.patient_last_name === call.patient_last_name
            );
            
            if (patient) {
              const callKey = getPatientCallKey(patient);
              newActiveCalls.set(callKey, { 
                timestamp: now, 
                conversationId: call.conversation_id,
                callSid: call.call_sid
              });
              
              // Collect call info for parallel polling
              if (activeSection === 'upload') {
                batchCallSids.push({ callKey, callSid: call.call_sid });
              }
            } else {
              newActiveCalls.set(call.phone_number, { 
                timestamp: now, 
                conversationId: call.conversation_id,
                callSid: call.call_sid
              });
            }
          }
        });
        setActiveCalls(newActiveCalls);
        activeCallsRef.current = newActiveCalls;
        
        // Set up parallel polling for all batch calls (single shared interval)
        if (activeSection === 'upload' && batchCallSids.length > 0) {
          let pollCount = 0;
          const maxPolls = 600; // Safety limit: 30 minutes (600 × 3s)
          
          const sharedBatchPollingInterval = setInterval(async () => {
            // Safety check: stop after 30 minutes
            if (pollCount >= maxPolls) {
              console.log('⚠️ Safety limit reached for batch calls - stopping polling');
              clearInterval(sharedBatchPollingInterval);
              pollingIntervalsRef.current.delete('batch_polling');
              return;
            }
            
            pollCount++;
            
            // Get current active calls
            const currentActiveCalls = activeCallsRef.current;
            if (currentActiveCalls.size === 0) {
              console.log('✅ No active calls - stopping batch polling');
              clearInterval(sharedBatchPollingInterval);
              pollingIntervalsRef.current.delete('batch_polling');
              return;
            }
            
            // Collect all active call SIDs that need checking
            const callsToCheck: Array<{ callKey: string; callSid: string }> = [];
            currentActiveCalls.forEach((callData, callKey) => {
              if (callData.callSid) {
                // Only check calls that haven't completed yet
                if (!callData.twilioStatus || !['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(callData.twilioStatus)) {
                  callsToCheck.push({ callKey, callSid: callData.callSid });
                }
              }
            });
            
            if (callsToCheck.length === 0) {
              // All calls are complete - refresh once and stop polling
              console.log('✅ All batch calls complete - refreshing patient data and stopping polling');
              clearInterval(sharedBatchPollingInterval);
              pollingIntervalsRef.current.delete('batch_polling');
              
              // Refresh patient data once silently
              try {
                const currentUploadId = getSelectedUploadId();
                await loadPatientData(currentUploadId, true);
              } catch (error) {
                console.error('Failed to refresh patient data:', error);
              }
              return;
            }
            
            // Check all calls in parallel using Promise.all
            try {
              const statusPromises = callsToCheck.map(({ callSid }) => getCallStatus(callSid));
              const statusResponses = await Promise.all(statusPromises);
              
              // Update activeCalls with latest statuses and remove completed ones
              let allComplete = false;
              setActiveCalls(prev => {
                const newMap = new Map(prev);
                let hasChanges = false;
                
                statusResponses.forEach((statusResponse, index) => {
                  const { callKey } = callsToCheck[index];
                  const existingCall = newMap.get(callKey);
                  
                  if (existingCall) {
                    const twilioStatus = statusResponse.twilio?.status;
                    const isCallComplete = twilioStatus && ['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(twilioStatus);
                    
                    if (isCallComplete) {
                      console.log(`✅ Batch call ${callKey} ${twilioStatus} - removing from active calls`);
                      newMap.delete(callKey);
                      hasChanges = true;
                    } else {
                      // Update status for calls still in progress
                      newMap.set(callKey, {
                        ...existingCall,
                        twilioStatus: twilioStatus
                      });
                      hasChanges = true;
                    }
                  }
                });
                
                // Update ref with new state
                activeCallsRef.current = newMap;
                
                // Check if all calls are now complete
                if (newMap.size === 0) {
                  allComplete = true;
                }
                
                return hasChanges ? newMap : prev;
              });
              
              // If all calls are complete, refresh and stop polling immediately
              if (allComplete) {
                console.log('✅ All batch calls complete - refreshing patient data and stopping polling');
                clearInterval(sharedBatchPollingInterval);
                pollingIntervalsRef.current.delete('batch_polling');
                
                // Refresh patient data once silently
                try {
                  const currentUploadId = getSelectedUploadId();
                  await loadPatientData(currentUploadId, true);
                } catch (error) {
                  console.error('Failed to refresh patient data:', error);
                }
                return; // Stop this polling cycle
              }
            } catch (error) {
              console.error('Failed to check batch call statuses:', error);
            }
          }, 3000); // Poll every 3 seconds
          
          // Store the shared interval reference
          pollingIntervalsRef.current.set('batch_polling', sharedBatchPollingInterval);
        }
      }
      
      showMessage('success', response.message);
      
      // Reset callingInProgress - batch calls have been initiated, button should go back to normal
      // Individual calls will be tracked via activeCalls and their polling intervals
      setCallingInProgress(false);
      localStorage.removeItem('callingInProgress');
      
      if (activeSection === 'upload') {
        const currentUploadId = getSelectedUploadId();
        await loadPatientData(currentUploadId, true);
      }
      
      const refreshDashboard = (window as { refreshDashboard?: () => void }).refreshDashboard;
      if (refreshDashboard) {
        setTimeout(() => refreshDashboard(), 2000);
      }
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      console.error('Batch call failed:', error);
      showMessage('error', err.response?.data?.detail || 'Batch call failed');
      setCallingInProgress(false);
      localStorage.removeItem('callingInProgress');
    }
  };

  const handleViewNotes = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowNotesModal(true);
  };

  const handleViewCallHistory = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowCallHistoryModal(true);
  };

  const handleViewDetails = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowPatientDetails(true);
  };

  const handleCallPatient = (patient: Patient) => {
    const phone = patient.phone_number && patient.phone_number.toLowerCase() !== 'nan' ? patient.phone_number : '';
    
    if (!phone || phone.length < 10) {
      showMessage('error', 'Cannot make call: Phone number is missing or invalid (minimum 10 digits required)');
      return;
    }
    
    // Validate patient name and DOB instead of invoice_number
    if (!patient.patient_first_name || !patient.patient_last_name) {
      showMessage('error', 'Cannot make call: Patient name is missing (required for identification)');
      return;
    }
    
    if (!patient.patient_dob) {
      showMessage('error', 'Cannot make call: Patient date of birth is missing (required for identification)');
      return;
    }
    
    setPatientToCall(patient);
    setShowCallConfirmModal(true);
  };

  const confirmCallPatient = async () => {
    if (!patientToCall) {
      setShowCallConfirmModal(false);
      return;
    }

    const patient = patientToCall;
    setShowCallConfirmModal(false);
    setPatientToCall(null);

    try {
      const fullName = getPatientFullName(patient);
      showMessage('info', `Calling ${fullName} at ${patient.phone_number}...`);
      const response = await callPatient(
        patient.phone_number,
        patient.invoice_number,
        patient.patient_first_name,
        patient.patient_last_name,
        patient.patient_dob
      );
      
      if (response.success) {
        const callKey = getPatientCallKey(patient);
        const newActiveCalls = new Map(activeCalls);
        newActiveCalls.set(callKey, { 
          timestamp: Date.now(),
          conversationId: response.conversation_id,
          callSid: (response as { call_sid?: string }).call_sid
        });
        setActiveCalls(newActiveCalls);
        activeCallsRef.current = newActiveCalls;
        
        showMessage('success', response.message || `Call initiated to ${fullName}`);
        showToast('success', `Call initiated to ${fullName}`);
        
        // Start polling call status using the new endpoint
        if (activeSection === 'upload' && (response as { call_sid?: string }).call_sid) {
          const callSid = (response as { call_sid?: string }).call_sid!;
          
          // Clear any existing interval for this call
          const existingInterval = pollingIntervalsRef.current.get(callKey);
          if (existingInterval) {
            console.log('🔄 Clearing existing polling interval for this call');
            clearInterval(existingInterval);
            pollingIntervalsRef.current.delete(callKey);
          }
          
          let pollCount = 0;
          const maxPolls = 600; // Safety limit: 30 minutes (600 × 3s)
          
          const singleCallRefreshInterval = setInterval(async () => {
            // Safety check: stop after 30 minutes (failsafe for stuck calls)
            if (pollCount >= maxPolls) {
              console.log('⚠️ Safety limit reached (30 minutes) - stopping polling');
              clearInterval(singleCallRefreshInterval);
              pollingIntervalsRef.current.delete(callKey);
              setActiveCalls(prev => {
                const newMap = new Map(prev);
                newMap.delete(callKey);
                activeCallsRef.current = newMap;
                return newMap;
              });
              return;
            }
            
            pollCount++;
            
            // Check if call is still in activeCalls (might have been removed)
            const currentCallData = activeCallsRef.current.get(callKey);
            if (!currentCallData) {
              console.log('✅ Call removed from activeCalls - stopping polling');
              clearInterval(singleCallRefreshInterval);
              pollingIntervalsRef.current.delete(callKey);
              return;
            }
            
            if (activeSection === 'upload') {
              try {
                // Check real-time call status from Twilio/ElevenLabs
                const statusResponse = await getCallStatus(callSid);
                
                // Twilio statuses: queued, ringing, in-progress, completed, busy, failed, no-answer, canceled
                const twilioStatus = statusResponse.twilio?.status;
                
                // Update activeCalls with latest Twilio status
                setActiveCalls(prev => {
                  const newMap = new Map(prev);
                  const existingCall = newMap.get(callKey);
                  if (existingCall) {
                    newMap.set(callKey, {
                      ...existingCall,
                      twilioStatus: twilioStatus
                    });
                    activeCallsRef.current = newMap; // Update ref with new state
                  }
                  return newMap;
                });
                
                const isCallComplete = twilioStatus && ['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(twilioStatus);
                
                if (isCallComplete) {
                  console.log(`✅ Call ${twilioStatus} - stopping polling immediately`);
                  // Call has ended - stop polling and remove from activeCalls
                  // Refresh patient data one final time to get latest status
                  const currentUploadId = getSelectedUploadId();
                  await loadPatientData(currentUploadId, true);
                  
                  // Remove from activeCalls and stop polling
                  setActiveCalls(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(callKey);
                    activeCallsRef.current = newMap; // Update ref immediately
                    return newMap;
                  });
                  clearInterval(singleCallRefreshInterval);
                  pollingIntervalsRef.current.delete(callKey);
                  return;
                } else {
                  console.log(`📞 Call status: ${twilioStatus || 'checking...'}`);
                }
              } catch (error) {
                console.error('Failed to check call status:', error);
                // Fallback to patient data refresh if status endpoint fails
                try {
                  const currentUploadId = getSelectedUploadId();
                  await loadPatientData(currentUploadId, true);
                } catch (refreshError) {
                  console.error('Failed to refresh patient data:', refreshError);
                }
              }
            }
          }, 3000); // Poll every 3 seconds - continues until call completes
          
          // Store the interval reference
          pollingIntervalsRef.current.set(callKey, singleCallRefreshInterval);
        }
      } else {
        showMessage('error', response.message || 'Failed to initiate call');
        showToast('error', response.message || 'Failed to initiate call');
      }
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      console.error('Call failed:', error);
      showMessage('error', err.response?.data?.detail || 'Failed to call patient');
      showToast('error', err.response?.data?.detail || 'Failed to call patient');
    }
  };

  const handleEndCall = async (patient: Patient) => {
    const callKey = getPatientCallKey(patient);
    const activeCall = activeCalls.get(callKey);
    
    if (!activeCall || !activeCall.conversationId) {
      showMessage('error', 'No active call found for this patient');
      return;
    }

    try {
      const fullName = getPatientFullName(patient);
      showMessage('info', `Ending call with ${fullName}...`);
      
      const response = await endCall(activeCall.conversationId);
      
      if (response.success) {
        console.log('✅ Manual disconnect - will poll for 5 more seconds to catch post-call webhook');
        
        showMessage('success', `Call ended with ${fullName}`);
        showToast('success', `Call disconnected successfully`);
        
        // Keep polling for 5 more seconds to catch the post-call webhook with summary
        setTimeout(() => {
          console.log('🛑 5 seconds elapsed - stopping polling for disconnected call');
        
        // Clear the polling interval for this call
        const existingInterval = pollingIntervalsRef.current.get(callKey);
        if (existingInterval) {
          clearInterval(existingInterval);
          pollingIntervalsRef.current.delete(callKey);
        }
        
          // Remove from activeCalls
        setActiveCalls(prev => {
          const newMap = new Map(prev);
          newMap.delete(callKey);
            activeCallsRef.current = newMap;
          return newMap;
        });
        
          // Final refresh to get updated notes from webhook
          if (activeSection === 'upload') {
            const currentUploadId = getSelectedUploadId();
            loadPatientData(currentUploadId, true);
          }
        }, 5000); // Wait 5 seconds
        
        // Immediate refresh to update call status
        if (activeSection === 'upload') {
          const currentUploadId = getSelectedUploadId();
          await loadPatientData(currentUploadId, true);
        }
      } else {
        showMessage('error', 'Failed to end call');
        showToast('error', 'Failed to disconnect call');
      }
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      console.error('End call failed:', error);
      showMessage('error', err.response?.data?.detail || 'Failed to end call');
      showToast('error', err.response?.data?.detail || 'Failed to disconnect call');
    }
  };

  const handleSectionChange = (section: 'dashboard' | 'upload' | 'invoice-list' | 'patients' | 'users') => {
    // Save active section to localStorage so it persists on page refresh
    localStorage.setItem('activeSection', section);
    
    if (section === 'dashboard') {
      stopAutoRefresh();
      setActiveSection('dashboard');
      setTimeout(() => {
        const refreshDashboard = (window as { refreshDashboard?: () => void }).refreshDashboard;
        if (refreshDashboard) {
          refreshDashboard();
        }
      }, 100);
    } else if (section === 'upload') {
      setActiveSection('upload');
      const currentUploadId = getSelectedUploadId();
      loadPatientData(currentUploadId, false);
    } else {
      setActiveSection(section);
    }
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <p className="text-gray-600 font-medium">Loading...</p>
      </div>
    );
  }

  // Show SSO login if in SSO mode
  if (isSSOMode) {
    return <SSOLogin onLogin={handleLogin} />;
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Header user={user} onLogout={handleLogout} />
      <div className="max-w-[1920px] mx-auto px-8 py-6 relative z-0">
        {message && <MessageAlert message={message} />}
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <NavigationTabs
          activeSection={activeSection}
          isAdmin={isAdmin}
          onSectionChange={handleSectionChange}
        />

        {activeSection === 'dashboard' && (
          <div className="mb-8 space-y-6">
            <Dashboard />
          </div>
        )}

        {activeSection === 'invoice-list' && (
          <div className="mb-8">
            <InvoiceList onFileSelect={() => {}} />
          </div>
        )}

        {activeSection === 'patients' && (
          <div className="mb-8">
            <PatientsTab
              onViewNotes={handleViewNotes}
              onViewCallHistory={handleViewCallHistory}
              onViewDetails={handleViewDetails}
              showMessage={showMessage}
            />
          </div>
        )}

        {/* {activeSection === 'users' && isAdmin && <UserManagement />} */}

        {activeSection === 'upload' && (
          <UploadSection
            availableFiles={availableFiles}
            selectedUploadId={selectedUploadId}
                patients={patients} 
                loading={loading} 
            uploadLoading={uploadLoading}
            callingInProgress={callingInProgress}
            activeCalls={activeCalls}
            currentFile={currentFile}
            onFileUpload={handleFileUpload}
            onFileSelect={handleFileSelect}
            onBatchCall={handleBatchCall}
                onViewNotes={handleViewNotes}
                onCallPatient={handleCallPatient}
                onEndCall={handleEndCall}
                onViewCallHistory={handleViewCallHistory}
            onRefreshPatients={async () => {
              await loadPatientData(selectedUploadId, true); // silent=true to avoid showing loading message
            }}
                onViewDetails={handleViewDetails}
              />
        )}

        <ConfirmModal
          isOpen={showConfirmModal}
          title="Start Batch Calls"
          message={`You are about to initiate calls to ${patients.length} patient${patients.length !== 1 ? 's' : ''}. Calls will be made automatically and summaries will be generated after each call completes.`}
          onConfirm={confirmBatchCall}
          onCancel={() => setShowConfirmModal(false)}
        />

        <ConfirmModal
          isOpen={showCallConfirmModal}
          title="Call Patient"
          message={`Are you sure you want to call ${patientToCall ? getPatientFullName(patientToCall) : 'this patient'} at ${patientToCall?.phone_number || ''}?`}
          onConfirm={confirmCallPatient}
          onCancel={() => {
            setShowCallConfirmModal(false);
            setPatientToCall(null);
          }}
        />

        <NotesModal
          isOpen={showNotesModal}
          patientFirstName={selectedPatient?.patient_first_name || ''}
          patientLastName={selectedPatient?.patient_last_name || ''}
          notes={selectedPatient?.notes || ''}
          onClose={() => setShowNotesModal(false)}
        />

        <CallHistoryModal
          isOpen={showCallHistoryModal}
          patientFirstName={selectedPatient?.patient_first_name || ''}
          patientLastName={selectedPatient?.patient_last_name || ''}
          phoneNumber={selectedPatient?.phone_number || ''}
          invoiceNumber={selectedPatient?.invoice_number || ''}
          patientDob={selectedPatient?.patient_dob || ''}
          onClose={() => setShowCallHistoryModal(false)}
        />

        {showPatientDetails && selectedPatient && (
          <PatientDetails
            invoiceId={selectedPatient.id}
            phoneNumber={selectedPatient.phone_number}
            invoiceNumber={selectedPatient.invoice_number}
            patientFirstName={selectedPatient.patient_first_name}
            patientLastName={selectedPatient.patient_last_name}
            isOpen={showPatientDetails}
            onClose={() => setShowPatientDetails(false)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
