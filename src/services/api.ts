import axios from 'axios';
import type { Patient, BatchCallResult } from '../types';
import { formatDateTime } from '../utils/timezone';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Queue pattern for handling concurrent requests during token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown = null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120 seconds timeout for long-running requests (e.g., /patients)
});

// Request interceptor to add authentication token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 token refresh and network errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ============================================
    // FIRST: Handle 401 Unauthorized (Token Expired)
    // ============================================
    if (error.response?.status === 401 && !originalRequest._tokenRefreshRetry) {
      
      // Check if refresh token exists
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        // No refresh token available - redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/?session_expired=true';
        return Promise.reject(error);
      }

      // Mark this request as a token refresh retry
      originalRequest._tokenRefreshRetry = true;

      if (isRefreshing) {
        // Token refresh already in progress - queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      // Start token refresh process
      isRefreshing = true;

      try {
        // Use a CLEAN axios instance without interceptors to avoid infinite loops
        const response = await axios.post(
          `${API_BASE_URL}/refresh`,
          { refresh_token: refreshToken },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
          }
        );

        const newAccessToken = response.data.access_token;
        
        // Update localStorage with new access token
        localStorage.setItem('access_token', newAccessToken);
        
        // Update the failed request's Authorization header
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        
        // Process all queued requests with the new token
        processQueue(null, newAccessToken);
        
        // Reset the refreshing flag
        isRefreshing = false;
        
        // Retry the original request with new token
        return api(originalRequest);
        
      } catch (refreshError) {
        // Refresh token failed - clear everything and redirect to login
        processQueue(refreshError, null);
        isRefreshing = false;
        
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        window.location.href = '/?session_expired=true';
        return Promise.reject(refreshError);
      }
    }

    // ============================================
    // SECOND: Handle Network Errors (Existing Logic)
    // ============================================
    if (
      (error.code === 'ERR_NETWORK' || 
       error.code === 'ECONNABORTED' || 
       error.message?.includes('timeout') ||
       error.message?.includes('Network Error')) &&
      !originalRequest._networkRetry &&
      (originalRequest._networkRetryCount || 0) < 2
    ) {
      originalRequest._networkRetry = true;
      originalRequest._networkRetryCount = (originalRequest._networkRetryCount || 0) + 1;

      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, originalRequest._networkRetryCount) * 1000; // 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry the request
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

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


// Get patient details by ID or patient identifiers (uses unified /patients endpoint)
export const getPatientDetails = async (
  invoiceId?: number,
  phoneNumber?: string,
  invoiceNumber?: string,
  patientFirstName?: string,
  patientLastName?: string
): Promise<{ success: boolean; patient: Patient }> => {
  const params: Record<string, string | number | undefined> = {};
  if (invoiceId) {
    params.invoice_id = invoiceId;
  }
  if (phoneNumber) {
    params.phone_number = phoneNumber;
  }
  if (invoiceNumber) {
    params.invoice_number = invoiceNumber;
  }
  if (patientFirstName) {
    params.patient_first_name = patientFirstName;
  }
  if (patientLastName) {
    params.patient_last_name = patientLastName;
  }
  
  // Use unified /patients endpoint - returns single patient when detail params are provided
  const response = await api.get('/patients', { params });
  return response.data;
};

// Get all patients from database (recommended)
export const getAllPatients = async (sourceFilename?: string): Promise<{ success: boolean; count: number; patients: Patient[] }> => {
  const response = await api.get('/patients', {
    params: sourceFilename ? { source_filename: sourceFilename } : {}
  });
  return response.data;
};

// File upload item interface
export interface FileUploadItem {
  id: number;
  filename: string;
  uploaded_at: string | null;
  patient_count: number;
  new_count: number;
  updated_count: number;
  error_count: number;
  created_at: string | null;
}

