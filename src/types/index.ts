export interface User {
  id: number;
  email: string;
  full_name: string;
  role?: string; // 'admin' or 'user'
  clinic?: string; // Clinic name
  ims_user_id?: string; // IMS user ID for SSO users
}

export interface Patient {
  phone_number: string;
  patient_name: string;
  invoice_number: string;
  price: string;
  outstanding_amount: string;
  aging_bucket: string;
  notes: string;
  invoice_date?: string; // Invoice date from CSV
  link_requested?: string;
  link_sent?: string;
  estimated_date?: string;
  call_status?: string;
  call_count?: number;
  last_called_at?: string;
  payment_status?: string; // pending, completed, failed, refunded
  amount_paid?: string; // Amount paid by patient
  recent_call_notes?: string; // Most recent call notes from call history
}

export interface CSVFile {
  filename: string;
  size: number;
  last_modified: string;
  patient_count: number;
}

export interface FileWithDate {
  filename: string;
  upload_date: string | null;
  patient_count: number;
}

export interface CalendarCall {
  patient_name: string;
  invoice_number: string;
  called_at: string;
  call_status: string;
  outstanding_amount: number;
}

export interface BatchCallResult {
  success: boolean;
  message: string;
  results: {
    total_attempted: number;
    successful: number;
    failed: number;
    calls: Array<{
      patient_name: string;
      phone_number: string;
      outstanding_amount: string;
      timestamp: string;
      success: boolean;
      conversation_id?: string;
    }>;
  };
}

export interface Message {
  type: 'success' | 'error' | 'info';
  text: string;
}
