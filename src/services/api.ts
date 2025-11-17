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
  const response = await api.get('/files');
  return response.data;
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
export const callPatient = async (phoneNumber: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.post(`/call-patient/${phoneNumber}`);
  return response.data;
};

// Get dashboard statistics
export const getDashboardStats = async (): Promise<{
  total_invoices: number;
  total_patients: number;
  total_outstanding: number;
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
}> => {
  const response = await api.get('/dashboard/stats');
  return response.data;
};

export default api;