// Get list of available CSV files - returns all uploads with formatted display names
export const getAvailableFiles = async (): Promise<{ success: boolean; files: Array<{ id: number; filename: string; displayName: string; uploaded_at: string | null; patient_count: number }>; count: number }> => {
  // Use unified /files endpoint - returns history when no upload_id is provided
  const response = await api.get<{ success: boolean; history: FileUploadItem[]; count: number }>('/files');
  const history = response.data.history || [];
  
  // Format display name with date and time in system timezone
  const formatDisplayName = (item: FileUploadItem): string => {
    const filename = item.filename || 'Unknown';
    if (item.uploaded_at) {
      // Use formatDateTime utility which handles UTC to local timezone conversion
      // and formats according to system timezone settings
      const formattedDateTime = formatDateTime(item.uploaded_at, {
        includeDate: true,
        includeTime: true,
        hour12: true
      });
      
      if (formattedDateTime && formattedDateTime !== 'N/A') {
        return `${filename} - ${formattedDateTime}`;
      }
    }
    return filename;
  };
  
  // Return all uploads with formatted display names, sorted by most recent first
  const files = history
    .map((item: FileUploadItem) => ({
    id: item.id,
    filename: item.filename,
    displayName: formatDisplayName(item),
    uploaded_at: item.uploaded_at,
      patient_count: item.patient_count
    }))
    .sort((a, b) => {
      const dateA = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
      const dateB = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
    return dateB - dateA; // Most recent first
  });
  
  return {
    success: response.data.success,
    files,
    count: files.length
  };
};

// Trigger batch calls (uploadId or csvFilename is optional, now uses database)
export const triggerBatchCall = async (
  csvFilename?: string,
  minOutstanding: number = 0.01,
  maxCalls?: number,
  uploadId?: number
): Promise<BatchCallResult> => {
  const response = await api.post('/call-batch', {
    csv_filename: csvFilename,  // Optional, kept for backward compatibility
    upload_id: uploadId,  // Filter by specific upload ID (takes precedence over csv_filename)
    min_outstanding: minOutstanding,
    max_calls: maxCalls,
  });
  return response.data;
};

// Call a single patient by phone number
export const callPatient = async (
  phoneNumber: string, 
  invoiceNumber?: string, 
  patientFirstName?: string,
  patientLastName?: string
): Promise<{ 
  success: boolean; 
  message: string;
  patient_first_name?: string;
  patient_last_name?: string;
  invoice_number?: string;
  outstanding_amount?: string;
  conversation_id?: string;
}> => {
  const params: { invoice_number?: string; patient_first_name?: string; patient_last_name?: string } = {};
  if (invoiceNumber) params.invoice_number = invoiceNumber;
  if (patientFirstName) params.patient_first_name = patientFirstName;
  if (patientLastName) params.patient_last_name = patientLastName;
  
  const response = await api.post(`/call-patient/${phoneNumber}`, null, {
    params
  });
  return response.data;
};

// Get real-time call status from Twilio and ElevenLabs
export const getCallStatus = async (callSid: string): Promise<{
  success: boolean;
  call_sid: string;
  twilio: {
    success: boolean;
    call_sid: string;
    status: string; // queued, ringing, in-progress, completed, busy, failed, no-answer, canceled
    duration: number | null;
    start_time: string | null;
    end_time: string | null;
    direction: string;
    from_number: string;
    to_number: string;
  } | null;
  elevenlabs: {
    success: boolean;
    conversation_id: string;
    status: string;
    metadata: Record<string, unknown>;
  } | null;
  database: {
    call_status: string;
    conversation_id: string | null;
    notes: string;
    called_at: string | null;
    patient_first_name: string;
    patient_last_name: string;
    invoice_number: string;
    phone_number: string;
  };
}> => {
  const response = await api.get(`/status/${callSid}`);
  return response.data;
};

// End an active call by conversation ID
export const endCall = async (conversationId: string): Promise<{
  success: boolean;
  message: string;
  conversation_id?: string;
}> => {
  const response = await api.post(`/end-call/${conversationId}`);
  return response.data;
};

