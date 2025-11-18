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
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Patient Name</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Phone Number</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Invoice #</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Invoice amount</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Outstanding balance</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Aging</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Link Requested</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Link Sent</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Est. Date</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Call Status</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Calls</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Payment Status</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {patients.map((patient, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 text-sm text-gray-900">{patient.patient_name}</td>
                <td className="px-4 py-4 text-sm text-gray-900 font-medium">{patient.phone_number}</td>
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
                  {patient.call_status ? (
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      patient.call_status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : patient.call_status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {patient.call_status.charAt(0).toUpperCase() + patient.call_status.slice(1)}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-semibold">
                    {patient.call_count || 0}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm">
                  {patient.payment_status ? (
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      patient.payment_status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : patient.payment_status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : patient.payment_status === 'refunded'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {patient.payment_status.charAt(0).toUpperCase() + patient.payment_status.slice(1)}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    {onCallPatient && patient.phone_number && !isCallActive(patient.phone_number) && (
                      <button
                        onClick={() => onCallPatient(patient)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-teal-600 text-teal-600 rounded-lg text-xs font-semibold hover:bg-teal-50 transition-colors"
                        title="Call patient"
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
