import axios from 'axios';
import type { Patient, BatchCallResult } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Upload CSV file
export const uploadCSV = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/upload-csv', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Get data from a specific CSV file (now uses database, filename is for backward compatibility)
export const getCSVData = async (filename: string, includeOutput: boolean = true): Promise<{ success: boolean; filename: string; count: number; patients: Patient[] }> => {
  const response = await api.get(`/csv-data/${filename}`, {
    params: { include_output: includeOutput }
  });
  return response.data;
};

// Get all patients from database (recommended)
export const getAllPatients = async (sourceFilename?: string): Promise<{ success: boolean; count: number; patients: Patient[] }> => {
  const response = await api.get('/patients', {
    params: sourceFilename ? { source_filename: sourceFilename } : {}
  });
  return response.data;
};

// Get list of available CSV files
export const getAvailableFiles = async (): Promise<{ success: boolean; files: string[]; count: number }> => {
  // Use /files/list and extract unique filenames
  interface FileUploadItem {
    id: number;
    filename: string;
    uploaded_at: string | null;
    patient_count: number;
    new_count: number;
    updated_count: number;
    error_count: number;
    created_at: string | null;
  }
  const response = await api.get<{ success: boolean; history: FileUploadItem[]; count: number }>('/files/list');
  const history = response.data.history || [];
  const uniqueFiles: string[] = Array.from(new Set(history.map((item: FileUploadItem) => item.filename).filter((f): f is string => Boolean(f))));
  return {
    success: response.data.success,
    files: uniqueFiles,
    count: uniqueFiles.length
  };
};

// Trigger batch calls (csvFilename is optional, now uses database)
export const triggerBatchCall = async (
  csvFilename?: string,
  minOutstanding: number = 0.01,
  maxCalls?: number
): Promise<BatchCallResult> => {
  const response = await api.post('/call-batch', {
    csv_filename: csvFilename,  // Optional, kept for backward compatibility
    min_outstanding: minOutstanding,
    max_calls: maxCalls,
  });
  return response.data;
};

// Call a single patient by phone number
export const callPatient = async (
  phoneNumber: string, 
  invoiceNumber?: string, 
  patientName?: string
): Promise<{ 
  success: boolean; 
  message: string;
  patient_name?: string;
  invoice_number?: string;
  outstanding_amount?: string;
  conversation_id?: string;
}> => {
  const params: { invoice_number?: string; patient_name?: string } = {};
  if (invoiceNumber) params.invoice_number = invoiceNumber;
  if (patientName) params.patient_name = patientName;
  
  const response = await api.post(`/call-patient/${phoneNumber}`, null, {
    params
  });
  return response.data;
};

// Get call history for a patient
export const getCallHistory = async (phoneNumber: string, invoiceNumber?: string): Promise<{
  success: boolean;
  patient_name: string;
  invoice_number: string;
  phone_number: string;
  calls: Array<{
    id: number;
    patient_name: string;
    phone_number: string;
    invoice_number: string;
    called_at: string | null;
    call_status: string;
    notes: string;
  }>;
  total_calls: number;
}> => {
  const params: { phone_number: string; invoice_number?: string } = { phone_number: phoneNumber };
  if (invoiceNumber) {
    params.invoice_number = invoiceNumber;
  }
  const response = await api.get('/call-history', { params });
  return response.data;
};

// Get dashboard statistics
export const getDashboardStats = async (): Promise<{
  total_invoices: number;
  total_patients: number;
  total_outstanding: number;
  total_amount_paid: number;
  links_sent: number;
  links_requested: number;
  calls_made: number;
  calls_completed: number;
  calls_pending: number;
  calls_failed: number;
  with_estimated_date: number;
  recent_calls: number;
  recent_uploads: number;
  total_files: number;
  aging_distribution: Array<{ bucket: string; count: number; total_amount: number }>;
  status_distribution: Array<{ status: string; count: number }>;
  recent_calls_list: Array<{
    patient_name: string;
    phone_number: string;
    invoice_number: string;
    called_at: string | null;
    call_status: string;
    notes: string;
  }>;
  paid_patients: Array<{
    patient_name: string;
    invoice_number: string;
    phone_number: string;
    amount_paid: number;
    payment_completed_at: string | null;
  }>;
}> => {
  const response = await api.get('/dashboard/stats');
  return response.data;
};

// Get file list with upload dates
export const getFileListWithDates = async (): Promise<{ success: boolean; files: Array<{ filename: string; upload_date: string | null; patient_count: number; new_count?: number; updated_count?: number; error_count?: number; upload_id?: number }>; count: number }> => {
  const response = await api.get('/files/list');
  return response.data;
};

// Get file upload history
export const getFileUploadHistory = async (): Promise<{ success: boolean; history: Array<{ id: number; filename: string; uploaded_at: string | null; patient_count: number; new_count: number; updated_count: number; error_count: number; created_at: string | null }>; count: number }> => {
  // Use /files/list which returns history
  const response = await api.get('/files/list');
  return response.data;
};

// Get patients by upload ID
export const getPatientsByUploadId = async (uploadId: number): Promise<{ success: boolean; filename: string; uploaded_at: string | null; count: number; patients: Patient[]; upload_stats: { patient_count: number; new_count: number; updated_count: number; error_count: number } }> => {
  const response = await api.get(`/upload/${uploadId}/patients`);
  return response.data;
};

// Get CSV data with option to filter by original source
export const getCSVDataByOriginal = async (filename: string, includeOutput: boolean = true): Promise<{ success: boolean; filename: string; count: number; patients: Patient[] }> => {
  const response = await api.get(`/csv-data/${filename}`, {
    params: { include_output: includeOutput, filter_by_original: true }
  });
  return response.data;
};

// Get calls grouped by date for calendar
export const getCallsByDate = async (startDate?: string, endDate?: string): Promise<{ calls_by_date: Record<string, Array<{ patient_name: string; invoice_number: string; called_at: string; call_status: string; outstanding_amount: number }>> }> => {
  const params: { start_date?: string; end_date?: string } = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const response = await api.get('/calendar/calls', { params });
  return response.data;
};

// Get call status for specific phone numbers (lightweight endpoint)
export const getCallStatus = async (phoneNumbers: string[]): Promise<{
  success: boolean;
  statuses: Array<{
    phone_number: string;
    invoice_number: string | null;
    call_status: string | null;
    last_called_at: string | null;
    recent_call_status: string | null;
    recent_call_at: string | null;
  }>;
}> => {
  if (phoneNumbers.length === 0) {
    return { success: true, statuses: [] };
  }
  const response = await api.get('/call-status', {
    params: { phone_numbers: phoneNumbers.join(',') }
  });
  return response.data;
};

export default api;
