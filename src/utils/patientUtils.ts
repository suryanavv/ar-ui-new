import type { Patient } from '../types';

/**
 * Create a unique key for each patient record
 * Format: phone|invoice|firstName|lastName
 */
export const getPatientCallKey = (patient: Patient): string => {
  const phone = patient.phone_number || '';
  const invoice = patient.invoice_number || '';
  const firstName = patient.patient_first_name || '';
  const lastName = patient.patient_last_name || '';
  return `${phone}|${invoice}|${firstName}|${lastName}`;
};

/**
 * Get full name from patient
 */
export const getPatientFullName = (patient: Patient): string => {
  const first = patient.patient_first_name || '';
  const last = patient.patient_last_name || '';
  return `${first} ${last}`.trim() || 'Unknown';
};

