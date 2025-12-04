import { useState, useEffect, useCallback } from 'react';
import { FiX, FiPhone, FiClock } from 'react-icons/fi';
import { getCallHistory } from '../services/api';
import { formatDateTime } from '../utils/timezone';

interface CallHistoryModalProps {
  isOpen: boolean;
  patientFirstName: string;
  patientLastName: string;
  phoneNumber: string;
  invoiceNumber: string;
  patientDob?: string;
  onClose: () => void;
}

interface CallRecord {
  id: number;
  patient_first_name: string;
  patient_last_name: string;
  phone_number: string;
  invoice_number: string;
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

export const CallHistoryModal = ({ isOpen, patientFirstName, patientLastName, phoneNumber, invoiceNumber, patientDob, onClose }: CallHistoryModalProps) => {
  const patientName = getFullName(patientFirstName, patientLastName);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCallHistory = useCallback(async () => {
    if (!phoneNumber || !invoiceNumber) {
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await getCallHistory(phoneNumber, invoiceNumber, patientFirstName, patientLastName, patientDob);
      // Filter calls on frontend to ensure we only show calls for this specific phone + invoice combination
      // This prevents showing calls for other patients with same phone number or name
      const filteredCalls = (data.calls || []).filter(call => {
        const callPhone = (call.phone_number || '').trim();
        const callInvoice = (call.invoice_number || '').trim();
        const targetPhone = phoneNumber.trim();
        const targetInvoice = invoiceNumber.trim();
        
        // Must match both phone number AND invoice number exactly
        return callPhone === targetPhone && callInvoice === targetInvoice;
      });
      setCalls(filteredCalls);
    } catch (err) {
      console.error('Failed to load call history:', err);
      setError('Failed to load call history');
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [phoneNumber, invoiceNumber]);

  useEffect(() => {
    if (isOpen && phoneNumber && invoiceNumber) {
      // Reset state when modal opens
      setCalls([]);
      setError(null);
      loadCallHistory();
    } else if (!isOpen) {
      // Reset state when modal closes
      setCalls([]);
      setError(null);
    }
  }, [isOpen, phoneNumber, invoiceNumber, patientName, loadCallHistory]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[80vh] flex flex-col animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                <FiPhone className="text-teal-600" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Call History</h3>
                <p className="text-sm text-gray-600">{patientName}</p>
                <p className="text-xs text-gray-500">Invoice: {invoiceNumber} | Phone: {phoneNumber}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FiX className="text-gray-500" size={20} />
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading call history...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500">{error}</p>
            </div>
          ) : calls.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FiPhone size={48} className="mx-auto mb-3 opacity-50" />
              <p>No call history available for this patient.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {calls.map((call) => {
                const callPatientName = getFullName(call.patient_first_name || '', call.patient_last_name || '');
                return (
                  <div key={call.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FiClock className="text-gray-400" size={16} />
                          <span className="text-xs text-gray-500">{formatDateTime(call.called_at)}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            call.call_status === 'completed' 
                              ? 'bg-green-100 text-green-800' 
                              : call.call_status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {call.call_status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 ml-6">
                          <span className="font-medium">Patient:</span> {callPatientName}
                          {call.invoice_number && (
                            <> | <span className="font-medium">Invoice:</span> {call.invoice_number}</>
                          )}
                          {call.phone_number && (
                            <> | <span className="font-medium">Phone:</span> {call.phone_number}</>
                          )}
                        </div>
                      </div>
                    </div>
                    {call.notes && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-white rounded-lg p-3 border border-gray-200">
                          {call.notes}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

