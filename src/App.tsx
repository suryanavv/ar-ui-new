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
  CallHistoryModal,
  LoginPage,
  Dashboard,
  InvoiceList,
  ToastContainer,
  useToast
} from './components';
import { uploadCSV, getCSVData, getAllPatients, getAvailableFiles, triggerBatchCall, callPatient, getCallStatus, getFileUploadHistory, getPatientsByUploadId } from './services/api';
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
  const [activeSection, setActiveSection] = useState<'dashboard' | 'upload' | 'invoice-list'>('dashboard');  // Dashboard by default
  const [uploadLoading, setUploadLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [callingInProgress, setCallingInProgress] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCallConfirmModal, setShowCallConfirmModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showCallHistoryModal, setShowCallHistoryModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientToCall, setPatientToCall] = useState<Patient | null>(null);
  const [activeCalls, setActiveCalls] = useState<Map<string, number>>(new Map()); // phone_number -> timestamp
  const activeCallsRef = useRef<Map<string, number>>(new Map()); // Ref to track active calls for refresh logic
  const refreshIntervalRef = useRef<number | null>(null);
  const patientsRef = useRef<Patient[]>([]); // Ref to track patients for refresh logic
  const { toasts, showToast, removeToast } = useToast();

  // Check if user is already logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(storedUser));
    }
    
    // Restore current file from localStorage (but not call status - fetch fresh from server)
    const storedCurrentFile = localStorage.getItem('currentFile');
    if (storedCurrentFile) {
      setCurrentFile(storedCurrentFile);
    }
    
    // Don't restore callingInProgress from localStorage - always fetch fresh status from server
    // Clear any stale calling status
    localStorage.removeItem('callingInProgress');
    
    // Don't restore active calls from localStorage - they may be stale
    // Clear any stale active calls
    localStorage.removeItem('activeCalls');
    
    setCheckingAuth(false);
  }, []);

  // Load patient data and available files when app loads (from database)
  useEffect(() => {
    if (!checkingAuth && isAuthenticated) {
      loadAvailableFiles();  // Load list of available files
      // Only load patient data if we're in upload section
      if (activeSection === 'upload') {
        loadPatientData(null, false, true);  // Load all from database - get fresh status
      }
      // Don't resume auto-refresh on page load - always fetch fresh data from server
      // The server will have the actual call status, not stale localStorage state
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
      let response;
      if (filename) {
        // When filtering by filename, get the most recent upload for that filename
        // First, get file upload history to find the most recent upload_id for this filename
        try {
          const fileHistory = await getFileUploadHistory();
          interface FileUpload {
            id: number;
            filename: string;
            uploaded_at: string | null;
            patient_count: number;
            new_count: number;
            updated_count: number;
            error_count: number;
            created_at: string | null;
          }
          const uploadsForFile = (fileHistory.history || [] as FileUpload[])
            .filter((upload: FileUpload) => upload.filename === filename)
            .sort((a: FileUpload, b: FileUpload) => {
              const dateA = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
              const dateB = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
              return dateB - dateA; // Most recent first
            });
          
          if (uploadsForFile.length > 0) {
            // Use the most recent upload_id for this filename
            const mostRecentUploadId = uploadsForFile[0].id;
            response = await getPatientsByUploadId(mostRecentUploadId);
          } else {
            // Fallback to filename-based filtering if no upload found
            response = await getCSVData(filename, includeOutput);
          }
        } catch (error) {
          console.error('Failed to get upload history, falling back to filename filter:', error);
          // Fallback to filename-based filtering
          response = await getCSVData(filename, includeOutput);
        }
      } else {
        response = await getAllPatients();  // Get all patients
      }
      const updatedPatients = response.patients || [];
      setPatients(updatedPatients);
      patientsRef.current = updatedPatients; // Update ref for refresh logic
    } catch (error) {
      console.error('Failed to load patient data:', error);
      if (!silent) {
        showMessage('error', 'Failed to load patient data');
      }
      setPatients([]);  // Clear patients on error
      patientsRef.current = [];
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
      const errorCount = response.errors?.length || 0;
      
      // Use the message from backend if available, otherwise construct one
      if (response.message) {
        // Show success message
        showMessage('success', response.message);
        
        // If there are errors, also show them
        if (errorCount > 0) {
          const errorDetails = response.errors?.slice(0, 3).map((e: { patient_name?: string; invoice_number?: string; error?: string }) => {
            const patient = e.patient_name || 'Unknown';
            const invoice = e.invoice_number || '';
            const error = e.error || 'Unknown error';
            return `${patient} (${invoice}): ${error.substring(0, 50)}${error.length > 50 ? '...' : ''}`;
          }).join('; ') || '';
          
          setTimeout(() => {
            showMessage(
              'error',
              `${errorCount} error(s) occurred during upload. ${errorCount <= 3 ? errorDetails : errorDetails + '...'}`
            );
          }, 1000);
        }
      } else {
        const newCount = response.new_count || 0;
        const updatedCount = response.updated_count || 0;
        if (newCount > 0 || updatedCount > 0) {
          showMessage('success', `Uploaded ${response.patient_count} patients successfully (${newCount} new, ${updatedCount} updated)`);
          if (errorCount > 0) {
            setTimeout(() => {
              showMessage('error', `${errorCount} error(s) occurred during upload. Check console for details.`);
            }, 1000);
          }
        } else {
          showMessage('info', `Processed ${response.patient_count} patients. All records already exist in database.`);
          if (errorCount > 0) {
            setTimeout(() => {
              showMessage('error', `${errorCount} error(s) occurred during upload. Check console for details.`);
            }, 1000);
          }
        }
      }
      
      // Log errors to console for debugging
      if (errorCount > 0 && response.errors) {
        console.error('Upload errors:', response.errors);
      }
      
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
          activeCallsRef.current = newActiveCalls; // Update ref
        
        // Store in localStorage
        const activeCallsData = Array.from(newActiveCalls.entries());
        localStorage.setItem('activeCalls', JSON.stringify(activeCallsData));
      }
      
      showMessage('success', response.message);
      
      // Immediately refresh patient table to show updated data (silent)
      if (activeSection === 'upload') {
        // Immediate refresh right after batch call
        loadPatientData(null, true, true);
        
        // Start smart auto-refresh that stops when calls complete
        startSmartAutoRefresh();
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

  const startSmartAutoRefresh = () => {
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
    const maxRefreshes = 60; // Maximum 60 refreshes (2 minutes max)
    const refreshInterval = 2000; // Check every 2 seconds
    
    const checkAndRefresh = async () => {
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

      // Only refresh if we're in the upload section
      if (activeSection === 'upload') {
        const currentActiveCalls = activeCallsRef.current;
        
        // Use lightweight call status endpoint for active calls
        if (currentActiveCalls.size > 0) {
          const phoneNumbers = Array.from(currentActiveCalls.keys());
          
          try {
            // Check call status using lightweight endpoint
            const statusResponse = await getCallStatus(phoneNumbers);
            
            if (statusResponse.success && statusResponse.statuses) {
              // Check if any calls are still pending/in progress
              let hasPendingCalls = false;
              let allCallsCompleted = true;
              
              statusResponse.statuses.forEach((status) => {
                const callStatus = status.recent_call_status || status.call_status;
                // If status is 'sent' or 'pending', call might still be in progress
                if (callStatus === 'sent' || callStatus === 'pending' || !callStatus) {
                  hasPendingCalls = true;
                  allCallsCompleted = false;
                } else if (callStatus === 'completed' || callStatus === 'failed') {
                  // Call is done, but check others
                }
              });
              
              // If all calls are completed/failed and enough time has passed, stop refreshing
              if (!hasPendingCalls && allCallsCompleted && count >= 3) {
                // Refresh full patient data once to get final updates
                await loadPatientData(null, true, true);
                
                // Stop refreshing
                if (refreshIntervalRef.current) {
                  clearInterval(refreshIntervalRef.current);
                  refreshIntervalRef.current = null;
                }
                setCallingInProgress(false);
                localStorage.removeItem('callingInProgress');
                return;
              }
              
              // If calls are still pending, refresh full patient data every 5th check (every 10 seconds)
              // This ensures UI stays updated but doesn't overload the server
              if (count % 5 === 0) {
                await loadPatientData(null, true, true);
              }
            }
          } catch (error) {
            console.error('Failed to check call status:', error);
            // Fallback to full refresh if status check fails
            if (count % 3 === 0) {
              await loadPatientData(null, true, true);
            }
          }
        } else {
          // No active calls, refresh full data once and stop
          await loadPatientData(null, true, true);
          if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
          }
          setCallingInProgress(false);
          localStorage.removeItem('callingInProgress');
          return;
        }
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
          
        activeCallsRef.current = newActiveCalls; // Update ref
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
        activeCallsRef.current = new Map(); // Update ref
        localStorage.removeItem('activeCalls');
      }
    };
    
    // Start the interval
    refreshIntervalRef.current = window.setInterval(checkAndRefresh, refreshInterval);
    
    // Also do an immediate first refresh
    if (activeSection === 'upload') {
      loadPatientData(null, true, true);
    }
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

  const handleViewCallHistory = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowCallHistoryModal(true);
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

  const confirmCallPatient = async () => {
    if (!patientToCall) {
      setShowCallConfirmModal(false);
      return;
    }

    const patient = patientToCall;
    setShowCallConfirmModal(false);
    setPatientToCall(null);

    try {
      showMessage('info', `Calling ${patient.patient_name} at ${patient.phone_number}...`);
      const response = await callPatient(
        patient.phone_number,
        patient.invoice_number,
        patient.patient_name
      );
      
      if (response.success) {
        // Track this call as active
        const newActiveCalls = new Map(activeCalls);
        newActiveCalls.set(patient.phone_number, Date.now());
        setActiveCalls(newActiveCalls);
        activeCallsRef.current = newActiveCalls; // Update ref
        localStorage.setItem('activeCalls', JSON.stringify(Array.from(newActiveCalls.entries())));
        
        showMessage('success', response.message || `Call initiated to ${patient.patient_name}`);
        showToast('success', `Call initiated to ${patient.patient_name}`);
        
        // Refresh patient table to show updated call status immediately
        if (activeSection === 'upload') {
          // Immediate refresh right after call
          loadPatientData(null, true, true);
          
          // Start smart refresh using lightweight call status endpoint
          let refreshCount = 0;
          const maxRefreshes = 30; // Check 30 times (60 seconds max for single call)
          const singleCallRefreshInterval = setInterval(async () => {
            if (activeSection === 'upload' && refreshCount < maxRefreshes) {
              try {
                // Use lightweight endpoint to check call status
                const statusResponse = await getCallStatus([patient.phone_number]);
                
                if (statusResponse.success && statusResponse.statuses.length > 0) {
                  const status = statusResponse.statuses[0];
                  const callStatus = status.recent_call_status || status.call_status;
                  
                  // If call is completed or failed, refresh full data and stop
                  if (callStatus === 'completed' || callStatus === 'failed') {
                    await loadPatientData(null, true, true);
                    clearInterval(singleCallRefreshInterval);
                    return;
                  }
                }
                
                // Refresh full patient data every 5th check (every 10 seconds)
                if (refreshCount % 5 === 0) {
                  await loadPatientData(null, true, true);
                }
              } catch (error) {
                console.error('Failed to check call status:', error);
                // Fallback to full refresh
                if (refreshCount % 3 === 0) {
                  await loadPatientData(null, true, true);
                }
              }
              
              refreshCount++;
            } else {
              clearInterval(singleCallRefreshInterval);
            }
          }, 2000); // Every 2 seconds
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
        <ToastContainer toasts={toasts} onRemove={removeToast} />

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
            <button
              onClick={() => {
                setActiveSection('invoice-list');
              }}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition-colors ${
                activeSection === 'invoice-list'
                  ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Invoice List
              </div>
            </button>
          </div>
        </div>

        {/* Dashboard Section */}
        {activeSection === 'dashboard' && (
          <div className="mb-8 space-y-6">
            <Dashboard />
          </div>
        )}

        {/* Invoice List Section */}
        {activeSection === 'invoice-list' && (
          <div className="mb-8">
            <InvoiceList
              onFileSelect={() => {
                // Upload selected, stay on invoice-list to show invoices
              }}
            />
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
                      setCurrentFile(newValue || 'database');
                      // Immediately load data based on selection - always filter by filename when selected
                      if (newValue) {
                        // Always filter by the selected filename
                        await loadPatientData(newValue, false, true);
                      } else {
                        // Load all when "All Patients" is selected
                        await loadPatientData(null, false, true);
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">All Patients</h3>
              <PatientTable 
                patients={patients} 
                loading={loading} 
                onViewNotes={handleViewNotes}
                onCallPatient={handleCallPatient}
                onViewCallHistory={handleViewCallHistory}
                activeCalls={activeCalls}
              />
            </div>
          </div>
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
          message={`Are you sure you want to call ${patientToCall?.patient_name || 'this patient'} at ${patientToCall?.phone_number || ''}?`}
          onConfirm={confirmCallPatient}
          onCancel={() => {
            setShowCallConfirmModal(false);
            setPatientToCall(null);
          }}
        />

        <NotesModal
          isOpen={showNotesModal}
          patientName={selectedPatient?.patient_name || ''}
          notes={selectedPatient?.notes || ''}
          onClose={() => setShowNotesModal(false)}
        />

        <CallHistoryModal
          isOpen={showCallHistoryModal}
          patientName={selectedPatient?.patient_name || ''}
          phoneNumber={selectedPatient?.phone_number || ''}
          invoiceNumber={selectedPatient?.invoice_number || ''}
          onClose={() => setShowCallHistoryModal(false)}
        />
      </div>
    </div>
  );
}

export default App;