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
  LoginPage,
  Dashboard
} from './components';
import { uploadCSV, getCSVData, getAllPatients, getAvailableFiles, triggerBatchCall, callPatient } from './services/api';
import type { Patient, Message, User } from './types';

function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Existing state
  const [currentFile, setCurrentFile] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<string>('');  // Selected file for filtering
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'upload'>('dashboard');  // Dashboard by default
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

  // Load patient data and available files when app loads (from database)
  useEffect(() => {
    if (!checkingAuth && isAuthenticated) {
      loadAvailableFiles();  // Load list of available files
      // Only load patient data if we're in upload section
      if (activeSection === 'upload') {
        loadPatientData(null, false, true);  // Load all from database
      }
      // Resume auto-refresh if call was in progress (only for upload section)
      const storedCallStatus = localStorage.getItem('callingInProgress');
      if (storedCallStatus === 'true' && activeSection === 'upload') {
        // Use setTimeout to ensure state is updated
        setTimeout(() => {
          startAutoRefresh();
        }, 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAuth, isAuthenticated, activeSection]);

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
    stopAutoRefresh(); // Stop any running auto-refresh
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentFile');
    localStorage.removeItem('callingInProgress');
    localStorage.removeItem('activeCalls');
    setIsAuthenticated(false);
    setUser(null);
    setCurrentFile('');
    setPatients([]);
  };

  const loadPatientData = async (filename: string | null = null, silent: boolean = false, includeOutput: boolean = true) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      // Use the filename parameter directly (not selectedFile state which may not be updated yet)
      const response = filename
        ? await getCSVData(filename, includeOutput)  // Filter by specific file
        : await getAllPatients();  // Get all patients
      setPatients(response.patients || []);
    } catch (error) {
      console.error('Failed to load patient data:', error);
      if (!silent) {
        showMessage('error', 'Failed to load patient data');
      }
      setPatients([]);  // Clear patients on error
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadAvailableFiles = async () => {
    try {
      const response = await getAvailableFiles();
      setAvailableFiles(response.files || []);
    } catch (error) {
      console.error('Failed to load available files:', error);
    }
  };

  const sanitizeFileName = (fileName: string): string => {
    // Remove file extension temporarily
    const lastDotIndex = fileName.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
    const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
    
    // Remove spaces
    let sanitized = nameWithoutExt.replace(/\s+/g, '');
    
    // Remove patterns like (1), (2), etc.
    sanitized = sanitized.replace(/\(\d+\)/g, '');
    
    // Remove parentheses if any remain
    sanitized = sanitized.replace(/[()]/g, '');
    
    // Return sanitized name with extension
    return sanitized + extension;
  };

  const handleFileUpload = async (file: File) => {
    setUploadLoading(true);
    try {
      // Create a new File object with sanitized name
      const sanitizedName = sanitizeFileName(file.name);
      const sanitizedFile = sanitizedName !== file.name 
        ? new File([file], sanitizedName, { type: file.type })
        : file;
      
      const response = await uploadCSV(sanitizedFile);
      showMessage('success', `Uploaded ${response.patient_count} patients successfully (${response.new_count || 0} new, ${response.updated_count || 0} updated)`);
      
      // Store filename and set as selected
      const uploadedFilename = response.filename || '';
      setCurrentFile(uploadedFilename || 'database');
      setSelectedFile(uploadedFilename);  // Auto-select the uploaded file
      localStorage.setItem('currentFile', uploadedFilename || 'database');
      
      // Reload available files and patient data
      await loadAvailableFiles();
      // Immediately display only patients from the uploaded file
      if (uploadedFilename) {
        await loadPatientData(uploadedFilename, false, true);
      } else {
        await loadPatientData(null, false, true);
      }
      
      // Refresh dashboard stats (but stay on upload section)
      const refreshDashboard = (window as { refreshDashboard?: () => void }).refreshDashboard;
      if (refreshDashboard) {
        refreshDashboard();
      }
      // Stay on upload section - don't navigate to dashboard
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      console.error('Upload failed:', error);
      showMessage('error', err.response?.data?.detail || 'Failed to upload file');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleBatchCall = () => {
    // No need to check for file - database always has data
    setShowConfirmModal(true);
  };

  const confirmBatchCall = async () => {
    setShowConfirmModal(false);
    setCallingInProgress(true);
    localStorage.setItem('callingInProgress', 'true');
    showMessage('info', 'Starting batch calls... This may take a few minutes.');

    try {
      const response = await triggerBatchCall(selectedFile || undefined);  // Use selected file if set
      
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
      
      // Calls are initiated, keep status for auto-refresh (only if in upload section)
      if (activeSection === 'upload') {
      startAutoRefresh();
        setTimeout(() => loadPatientData(null, true), 1000);  // Load all from DB
      }
      
      // Refresh dashboard stats after calls
      const refreshDashboard = (window as { refreshDashboard?: () => void }).refreshDashboard;
      if (refreshDashboard) {
        setTimeout(() => refreshDashboard(), 2000);  // Refresh after 2 seconds
      }
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      console.error('Batch call failed:', error);
      showMessage('error', err.response?.data?.detail || 'Batch call failed');
      setCallingInProgress(false);
      localStorage.removeItem('callingInProgress');
    }
  };

  const startAutoRefresh = () => {
    // Clear any existing interval first
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    // Only start if calls are in progress
    if (!callingInProgress) {
      return;
    }

    let count = 0;
    const maxRefreshes = 40; // 40 * 3 seconds = 2 minutes
    
    refreshIntervalRef.current = window.setInterval(() => {
      // Stop if calls are no longer in progress
      if (!callingInProgress || count >= maxRefreshes) {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
        setCallingInProgress(false);
        localStorage.removeItem('callingInProgress');
        return;
      }

      // Only refresh if we're in the upload section (where patient table is visible)
      if (activeSection === 'upload') {
        loadPatientData(null, true);  // Load all from database
      }
      
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

      // Stop after max refreshes
      if (count >= maxRefreshes) {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
        setCallingInProgress(false);
        localStorage.removeItem('callingInProgress');
        // Clear active calls that are older than 10 minutes
        setActiveCalls(new Map());
        localStorage.removeItem('activeCalls');
      }
    }, 3000);
  };

  const stopAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    setCallingInProgress(false);
    localStorage.removeItem('callingInProgress');
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
          loadPatientData(null, true, true);  // Load all from database
          // Refresh dashboard if on dashboard section
          const refreshDashboard = (window as { refreshDashboard?: () => void }).refreshDashboard;
          if (refreshDashboard && activeSection === 'dashboard') {
            refreshDashboard();
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

        {/* Top Navigation Bar */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => {
                // Stop auto-refresh when switching to dashboard
                if (refreshIntervalRef.current) {
                  clearInterval(refreshIntervalRef.current);
                  refreshIntervalRef.current = null;
                }
                setActiveSection('dashboard');
                // Refresh dashboard when switching to it
                setTimeout(() => {
                  const refreshDashboard = (window as { refreshDashboard?: () => void }).refreshDashboard;
                  if (refreshDashboard) {
                    refreshDashboard();
                  }
                }, 100);
              }}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition-colors ${
                activeSection === 'dashboard'
                  ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Dashboard
              </div>
            </button>
            <button
              onClick={() => {
                setActiveSection('upload');
                // Load patient data when switching to upload section
                loadPatientData(null, false, true);
              }}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition-colors ${
                activeSection === 'upload'
                  ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload CSV
              </div>
            </button>
          </div>
        </div>

        {/* Dashboard Section */}
        {activeSection === 'dashboard' && (
          <div className="mb-8">
            <Dashboard />
          </div>
        )}

        {/* Upload CSV Section */}
        {activeSection === 'upload' && (
          <div className="space-y-6">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Left Section: Upload CSV */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload CSV File</h2>
                <FileUpload onUpload={handleFileUpload} loading={uploadLoading} />
              </div>

              {/* Right Section: Patient Display Controls */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">View Patients</h2>
                
                {/* File Selector */}
                <div className="mb-4">
                  <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">
                    Select CSV File
                  </label>
                  <select
                    value={selectedFile}
                    onChange={async (e) => {
                      const newValue = e.target.value;
                      setSelectedFile(newValue);
                      // Immediately load data based on selection
                      if (newValue) {
                        await loadPatientData(newValue, false, true);
                      } else {
                        await loadPatientData(null, false, true);  // Load all
                      }
                    }}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">All Patients (All Files)</option>
                    {availableFiles.map((file) => (
                      <option key={file} value={file}>
                        {file}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Patient Count & Actions */}
                <div className="space-y-3">
                  <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Patients</p>
                        <p className="text-sm text-gray-900 font-medium mt-0.5">
                          {selectedFile ? `From: ${selectedFile}` : 'All Files'}
                        </p>
                  </div>
                  <span className="px-3 py-1 bg-gray-600 text-white text-xs font-semibold rounded-full">
                    {patients.length} patients
                  </span>
                </div>
              </div>
              
                  <div className="flex gap-2">
              <BatchCallButton 
                onClick={handleBatchCall}
                disabled={patients.length === 0 || callingInProgress}
                loading={callingInProgress}
              />
              
              <DownloadButton 
                      filename={selectedFile || currentFile}
                disabled={patients.length === 0}
              />
                  </div>
                </div>
              </div>
            </div>

            {/* Patient Table */}
        <PatientTable 
          patients={patients} 
          loading={loading} 
          onViewNotes={handleViewNotes}
          onCallPatient={handleCallPatient}
          activeCalls={activeCalls}
        />
          </div>
        )}


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