// Get call history for a patient
export const getCallHistory = async (
  phoneNumber: string, 
  invoiceNumber?: string,
  patientFirstName?: string,
  patientLastName?: string,
  patientDob?: string
): Promise<{
  success: boolean;
  patient_first_name: string;
  patient_last_name: string;
  invoice_number: string;
  phone_number: string;
  calls: Array<{
    id: number;
    patient_first_name: string;
    patient_last_name: string;
    phone_number: string;
    invoice_number: string;
    called_at: string | null;
    call_status: string;
    notes: string;
  }>;
  total_calls: number;
}> => {
  const params: { 
    phone_number: string; 
    invoice_number?: string;
    patient_first_name?: string;
    patient_last_name?: string;
    patient_dob?: string;
  } = { phone_number: phoneNumber };
  
  if (invoiceNumber) {
    params.invoice_number = invoiceNumber;
  }
  if (patientFirstName) {
    params.patient_first_name = patientFirstName;
  }
  if (patientLastName) {
    params.patient_last_name = patientLastName;
  }
  if (patientDob) {
    params.patient_dob = patientDob;
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
    patient_first_name: string;
    patient_last_name: string;
    phone_number: string;
    invoice_number: string;
    called_at: string | null;
    call_status: string;
    notes: string;
  }>;
  paid_patients: Array<{
    patient_first_name: string;
    patient_last_name: string;
    invoice_number: string;
    phone_number: string;
    amount_paid: number;
    payment_completed_at: string | null;
  }>;
}> => {
  const response = await api.get('/dashboard/stats');
  return response.data;
};


// Get file upload history (uses unified /files endpoint)
export const getFileUploadHistory = async (): Promise<{ success: boolean; history: Array<{ id: number; filename: string; uploaded_at: string | null; patient_count: number; new_count: number; updated_count: number; error_count: number; created_at: string | null }>; count: number }> => {
  // Use unified /files endpoint - returns history when no upload_id is provided
  const response = await api.get('/files');
  return response.data;
};

// Get patients by upload ID (uses unified /files endpoint)
export const getPatientsByUploadId = async (uploadId: number): Promise<{ success: boolean; filename: string; uploaded_at: string | null; count: number; patients: Patient[]; upload_stats: { patient_count: number; new_count: number; updated_count: number; error_count: number } }> => {
  // Use unified /files endpoint - returns patients when upload_id is provided
  const response = await api.get('/files', {
    params: { upload_id: uploadId }
  });
  return response.data;
};


// Get calls grouped by date for calendar
export const getCallsByDate = async (startDate?: string, endDate?: string): Promise<{ calls_by_date: Record<string, Array<{ patient_first_name: string; patient_last_name: string; invoice_number: string; called_at: string; call_status: string; outstanding_amount: number }>> }> => {
  const params: { start_date?: string; end_date?: string } = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const response = await api.get('/calendar/calls', { params });
  return response.data;
};


// User Management APIs
export const getUsers = async (): Promise<{ success: boolean; users: Array<{
  id: number;
  email: string;
  full_name: string;
  role: string;
  clinic: string;
  is_active: boolean;
  created_at: string;
  ims_user_id: string | null;
}> }> => {
  const response = await api.get('/users/');
  // Backend returns array directly, wrap it in expected format
  return { success: true, users: response.data };
};

export const createUser = async (userData: {
  email: string;
  full_name: string;
  password: string;
  role: string;
}): Promise<{ success: boolean; user: {
  id: number;
  email: string;
  full_name: string;
  role: string;
  clinic: string;
  is_active: boolean;
  created_at: string;
} }> => {
  const response = await api.post('/users/', userData);
  return response.data;
};

export const updateUser = async (userId: number, updates: {
  is_active?: boolean;
  role?: string;
  full_name?: string;
}): Promise<{ success: boolean; user: {
  id: number;
  email: string;
  full_name: string;
  role: string;
  clinic: string;
  is_active: boolean;
  created_at: string;
} }> => {
  const response = await api.put(`/users/${userId}/`, updates);
  return response.data;
};

export default api;
