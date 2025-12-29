import { useState, useEffect } from 'react';
import { FiX, FiUser, FiCalendar, FiPhone, FiShield, FiDollarSign, FiFileText, FiEdit2, FiCheck, FiClock, FiHash } from 'react-icons/fi';
import { getPatientDetails, updatePatient } from '../services/api';
import type { Patient } from '../types';
import { Button } from './ui/button';

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
      if (!isOpen) return;

      setPatient(null);
      setError(null);
      setLoading(true);

      const hasPhoneNumber = phoneNumber && phoneNumber.trim() !== '' && phoneNumber.toLowerCase() !== 'nan';
      const hasFirstName = patientFirstName && patientFirstName.trim() !== '' && patientFirstName.toLowerCase() !== 'nan';
      const hasLastName = patientLastName && patientLastName.trim() !== '' && patientLastName.toLowerCase() !== 'nan';

      if (!invoiceId && (!hasPhoneNumber || !hasFirstName || !hasLastName)) {
        const missingFields = [];
        if (!hasPhoneNumber) missingFields.push('phone number');
        if (!hasFirstName) missingFields.push('first name');
        if (!hasLastName) missingFields.push('last name');
        setError(`Missing: ${missingFields.join(', ')}`);
        setLoading(false);
        return;
      }

      try {
        const response = await getPatientDetails(invoiceId, phoneNumber, invoiceNumber, patientFirstName, patientLastName);
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

    if (isOpen) fetchPatientDetails();
  }, [invoiceId, phoneNumber, invoiceNumber, patientFirstName, patientLastName, isOpen]);

  const handleSaveDOB = async () => {
    if (!patient?.id || updating) return;
    try {
      setUpdating(true);
      await updatePatient(patient.id, { patient_dob: dobValue });
      const response = await getPatientDetails(invoiceId, phoneNumber, invoiceNumber, patientFirstName, patientLastName);
      if (response.success) setPatient(response.patient);
      setEditingDOB(false);
      setDobValue('');
    } catch {
      alert('Failed to update DOB. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  const formatCurrency = (amount: string | number | undefined): string => {
    if (!amount) return '$0.00';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(numAmount);
  };

  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';
    try {
      const dateParts = dateStr.split('T')[0].split('-');
      if (dateParts.length === 3) {
        const [year, month, day] = dateParts.map(p => parseInt(p, 10));
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      }
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Field component for consistent styling
  const Field = ({ label, value, mono = false, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) => (
    <div className="flex items-start gap-3 p-3 bg-white/30 rounded-xl border border-white/40 backdrop-blur-sm hover:bg-white/40 transition-colors">
      {icon && <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground  tracking-wide mb-0.5">{label}</p>
        <p className={`text-sm font-semibold text-foreground truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );

  // Badge component for status fields
  const Badge = ({ value, variant }: { value: string; variant: 'success' | 'warning' | 'error' | 'neutral' }) => {
    const variants = {
      success: 'bg-gradient-to-r from-emerald-500/90 to-teal-500/90 text-foreground',
      warning: 'bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-foreground',
      error: 'bg-gradient-to-r from-red-500/90 to-rose-500/90 text-foreground',
      neutral: 'bg-white/40 text-foreground border border-white/50'
    };
    return <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${variants[variant]}`}>{value}</span>;
  };

  // Section component with consistent styling
  const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="liquid-glass-table rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3 pb-2 border-b border-white/30">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
          {icon}
        </div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[9999] p-4" onClick={onClose}>
        <div className="liquid-glass rounded-2xl p-8 max-w-md w-full text-center" onClick={e => e.stopPropagation()}>
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-foreground">Loading patient details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[9999] p-4" onClick={onClose}>
        <div className="liquid-glass rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Error</h2>
            <Button onClick={onClose} className="p-2 hover:bg-white/30 rounded-lg transition-colors">
              <FiX size={20} className="text-foreground" />
            </Button>
          </div>
          <p className="text-foreground mb-4">{error}</p>
          <Button onClick={onClose} className="w-full py-2.5 bg-gradient-to-r from-primary to-primary/80 text-white font-medium rounded-xl">
            Close
          </Button>
        </div>
      </div>
    );
  }

  // No data state
  if (!patient) {
    return (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[9999] p-4" onClick={onClose}>
        <div className="liquid-glass rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">No Data</h2>
            <Button onClick={onClose} className="p-2 hover:bg-white/30 rounded-lg transition-colors">
              <FiX size={20} className="text-foreground" />
            </Button>
          </div>
          <p className="text-foreground mb-4">No patient data available.</p>
          <Button onClick={onClose} className="w-full py-2.5 bg-gradient-to-r from-primary to-primary/80 text-white font-medium rounded-xl">
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[9999] p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="liquid-glass rounded-2xl max-w-4xl w-full my-4 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/30 bg-white/10 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <FiUser className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Patient Details</h2>
              <p className="text-xs text-foreground">{patient.patient_first_name} {patient.patient_last_name}</p>
            </div>
          </div>
          <Button onClick={onClose} className="px-6 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-white font-medium rounded-xl shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all duration-200">
            Close
          </Button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Patient Information */}
          <Section title="Patient Information" icon={<FiUser className="text-white" size={18} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="First Name" value={patient.patient_first_name || '-'} icon={<FiUser className="text-primary" size={14} />} />
              <Field label="Last Name" value={patient.patient_last_name || '-'} icon={<FiUser className="text-primary" size={14} />} />

              {/* Date of Birth - Editable */}
              <div className="flex items-start gap-3 p-3 bg-white/30 rounded-xl border border-white/40 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FiCalendar className="text-primary" size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground  tracking-wide mb-0.5">Date of Birth</p>
                  {editingDOB ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="text"
                        value={dobValue}
                        onChange={e => setDobValue(e.target.value)}
                        placeholder="MM/DD/YYYY"
                        className="flex-1 px-2 py-1 text-sm bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                        disabled={updating}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveDOB(); else if (e.key === 'Escape') { setEditingDOB(false); setDobValue(''); } }}
                      />
                      <Button onClick={handleSaveDOB} disabled={updating} className="p-1.5 bg-emerald-500 text-white rounded-lg disabled:opacity-50">
                        <FiCheck size={14} />
                      </Button>
                      <Button onClick={() => { setEditingDOB(false); setDobValue(''); }} disabled={updating} className="p-1.5 bg-red-500 text-white rounded-lg disabled:opacity-50">
                        <FiX size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <p className="text-sm font-semibold text-foreground">{formatDate(patient.patient_dob)}</p>
                      {patient.id && (
                        <Button
                          onClick={() => {
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
                            }
                            setEditingDOB(true);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-foreground hover:bg-white/30 rounded transition-all"
                        >
                          <FiEdit2 size={12} />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <Field label="Patient Account #" value={patient.patient_account_number || '-'} mono icon={<FiHash className="text-primary" size={14} />} />
              <Field label="Phone Number" value={patient.phone_number || '-'} mono icon={<FiPhone className="text-primary" size={14} />} />
              <Field label="Aging Bucket" value={patient.aging_bucket || '-'} icon={<FiClock className="text-primary" size={14} />} />
            </div>
          </Section>

          {/* Provider Information */}
          {patient.provider_name && (
            <Section title="Provider Information" icon={<FiUser className="text-white" size={18} />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Provider Name" value={patient.provider_name} icon={<FiUser className="text-primary" size={14} />} />
                <Field label="Appointment Date & Time" value={formatDateTime(patient.appointment_date_time)} icon={<FiCalendar className="text-primary" size={14} />} />
              </div>
            </Section>
          )}

          {/* Insurance Information */}
          {(patient.insurance || patient.network_status || patient.eligibility_status) && (
            <Section title="Insurance Information" icon={<FiShield className="text-white" size={18} />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {patient.insurance && <Field label="Insurance" value={patient.insurance} icon={<FiShield className="text-primary" size={14} />} />}

                {patient.network_status && (
                  <div className="flex items-start gap-3 p-3 bg-white/30 rounded-xl border border-white/40 backdrop-blur-sm">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FiShield className="text-primary" size={14} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground  tracking-wide mb-1">Network Status</p>
                      <Badge value={patient.network_status} variant={patient.network_status === 'In Network' ? 'success' : 'warning'} />
                    </div>
                  </div>
                )}

                {patient.eligibility_status && (
                  <div className="flex items-start gap-3 p-3 bg-white/30 rounded-xl border border-white/40 backdrop-blur-sm">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FiCheck className="text-primary" size={14} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground  tracking-wide mb-1">Eligibility Status</p>
                      <Badge value={patient.eligibility_status} variant={patient.eligibility_status === 'Active' ? 'success' : 'error'} />
                    </div>
                  </div>
                )}

                {patient.anticipated_cpt_code && <Field label="Anticipated CPT Code" value={patient.anticipated_cpt_code} mono icon={<FiFileText className="text-primary" size={14} />} />}

                {patient.preventive_services_covered && (
                  <div className="flex items-start gap-3 p-3 bg-white/30 rounded-xl border border-white/40 backdrop-blur-sm">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FiShield className="text-primary" size={14} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground  tracking-wide mb-1">Preventive Services</p>
                      <Badge value={patient.preventive_services_covered} variant={patient.preventive_services_covered.toLowerCase() === 'yes' ? 'success' : 'neutral'} />
                    </div>
                  </div>
                )}

                {patient.pcp_details && <Field label="PCP Details (HMO Plan)" value={patient.pcp_details} icon={<FiUser className="text-primary" size={14} />} />}
              </div>
            </Section>
          )}

          {/* Coverage Details */}
          {(patient.family_deductible || patient.copay || patient.coinsurance || patient.coverage_notes) && (
            <Section title="Coverage Details" icon={<FiDollarSign className="text-white" size={18} />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {patient.family_deductible && <Field label="Family Deductible" value={formatCurrency(patient.family_deductible)} icon={<FiDollarSign className="text-primary" size={14} />} />}
                {patient.family_deductible_remaining && <Field label="Deductible Remaining" value={formatCurrency(patient.family_deductible_remaining)} icon={<FiDollarSign className="text-primary" size={14} />} />}
                {patient.individual_oop_max && <Field label="Individual OOP Max" value={formatCurrency(patient.individual_oop_max)} icon={<FiDollarSign className="text-primary" size={14} />} />}
                {patient.individual_oop_remaining && <Field label="OOP Remaining" value={formatCurrency(patient.individual_oop_remaining)} icon={<FiDollarSign className="text-primary" size={14} />} />}
                {patient.copay && <Field label="Copay" value={formatCurrency(patient.copay)} icon={<FiDollarSign className="text-primary" size={14} />} />}
                {patient.coinsurance && <Field label="Coinsurance" value={patient.coinsurance} icon={<FiDollarSign className="text-primary" size={14} />} />}
                {patient.coverage_effective_from && <Field label="Coverage Effective From" value={formatDate(patient.coverage_effective_from)} icon={<FiCalendar className="text-primary" size={14} />} />}
                {patient.coverage_effective_to && <Field label="Coverage Effective To" value={patient.coverage_effective_to ? formatDate(patient.coverage_effective_to) : 'Present'} icon={<FiCalendar className="text-primary" size={14} />} />}
              </div>

              {patient.coverage_notes && (
                <div className="mt-3 p-4 bg-white/30 rounded-xl border border-white/40">
                  <p className="text-xs font-medium text-foreground  tracking-wide mb-2">Coverage Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{patient.coverage_notes}</p>
                </div>
              )}
            </Section>
          )}

          {/* Comments */}
          {patient.comments && patient.comments.trim() && (
            <Section title="Comments" icon={<FiFileText className="text-white" size={18} />}>
              <div className="p-4 bg-white/30 rounded-xl border border-white/40">
                <p className="text-sm text-foreground whitespace-pre-wrap">{patient.comments}</p>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
};
