export interface User {
  id: number;
  email: string;
  full_name: string;
  role?: string; // 'admin' or 'user'
  clinic?: string; // Clinic name
  ims_user_id?: string; // IMS user ID for SSO users
  payment_provider?: string; // Payment provider from SSO token
  payment_provider_guid?: string; // Payment provider GUID from SSO token
}

export interface Appointment {
  id: number;
  appointment_date: string;
  appointment_date_display: string;
  billed_fee: string;
  insurance_covered: string;
  balance: string;
  insurance_company: string;
}

export interface Patient {
  id?: number; // Invoice ID
  phone_number: string;
  patient_first_name: string;
  patient_last_name: string;
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
  appointment_count?: number; // Number of appointments
  appointments?: Appointment[]; // Detailed appointment list
  total_outstanding_amount?: string; // Total outstanding across all appointments
  last_called_at?: string;
  payment_status?: string; // pending, completed, failed, refunded
  amount_paid?: string; // Amount paid by patient
  recent_call_notes?: string; // Most recent call notes from call history
  last_3_attempts?: string[]; // Last 3 call attempts for hover tooltip
  // Additional fields for detailed view
  patient_dob?: string;
  patient_dob_display?: string; // Formatted date of birth (MM/DD/YYYY)
  patient_account_number?: string;
  primary_insurance_company?: string; // Insurance company from primary appointment
  provider_name?: string;
  appointment_date_time?: string;
  insurance?: string;
  network_status?: string;
  eligibility_status?: string;
  family_deductible?: string;
  family_deductible_remaining?: string;
  individual_oop_max?: string;
  individual_oop_remaining?: string;
  copay?: string;
  coinsurance?: string;
  coverage_notes?: string;
  coverage_effective_from?: string;
  coverage_effective_to?: string;
  anticipated_cpt_code?: string;
  preventive_services_covered?: string;
  pcp_details?: string;
  comments?: string;
  amount_paid_stripe?: string;
  amount_paid_other?: string;
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
  patient_first_name: string;
  patient_last_name: string;
  invoice_number: string;
  called_at: string;
  call_status: string;
  outstanding_amount: number;
}

export interface BatchCallResult {
  success: boolean;
  message: string;
  results: {
    total_patients?: number | null; // Total patients in selection (before filtering)
    eligible_count?: number; // Number of patients eligible for calling
    filtered_out_count?: number | null; // Number of patients filtered out
    total_attempted: number;
    successful: number;
    failed: number;
    calls: Array<{
      patient_first_name: string;
      patient_last_name: string;
      patient_dob?: string;
      phone_number: string;
      invoice_number: string;
      outstanding_amount: string;
      timestamp: string;
      success: boolean;
      conversation_id?: string;
      call_sid?: string;
    }>;
  };
}

export interface Message {
  type: 'success' | 'error' | 'info';
  text: string;
}
