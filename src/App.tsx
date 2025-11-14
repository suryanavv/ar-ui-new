import { useState, useEffect, useRef } from 'react';
import './App.css';
import {
  Header,
  MessageAlert,
  FileUpload,
  BatchCallButton,
  DownloadButton,
  PatientTable,
  ConfirmModal,
  NotesModal,
  LoginPage
} from './components';
import { uploadCSV, getCSVData, triggerBatchCall, callPatient } from './services/api';
import type { Patient, Message, User } from './types';

function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Existing state
  const [currentFile, setCurrentFile] = useState<string>('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [callingInProgress, setCallingInProgress] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeCalls, setActiveCalls] = useState<Map<string, number>>(new Map()); // phone_number -> timestamp
  const refreshIntervalRef = useRef<number | null>(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(storedUser));
    }
    
    // Restore call status from localStorage
    const storedCallStatus = localStorage.getItem('callingInProgress');
    const storedCurrentFile = localStorage.getItem('currentFile');
    const storedActiveCalls = localStorage.getItem('activeCalls');
    
    if (storedCallStatus === 'true' && storedCurrentFile) {
      setCallingInProgress(true);
      setCurrentFile(storedCurrentFile);
    } else if (storedCurrentFile) {
      setCurrentFile(storedCurrentFile);
    }
    
    // Restore active calls from localStorage
    if (storedActiveCalls) {
      try {
        const activeCallsData = JSON.parse(storedActiveCalls);
        const now = Date.now();
        const activeCallsMap = new Map<string, number>();
        
        // Only restore calls that are less than 10 minutes old
        activeCallsData.forEach(([phone, timestamp]: [string, number]) => {
          if (now - timestamp < 10 * 60 * 1000) { // 10 minutes
            activeCallsMap.set(phone, timestamp);
          }
        });
        
        setActiveCalls(activeCallsMap);
      } catch (e) {
        console.error('Failed to restore active calls:', e);
      }
    }
    
    setCheckingAuth(false);
  }, []);

  // Load patient data when currentFile is restored from localStorage
  useEffect(() => {
    if (currentFile && !checkingAuth) {
      loadPatientData(currentFile, false, true);
      // Resume auto-refresh if call was in progress
      const storedCallStatus = localStorage.getItem('callingInProgress');
      if (storedCallStatus === 'true') {
        // Use setTimeout to ensure currentFile state is updated
        setTimeout(() => {
          startAutoRefresh();
        }, 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFile, checkingAuth]);

  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Handle login
  const handleLogin = (_token: string, userData: User) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentFile');
    localStorage.removeItem('callingInProgress');
    setIsAuthenticated(false);
    setUser(null);
    setCurrentFile('');
    setPatients([]);
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  };

  const loadPatientData = async (filename: string, silent: boolean = false, includeOutput: boolean = true) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const response = await getCSVData(filename, includeOutput);
      setPatients(response.patients);
    } catch (error) {
      console.error('Failed to load patient data:', error);
      if (!silent) {
        showMessage('error', 'Failed to load patient data');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadLoading(true);
    try {
      const response = await uploadCSV(file);
      showMessage('success', `Uploaded ${response.patient_count} patients successfully`);
      
      setCurrentFile(response.filename);
      localStorage.setItem('currentFile', response.filename);
      await loadPatientData(response.filename, false, false);
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      console.error('Upload failed:', error);
      showMessage('error', err.response?.data?.detail || 'Failed to upload file');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleBatchCall = () => {
    if (!currentFile) {
      showMessage('error', 'Please upload a file first');
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmBatchCall = async () => {
    setShowConfirmModal(false);
    setCallingInProgress(true);
    localStorage.setItem('callingInProgress', 'true');
    showMessage('info', 'Starting batch calls... This may take a few minutes.');

    try {
      const response = await triggerBatchCall(currentFile);
      
      // Check if there were no calls to make
      if (response.results?.total_attempted === 0) {
        showMessage('info', 'All eligible patients have already been called. Upload a new file or check existing patient data.');
        setCallingInProgress(false);
        localStorage.removeItem('callingInProgress');
        return;
      }
      
      // Track active calls - mark all successful calls as active
      const newActiveCalls = new Map(activeCalls);
      const now = Date.now();
      
      if (response.results?.calls) {
        response.results.calls.forEach((call) => {
          if (call.success && call.phone_number) {
            // Mark call as active for next 10 minutes (calls typically last 5-10 minutes)
            newActiveCalls.set(call.phone_number, now);
          }
        });
        setActiveCalls(newActiveCalls);
        
        // Store in localStorage
        const activeCallsData = Array.from(newActiveCalls.entries());
        localStorage.setItem('activeCalls', JSON.stringify(activeCallsData));
      }
      
      showMessage('success', response.message);
      
      // Calls are initiated, keep status for auto-refresh
      // Don't clear calling status immediately - let auto-refresh handle it
      startAutoRefresh();
      setTimeout(() => loadPatientData(currentFile, true), 1000);
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      console.error('Batch call failed:', error);
      showMessage('error', err.response?.data?.detail || 'Batch call failed');
      setCallingInProgress(false);
      localStorage.removeItem('callingInProgress');
    }
  };

  const startAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    const fileToRefresh = currentFile;
    let count = 0;
    refreshIntervalRef.current = window.setInterval(() => {
      if (fileToRefresh && count < 40) {
        loadPatientData(fileToRefresh, true);
        count++;
        
        // Clean up old active calls (older than 10 minutes)
        setActiveCalls((prevActiveCalls) => {
          const now = Date.now();
          const newActiveCalls = new Map(prevActiveCalls);
          let updated = false;
          
          prevActiveCalls.forEach((timestamp, phone) => {
            if (now - timestamp > 10 * 60 * 1000) { // 10 minutes
              newActiveCalls.delete(phone);
              updated = true;
            }
          });
          
          if (updated) {
            const activeCallsData = Array.from(newActiveCalls.entries());
            localStorage.setItem('activeCalls', JSON.stringify(activeCallsData));
          }
          
          return newActiveCalls;
        });
      } else {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
        // Clear call status when refresh is done (after ~2 minutes)
        setCallingInProgress(false);
        localStorage.removeItem('callingInProgress');
        // Clear active calls that are older than 10 minutes
        setActiveCalls(new Map());
        localStorage.removeItem('activeCalls');
      }
    }, 3000);
  };

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleViewNotes = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowNotesModal(true);
  };

  const handleCallPatient = async (patient: Patient) => {
    if (!patient.phone_number) {
      showMessage('error', 'Phone number not available');
      return;
    }

    try {
      showMessage('info', `Calling ${patient.patient_name} at ${patient.phone_number}...`);
      const response = await callPatient(patient.phone_number);
      
      if (response.success) {
        // Track this call as active
        const newActiveCalls = new Map(activeCalls);
        newActiveCalls.set(patient.phone_number, Date.now());
        setActiveCalls(newActiveCalls);
        localStorage.setItem('activeCalls', JSON.stringify(Array.from(newActiveCalls.entries())));
        
        showMessage('success', response.message || `Call initiated to ${patient.patient_name}`);
        // Refresh patient data after a short delay to show updated notes
        setTimeout(() => {
          if (currentFile) {
            loadPatientData(currentFile, true, true);
          }
        }, 2000);
      } else {
        showMessage('error', response.message || 'Failed to initiate call');
      }
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      console.error('Call failed:', error);
      showMessage('error', err.response?.data?.detail || 'Failed to call patient');
    }
  };

  const handleUploadNewFile = () => {
    setCurrentFile('');
    setPatients([]);
    localStorage.removeItem('currentFile');
    localStorage.removeItem('callingInProgress');
    setCallingInProgress(false);
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
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

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Show main dashboard if authenticated
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Header user={user} onLogout={handleLogout} />
      <div className="max-w-[1920px] mx-auto px-8 py-6 relative z-0">

        {message && <MessageAlert message={message} />}

        {/* Upload Section - Show only when no file is uploaded */}
        {!currentFile && (
          <div className="mb-8">
            <FileUpload onUpload={handleFileUpload} loading={uploadLoading} />
          </div>
        )}

        {/* File Actions Section - Show when file is uploaded */}
        {currentFile && (
          <div className="mb-8 px-6 py-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px] px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Current File</p>
                    <p className="text-sm text-gray-900 font-medium mt-0.5">{currentFile}</p>
                  </div>
                  <span className="px-3 py-1 bg-gray-600 text-white text-xs font-semibold rounded-full">
                    {patients.length} patients
                  </span>
                </div>
              </div>
              
              <BatchCallButton 
                onClick={handleBatchCall}
                disabled={patients.length === 0 || callingInProgress}
                loading={callingInProgress}
              />
              
              <DownloadButton 
                filename={currentFile}
                disabled={patients.length === 0}
              />

              <button
                onClick={handleUploadNewFile}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload New File
              </button>
            </div>
          </div>
        )}

        <PatientTable 
          patients={patients} 
          loading={loading} 
          onViewNotes={handleViewNotes}
          onCallPatient={handleCallPatient}
          activeCalls={activeCalls}
        />

        <ConfirmModal
          isOpen={showConfirmModal}
          title="Start Calls"
          message={`Are you sure you want to start calling ${patients.length} patients?`}
          onConfirm={confirmBatchCall}
          onCancel={() => setShowConfirmModal(false)}
        />

        <NotesModal
          isOpen={showNotesModal}
          patientName={selectedPatient?.patient_name || ''}
          notes={selectedPatient?.notes || ''}
          onClose={() => setShowNotesModal(false)}
        />
      </div>
    </div>
  );
}

export default App;