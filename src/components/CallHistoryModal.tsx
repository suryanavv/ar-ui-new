import { useState, useEffect, useCallback } from 'react';
import { FiPhone, FiClock } from 'react-icons/fi';
import { getCallHistory } from '../services/api';
import { formatDateTime } from '../utils/timezone';
import { Button } from './ui/button';
import type { Patient } from '../types';

interface CallHistoryModalProps {
  isOpen: boolean;
  patient: Patient;
  onClose: () => void;
}

interface CallRecord {
  id: number;
  patient_first_name: string;
  patient_last_name: string;
  phone_number: string;
  patient_account_number?: string;
  invoice_number?: string;
  called_at: string | null;
  call_status: string;
  notes: string;
}

// Helper function to get full name
const getFullName = (firstName: string, lastName: string): string => {
  const first = firstName || '';
  const last = lastName || '';
  return `${first} ${last}`.trim() || 'Unknown';
};

export const CallHistoryModal = ({ isOpen, patient, onClose }: CallHistoryModalProps) => {
  const patientName = getFullName(patient.patient_first_name, patient.patient_last_name);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCallHistory = useCallback(async () => {
    if (!patient.phone_number) {
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await getCallHistory(
        patient.phone_number,
        patient.invoice_number || undefined,
        patient.patient_first_name,
        patient.patient_last_name,
        patient.patient_dob
      );
      setCalls(data.calls || []);
    } catch (err) {
      console.error('Failed to load call history:', err);
      setError('Failed to load call history');
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [patient]);

  useEffect(() => {
    if (isOpen && patient.phone_number) {
      // Reset state when modal opens
      setCalls([]);
      setError(null);
      loadCallHistory();
    } else if (!isOpen) {
      // Reset state when modal closes
      setCalls([]);
      setError(null);
    }
  }, [isOpen, patient.phone_number, loadCallHistory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="liquid-glass-strong rounded-2xl max-w-lg w-full flex flex-col overflow-hidden shadow-2xl max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Call History</h2>
              <p className="text-sm text-muted-foreground">{patientName}</p>
              <p className="text-xs text-muted-foreground">Phone: {patient.phone_number}</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            className="liquid-glass-btn-primary"
          >
            Close
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading call history...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-destructive">{error}</p>
            </div>
          ) : calls.length === 0 ? (
            <div className="text-center py-8">
              <FiPhone className="mx-auto text-muted-foreground mb-2" size={32} />
              <p className="text-muted-foreground">No call history found</p>
            </div>
          ) : (
            calls.map((call, index) => {
              // Calculate attempt number (most recent = highest number)
              const attemptNumber = calls.length - index;
              const attemptLabel = `Attempt ${attemptNumber}`;
              
              // Format date/time
              const formattedDateTime = formatDateTime(call.called_at);
              
              // Get status badge color
              const getStatusColor = (status: string) => {
                switch (status.toLowerCase()) {
                  case 'completed':
                    return 'bg-green-500/20 text-green-600';
                  case 'received':
                    return 'bg-blue-500/20 text-blue-600';
                  case 'failed':
                    return 'bg-red-500/20 text-red-600';
                  default:
                    return 'bg-yellow-500/20 text-yellow-600';
                }
              };

              return (
                <div
                  key={call.id}
                  className="liquid-glass rounded-xl p-4 space-y-3"
                >
                  {/* Attempt and Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">{attemptLabel}</span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(call.call_status)}`}>
                      {call.call_status}
                    </span>
                  </div>

                  {/* Date/Time */}
                  <div className="flex items-center gap-2">
                    <FiClock className="text-primary" size={16} />
                    <span className="text-sm font-medium text-foreground/70">{formattedDateTime}</span>
                  </div>

                  {/* Notes */}
                  {call.notes && (
                    <div className="mt-2">
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {call.notes}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
