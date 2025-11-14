import type { Patient } from '../types';
import { FiEye, FiPhone } from 'react-icons/fi';

interface PatientTableProps {
  patients: Patient[];
  loading: boolean;
  onViewNotes: (patient: Patient) => void;
  onCallPatient?: (patient: Patient) => void;
  activeCalls?: Map<string, number>;
}

export const PatientTable = ({ patients, loading, onViewNotes, onCallPatient, activeCalls = new Map() }: PatientTableProps) => {
  // Check if call is currently active
  const isCallActive = (phoneNumber: string): boolean => {
    if (!activeCalls.has(phoneNumber)) return false;
    const timestamp = activeCalls.get(phoneNumber)!;
    const now = Date.now();
    // Consider call active if initiated within last 10 minutes
    return (now - timestamp) < 10 * 60 * 1000;
  };

  // Check if patient only has "Call initiated" but no conversation
  const shouldShowCallButton = (patient: Patient): boolean => {
    if (!patient.notes || !onCallPatient || !patient.phone_number) return false;
    
    // Don't show call button if call is currently active (recently initiated)
    if (isCallActive(patient.phone_number)) return false;
    
    const notes = patient.notes.toLowerCase();
    
    // Must have "call initiated" to show the button
    const hasCallInitiated = notes.includes('call initiated');
    if (!hasCallInitiated) return false;
    
    // Don't show if call failed (different from no conversation)
    if (notes.includes('call failed')) return false;
    
    // Check if there's any conversation content (payment link, response, completed, etc.)
    const hasConversation = notes.includes('payment link') || 
                            notes.includes('link sent') ||
                            notes.includes('call completed') || 
                            notes.includes('conversation') ||
                            notes.includes('patient responded') ||
                            notes.includes('patient said') ||
                            notes.includes('agreed to') ||
                            notes.includes('declined') ||
                            notes.includes('scheduled') ||
                            (notes.length > 50 && hasCallInitiated); // If notes are long, likely has conversation
    
    // Show button if call was initiated but no conversation happened (and it's not a recent call)
    return !hasConversation;
  };
  if (loading) {
    return (
      <div className="text-center py-12 text-gray-600 font-medium text-lg">
        Loading patient data...
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-teal-50 rounded-2xl border border-teal-200 backdrop-blur-sm p-16 text-center">
        <p className="text-teal-900 text-xl font-medium mb-2">No patient data available</p>
        <p className="text-teal-700">Upload a CSV, XLSX, or XLS file to get started</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b-2 border-teal-700">
            <tr>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Phone Number</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Patient Name</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Invoice #</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Price</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Outstanding</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Aging</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Link Requested</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Link Sent</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Est. Date</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {patients.map((patient, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 text-sm text-gray-900 font-medium">{patient.phone_number}</td>
                <td className="px-4 py-4 text-sm text-gray-900">{patient.patient_name}</td>
                <td className="px-4 py-4 text-sm text-gray-700 font-mono">{patient.invoice_number}</td>
                <td className="px-4 py-4 text-sm text-gray-900 font-semibold">{patient.price}</td>
                <td className="px-4 py-4 text-sm text-red-600 font-bold">{patient.outstanding_amount}</td>
                <td className="px-4 py-4 text-sm text-gray-700">{patient.aging_bucket}</td>
                <td className="px-4 py-4 text-sm">
                  {patient.link_requested ? (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium">{patient.link_requested}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  {patient.link_sent ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium">{patient.link_sent}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  {patient.estimated_date ? (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-md text-xs font-medium">{patient.estimated_date}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    {shouldShowCallButton(patient) && onCallPatient && (
                      <button
                        onClick={() => onCallPatient(patient)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-teal-600 text-teal-600 rounded-lg text-xs font-semibold hover:bg-teal-50 transition-colors"
                        title="Call patient again (call was initiated but no conversation)"
                      >
                        <FiPhone size={14} />
                        Call
                      </button>
                    )}
                    <button
                      onClick={() => onViewNotes(patient)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-teal-600 text-teal-600 rounded-lg text-xs font-semibold hover:bg-teal-50 transition-colors"
                    >
                      <FiEye size={14} />
                      View Notes
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
