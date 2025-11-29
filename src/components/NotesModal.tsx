import { FiX, FiFileText, FiClock } from 'react-icons/fi';
import { parseNotes, groupNotesByDateTime, formatTimestamp } from '../utils/notesParser';

interface NotesModalProps {
  isOpen: boolean;
  patientFirstName: string;
  patientLastName: string;
  notes: string;
  onClose: () => void;
}

// Helper function to get full name
const getFullName = (firstName: string, lastName: string): string => {
  const first = firstName || '';
  const last = lastName || '';
  return `${first} ${last}`.trim() || 'Unknown';
};

export const NotesModal = ({ isOpen, patientFirstName, patientLastName, notes, onClose }: NotesModalProps) => {
  const patientName = getFullName(patientFirstName, patientLastName);
  if (!isOpen) return null;

  const parsedNotes = parseNotes(notes);
  const groupedNotes = groupNotesByDateTime(parsedNotes);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-fadeIn">
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <FiFileText className="text-blue-600" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Call History & Notes</h3>
                <p className="text-sm text-gray-600">{patientName}</p>
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
        
        <div className="flex-1 overflow-y-auto p-6">
          {groupedNotes.length > 0 ? (
            <div className="space-y-4">
              {groupedNotes.map((group, groupIndex) => (
                <div key={groupIndex} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                  {/* Timestamp header - show for each timestamp */}
                  {group.timestamp && group.timestamp !== 'no-timestamp' && (
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300">
                      <FiClock className="text-gray-500" size={14} />
                      <span className="text-sm font-semibold text-gray-700">
                        {group.formattedTimestamp}
                      </span>
                    </div>
                  )}
                  
                  {/* All notes for this timestamp - combined into one record */}
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {group.notes.map((note, noteIndex) => (
                      <div key={noteIndex}>
                        {note.content}
                        {noteIndex < group.notes.length - 1 && '\n\n'}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : notes && notes.trim() ? (
            // Fallback: if parsing fails, show raw notes
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {notes}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <FiFileText size={48} className="mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">No notes available</p>
              <p className="text-sm mt-1">No call history or notes for this patient yet.</p>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-gray-200 flex-shrink-0 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

