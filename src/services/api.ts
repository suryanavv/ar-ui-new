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

// Get data from a specific CSV file
export const getCSVData = async (filename: string, includeOutput: boolean = true): Promise<{ success: boolean; filename: string; count: number; patients: Patient[] }> => {
  const response = await api.get(`/csv-data/${filename}`, {
    params: { include_output: includeOutput }
  });
  return response.data;
};

// Trigger batch calls for a specific CSV
export const triggerBatchCall = async (
  csvFilename: string,
  minOutstanding: number = 0.01,
  maxCalls?: number
): Promise<BatchCallResult> => {
  const response = await api.post('/call-batch', {
    csv_filename: csvFilename,
    min_outstanding: minOutstanding,
    max_calls: maxCalls,
  });
  return response.data;
};

export default api;
