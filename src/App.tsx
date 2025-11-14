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
import { uploadCSV, getCSVData, triggerBatchCall } from './services/api';
import type { Patient, Message } from './types';

function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
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
  const refreshIntervalRef = useRef<number | null>(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(storedUser));
    }
    
    setCheckingAuth(false);
  }, []);

  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Handle login
  const handleLogin = (_token: string, userData: any) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setCurrentFile('');
    setPatients([]);
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
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const isValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValid) {
      showMessage('error', 'Please upload CSV, XLSX, or XLS file');
      return;
    }

    setUploadLoading(true);
    try {
      const response = await uploadCSV(file);
      showMessage('success', `Parsed ${response.patient_count} patients successfully`);
      
      setCurrentFile(response.filename);
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
    showMessage('info', 'Starting batch calls... This may take a few minutes.');

    try {
      const response = await triggerBatchCall(currentFile);
      showMessage('success', response.message);
      
      startAutoRefresh();
      setTimeout(() => loadPatientData(currentFile, true), 1000);
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      console.error('Batch call failed:', error);
      showMessage('error', err.response?.data?.detail || 'Batch call failed');
    } finally {
      setCallingInProgress(false);
    }
  };

  const startAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    let count = 0;
    refreshIntervalRef.current = window.setInterval(() => {
      if (currentFile && count < 40) {
        loadPatientData(currentFile, true);
        count++;
      } else {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
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
    <div className="max-w-7xl mx-auto px-6 py-8">
      <Header user={user} onLogout={handleLogout} />

      {message && <MessageAlert message={message} />}

      <div className="flex items-center gap-4 mb-8 px-6 py-5 bg-white rounded-2xl shadow-sm flex-wrap">
        <FileUpload onUpload={handleFileUpload} loading={uploadLoading} />
        
        {currentFile && (
          <>
            <div className="flex-1 px-4 py-3 bg-purple-50 rounded-xl border-2 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-semibold uppercase tracking-wide">Current File</p>
                  <p className="text-sm text-gray-900 font-medium mt-0.5">{currentFile}</p>
                </div>
                <span className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">
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
          </>
        )}
      </div>

      <PatientTable patients={patients} loading={loading} onViewNotes={handleViewNotes} />

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
  );
}

export default App;