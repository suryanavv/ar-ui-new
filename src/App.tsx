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
  ToastContainer,
  useToast
} from './components';
import { triggerBatchCall, callPatient } from './services/api';
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
  const [activeSection, setActiveSection] = useState<'dashboard' | 'upload' | 'invoice-list' | 'users'>('dashboard');
  const [message, setMessage] = useState<Message | null>(null);
  const [callingInProgress, setCallingInProgress] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCallConfirmModal, setShowCallConfirmModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showCallHistoryModal, setShowCallHistoryModal] = useState(false);
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientToCall, setPatientToCall] = useState<Patient | null>(null);
  const [activeCalls, setActiveCalls] = useState<Map<string, number>>(new Map());
  const activeCallsRef = useRef<Map<string, number>>(new Map());

  // Custom hooks
  const {
    patients,
    loading,
    patientsRef,
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
  } = useFileUpload({
    showMessage: (type, text) => showMessage(type, text),
    onUploadSuccess: async (filename) => {
      setCurrentFile(filename || 'database');
      setSelectedFile(filename);
      localStorage.setItem('currentFile', filename || 'database');
      await loadAvailableFiles();
      
      if (filename) {
        const recentUpload = availableFiles
          .filter(f => f.filename === filename)
          .sort((a, b) => {
            const dateA = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
            const dateB = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
            return dateB - dateA;
          })[0];
        
        if (recentUpload) {
          setSelectedUploadId(recentUpload.id);
          setSelectedUploadIdRef(recentUpload.id);
          await loadPatientData(recentUpload.id, false);
        } else {
          setSelectedUploadId(null);
          setSelectedUploadIdRef(null);
          await loadPatientData(null, false);
        }
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

  const { startSmartAutoRefresh, stopAutoRefresh } = useAutoRefresh({
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
    
    const storedActiveSection = localStorage.getItem('activeSection');
    if (storedActiveSection && ['dashboard', 'upload', 'invoice-list', 'users'].includes(storedActiveSection)) {
      setActiveSection(storedActiveSection as 'dashboard' | 'upload' | 'invoice-list' | 'users');
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
    setIsAuthenticated(true);
    setUser(userData);
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
    setIsAuthenticated(false);
    setUser(null);
    setCurrentFile('');
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
      
      if (response.results?.calls) {
        response.results.calls.forEach((call) => {
          if (call.success && call.phone_number) {
            const patient = patients.find(p => 
              p.phone_number === call.phone_number &&
              p.patient_first_name === call.patient_first_name &&
              p.patient_last_name === call.patient_last_name
            );
            
            if (patient) {
              const callKey = getPatientCallKey(patient);
              newActiveCalls.set(callKey, now);
            } else {
              newActiveCalls.set(call.phone_number, now);
            }
          }
        });
        setActiveCalls(newActiveCalls);
        activeCallsRef.current = newActiveCalls;
      }
      
      showMessage('success', response.message);
      
      if (activeSection === 'upload') {
        const currentUploadId = getSelectedUploadId();
        await loadPatientData(currentUploadId, true);
        startSmartAutoRefresh();
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
    const invoice = patient.invoice_number && patient.invoice_number.toLowerCase() !== 'nan' ? patient.invoice_number : '';
    
    if (!phone || phone.length < 10) {
      showMessage('error', 'Cannot make call: Phone number is missing or invalid (minimum 10 digits required)');
      return;
    }
    if (!invoice) {
      showMessage('error', 'Cannot make call: Invoice number is missing (required for identification)');
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
        patient.patient_last_name
      );
      
      if (response.success) {
        const callKey = getPatientCallKey(patient);
        const newActiveCalls = new Map(activeCalls);
        newActiveCalls.set(callKey, Date.now());
        setActiveCalls(newActiveCalls);
        activeCallsRef.current = newActiveCalls;
        
        showMessage('success', response.message || `Call initiated to ${fullName}`);
        showToast('success', `Call initiated to ${fullName}`);
        
        if (activeSection === 'upload') {
          const currentUploadId = getSelectedUploadId();
          await loadPatientData(currentUploadId, true);
          
          let refreshCount = 0;
          const maxRefreshes = 60; // Increased to allow more time for calls to complete
          const singleCallRefreshInterval = setInterval(async () => {
            if (activeSection === 'upload' && refreshCount < maxRefreshes) {
              try {
                // Refresh patient data to get latest call status and notes
                const currentUploadId = getSelectedUploadId();
                await loadPatientData(currentUploadId, true);
                
                // Check call_status from patient data
                const currentPatients = patientsRef.current;
                const updatedPatient = currentPatients.find((p: Patient) => 
                  p.phone_number === patient.phone_number &&
                  p.invoice_number === patient.invoice_number &&
                  p.patient_first_name === patient.patient_first_name &&
                  p.patient_last_name === patient.patient_last_name
                );
                  
                if (updatedPatient && (updatedPatient.call_status === 'completed' || updatedPatient.call_status === 'failed')) {
                    // Remove from activeCalls when call completes or fails
                    setActiveCalls(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(callKey);
                      return newMap;
                    });
                    activeCallsRef.current = new Map(Array.from(activeCallsRef.current).filter(([key]) => key !== callKey));
                    
                    clearInterval(singleCallRefreshInterval);
                    return;
                }
              } catch (error) {
                console.error('Failed to refresh patient data:', error);
              }
              
              refreshCount++;
            } else {
              // Clean up activeCalls when max refreshes reached
              setActiveCalls(prev => {
                const newMap = new Map(prev);
                newMap.delete(callKey);
                return newMap;
              });
              activeCallsRef.current = new Map(Array.from(activeCallsRef.current).filter(([key]) => key !== callKey));
              // Final refresh before stopping
              try {
                const currentUploadId = getSelectedUploadId();
                await loadPatientData(currentUploadId, true);
              } catch (error) {
                console.error('Failed to refresh patient data:', error);
              }
              clearInterval(singleCallRefreshInterval);
            }
          }, 3000); // Refresh every 3 seconds
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

  const handleSectionChange = (section: 'dashboard' | 'upload' | 'invoice-list' | 'users') => {
    if (section === 'dashboard') {
      stopAutoRefresh();
      setActiveSection('dashboard');
      localStorage.setItem('activeSection', 'dashboard');
      setTimeout(() => {
        const refreshDashboard = (window as { refreshDashboard?: () => void }).refreshDashboard;
        if (refreshDashboard) {
          refreshDashboard();
        }
      }, 100);
    } else if (section === 'upload') {
      setActiveSection('upload');
      localStorage.setItem('activeSection', 'upload');
      const currentUploadId = getSelectedUploadId();
      loadPatientData(currentUploadId, false);
    } else {
      setActiveSection(section);
      localStorage.setItem('activeSection', section);
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

        {activeSection === 'users' && isAdmin && <UserManagement />}

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
                onViewCallHistory={handleViewCallHistory}
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
