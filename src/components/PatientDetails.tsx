import { useState, useEffect } from 'react';
import { FiX, FiUser, FiFileText, FiShield, FiEdit2, FiCheck } from 'react-icons/fi';
import { getPatientDetails, updatePatient } from '../services/api';
import type { Patient } from '../types';

interface PatientDetailsProps {
  invoiceId?: number;
  phoneNumber?: string;
  invoiceNumber?: string;
  patientFirstName?: string;
  patientLastName?: string;
  onClose: () => void;
  isOpen?: boolean;
}

export const PatientDetails = ({ 
  invoiceId, 
  phoneNumber, 
  invoiceNumber, 
  patientFirstName, 
  patientLastName,
  onClose, 
  isOpen = true 
}: PatientDetailsProps) => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDOB, setEditingDOB] = useState(false);
  const [dobValue, setDobValue] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchPatientDetails = async () => {
      // Check if modal is open and we have enough information to fetch
      if (!isOpen) {
        return;
      }
      
      // Reset state when opening
      setPatient(null);
      setError(null);
      setLoading(true);
      
      // Check if we have enough information
      const hasPhoneNumber = phoneNumber && phoneNumber.trim() !== '' && phoneNumber.toLowerCase() !== 'nan';
      // invoice_number no longer required - removed from validation
      const hasFirstName = patientFirstName && patientFirstName.trim() !== '' && patientFirstName.toLowerCase() !== 'nan';
      const hasLastName = patientLastName && patientLastName.trim() !== '' && patientLastName.toLowerCase() !== 'nan';
      
      if (!invoiceId && (!hasPhoneNumber || !hasFirstName || !hasLastName)) {
        const missingFields = [];
        if (!hasPhoneNumber) missingFields.push('phone number');
        if (!hasFirstName) missingFields.push('first name');
        if (!hasLastName) missingFields.push('last name');
        setError(`Insufficient information to load patient details. Missing: ${missingFields.join(', ')}`);
        setLoading(false);
        return;
      }

      try {
        const response = await getPatientDetails(
          invoiceId,
          phoneNumber,
          invoiceNumber,
          patientFirstName,
          patientLastName
        );
        if (response.success) {
          setPatient(response.patient);
        } else {
          setError('Failed to load patient details');
        }
      } catch (err) {
        let errorMessage = 'Failed to load patient details';
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosError = err as { response?: { data?: { detail?: string } } };
          errorMessage = axiosError.response?.data?.detail || errorMessage;
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchPatientDetails();
    }
  }, [invoiceId, phoneNumber, invoiceNumber, patientFirstName, patientLastName, isOpen]);

  // Handle DOB update
  const handleSaveDOB = async () => {
    if (!patient?.id || updating) return;
    
    try {
      setUpdating(true);
      await updatePatient(patient.id, { patient_dob: dobValue });
      // Refresh patient details
      const response = await getPatientDetails(
        invoiceId,
        phoneNumber,
        invoiceNumber,
        patientFirstName,
        patientLastName
      );
      if (response.success) {
        setPatient(response.patient);
      }
      setEditingDOB(false);
      setDobValue('');
    } catch (error) {
      console.error('Failed to update DOB:', error);
      alert('Failed to update DOB. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  // Always render the modal backdrop if isOpen is true, even if there's an error
  if (!isOpen) {
    return null;
  }

  const formatCurrency = (amount: string | number | undefined): string => {
    if (!amount) return '$0.00';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(numAmount);
  };

  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';
    try {
      // For date-only fields (like DOB), parse components directly to avoid timezone conversion
      const dateParts = dateStr.split('T')[0].split('-'); // Get YYYY-MM-DD part
      if (dateParts.length === 3) {
        const [year, month, day] = dateParts.map(p => parseInt(p, 10));
        // Create date using local timezone components (no conversion)
        const date = new Date(year, month - 1, day); // month is 0-indexed
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      // Fallback for other formats
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading patient details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Error</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FiX size={24} />
            </button>
          </div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // If no patient data after loading completes, show message
  if (!loading && !error && !patient) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">No Data</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FiX size={24} />
            </button>
          </div>
          <p className="text-gray-600 mb-4">No patient data available.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // If still loading or has error, those states are already rendered above
  if (loading || error || !patient) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-teal-600 to-cyan-600 text-white p-6 rounded-t-lg flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FiUser />
              Patient Information
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors p-2"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Patient Information */}
          <section className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FiUser className="text-teal-600" />
              Patient Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">First Name</label>
                <p className="text-gray-900">{patient.patient_first_name || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Last Name</label>
                <p className="text-gray-900">{patient.patient_last_name || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Date of Birth</label>
                {editingDOB ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={dobValue}
                      onChange={(e) => setDobValue(e.target.value)}
                      placeholder="MM/DD/YYYY"
                      className="flex-1 px-3 py-2 border border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      autoFocus
                      disabled={updating}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveDOB();
                        } else if (e.key === 'Escape') {
                          setEditingDOB(false);
                          setDobValue('');
                        }
                      }}
                    />
                    <button
                      onClick={handleSaveDOB}
                      disabled={updating}
                      className="p-2 text-green-600 hover:text-green-800 disabled:opacity-50 transition-colors"
                      title="Save"
                    >
                      <FiCheck size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingDOB(false);
                        setDobValue('');
                      }}
                      disabled={updating}
                      className="p-2 text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                      title="Cancel"
                    >
                      <FiX size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <p className="text-gray-900">{formatDate(patient.patient_dob)}</p>
                    {patient.id && (
                      <button
                        onClick={() => {
                          // Format DOB for editing (MM/DD/YYYY)
                          if (patient.patient_dob) {
                            try {
                              const dateStr = patient.patient_dob;
                              const parts = dateStr.includes('T') ? dateStr.split('T')[0].split('-') : dateStr.split('-');
                              if (parts.length === 3) {
                                const [year, month, day] = parts;
                                setDobValue(`${month}/${day}/${year}`);
                              } else {
                                setDobValue(patient.patient_dob);
                              }
                            } catch {
                              setDobValue(patient.patient_dob || '');
                            }
                          } else {
                            setDobValue('');
                          }
                          setEditingDOB(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-teal-600 hover:text-teal-800 transition-opacity"
                        title="Edit DOB"
                      >
                        <FiEdit2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Patient Account #</label>
                <p className="text-gray-900 font-mono">{patient.patient_account_number || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Phone Number</label>
                <p className="text-gray-900 font-mono">{patient.phone_number || '-'}</p>
              </div>
              {/* Invoice Number hidden from UI */}
              <div>
                <label className="text-sm font-medium text-gray-600">Aging Bucket</label>
                <p className="text-gray-900">{patient.aging_bucket || '-'}</p>
              </div>
            </div>
          </section>

          {/* Provider Information */}
          {patient.provider_name && (
            <section className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FiUser className="text-teal-600" />
                Provider Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Provider Name</label>
                  <p className="text-gray-900">{patient.provider_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Appointment Date & Time</label>
                  <p className="text-gray-900">{formatDateTime(patient.appointment_date_time)}</p>
                </div>
              </div>
            </section>
          )}

          {/* Insurance Information */}
          {(patient.insurance || patient.network_status || patient.eligibility_status) && (
            <section className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FiShield className="text-teal-600" />
                Insurance Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patient.insurance && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Insurance</label>
                    <p className="text-gray-900">{patient.insurance}</p>
                  </div>
                )}
                {patient.network_status && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Network Status</label>
                    <p className="text-gray-900">
                      <span className={`px-2 py-1 rounded text-xs ${
                        patient.network_status === 'In Network' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {patient.network_status}
                      </span>
                    </p>
                  </div>
                )}
                {patient.eligibility_status && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Eligibility Status</label>
                    <p className="text-gray-900">
                      <span className={`px-2 py-1 rounded text-xs ${
                        patient.eligibility_status === 'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {patient.eligibility_status}
                      </span>
                    </p>
                  </div>
                )}
                {patient.anticipated_cpt_code && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Anticipated CPT Code</label>
                    <p className="text-gray-900 font-mono">{patient.anticipated_cpt_code}</p>
                  </div>
                )}
                {patient.preventive_services_covered && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Preventive Services Covered</label>
                    <p className="text-gray-900">
                      <span className={`px-2 py-1 rounded text-xs ${
                        patient.preventive_services_covered.toLowerCase() === 'yes' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {patient.preventive_services_covered}
                      </span>
                    </p>
                  </div>
                )}
                {patient.pcp_details && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">PCP Details (HMO Plan)</label>
                    <p className="text-gray-900">{patient.pcp_details}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Coverage Details */}
          {(patient.family_deductible || patient.family_deductible_remaining || patient.copay || 
            patient.coinsurance || patient.coverage_notes || patient.coverage_effective_from || 
            patient.coverage_effective_to) && (
            <section className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FiShield className="text-teal-600" />
                Coverage Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {patient.family_deductible && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Family Deductible</label>
                    <p className="text-gray-900">{formatCurrency(patient.family_deductible)}</p>
                  </div>
                )}
                {patient.family_deductible_remaining && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Family Deductible Remaining</label>
                    <p className="text-gray-900">{formatCurrency(patient.family_deductible_remaining)}</p>
                  </div>
                )}
                {patient.individual_oop_max && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Individual OOP Max</label>
                    <p className="text-gray-900">{formatCurrency(patient.individual_oop_max)}</p>
                  </div>
                )}
                {patient.individual_oop_remaining && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Individual OOP Remaining</label>
                    <p className="text-gray-900">{formatCurrency(patient.individual_oop_remaining)}</p>
                  </div>
                )}
                {patient.copay && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Copay</label>
                    <p className="text-gray-900">{formatCurrency(patient.copay)}</p>
                  </div>
                )}
                {patient.coinsurance && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Coinsurance</label>
                    <p className="text-gray-900">{patient.coinsurance}</p>
                  </div>
                )}
                {patient.coverage_effective_from && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Coverage Effective From</label>
                    <p className="text-gray-900">{formatDate(patient.coverage_effective_from)}</p>
                  </div>
                )}
                {patient.coverage_effective_to && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Coverage Effective To</label>
                    <p className="text-gray-900">
                      {patient.coverage_effective_to ? formatDate(patient.coverage_effective_to) : 'Present'}
                    </p>
                  </div>
                )}
              </div>
              {patient.coverage_notes && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Coverage Notes</label>
                  <div className="mt-2 p-3 bg-white rounded border border-gray-200">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.coverage_notes}</p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Comments */}
          {patient.comments && patient.comments.trim() && (
            <section className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FiFileText className="text-teal-600" />
                Comments
              </h3>
              <div>
                <label className="text-sm font-medium text-gray-600">Comments</label>
                <div className="mt-2 p-3 bg-white rounded border border-gray-200">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.comments}</p>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-100 px-6 py-4 rounded-b-lg flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
