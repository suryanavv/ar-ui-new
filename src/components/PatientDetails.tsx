import type { Patient } from '../types';
import { Button } from './ui/button';

interface PatientDetailsProps {
  patient: Patient;
  onClose: () => void;
  isOpen?: boolean;
}

export const PatientDetails = ({
  patient,
  onClose,
  isOpen = true
}: PatientDetailsProps) => {
  if (!isOpen) return null;

  const getPatientName = (): string => {
    const first = patient.patient_first_name || '';
    const last = patient.patient_last_name || '';
    return `${first} ${last}`.trim() || 'Unknown';
  };

  // Field component for consistent styling
  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-foreground/70 tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value || '-'}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="liquid-glass-strong rounded-2xl max-w-md w-full flex flex-col overflow-hidden shadow-2xl max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Patient Details</h2>
            <p className="text-sm text-muted-foreground">{getPatientName()}</p>
          </div>
          <Button
            onClick={onClose}
            className="liquid-glass-btn-primary"
          >
            Close
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-4">
            <Field
              label="Patient Name"
              value={getPatientName()}
            />
            <Field
              label="Patient Account Number"
              value={patient.patient_account_number || '-'}
            />
            <Field
              label="Date of Birth"
              value={patient.patient_dob_display || patient.patient_dob || '-'}
            />
            <Field
              label="Insurance Type"
              value={patient.primary_insurance_company || patient.insurance || '-'}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
