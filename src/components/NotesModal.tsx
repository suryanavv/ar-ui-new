import { FiFileText, FiClock, FiUser } from 'react-icons/fi';
import { parseNotes, groupNotesByDateTime } from '../utils/notesParser';
import { Button } from './ui/button';
import { useState, useRef, useEffect } from 'react';

interface NotesModalProps {
  isOpen: boolean;
  patientFirstName: string;
  patientLastName: string;
  notes: string;
  onClose: () => void;
}

interface ConversationTurn {
  speaker: 'A' | 'B';
  label: string;
  text: string;
  timestamp?: string;
}

// Helper function to get full name
const getFullName = (firstName: string, lastName: string): string => {
  const first = firstName || '';
  const last = lastName || '';
  return `${first} ${last}`.trim() || 'Unknown';
};

// Parse notes into conversation turns
const parseConversationTurns = (notes: string): ConversationTurn[] => {
  if (!notes || !notes.trim()) return [];

  const turns: ConversationTurn[] = [];
  const lines = notes.split('\n').filter(line => line.trim());

  lines.forEach(line => {
    const trimmed = line.trim();
    
    // Pattern 1: "Assistant:" or "User:" at start
    const assistantMatch = trimmed.match(/^Assistant[:\s]+(.*)$/i);
    const userMatch = trimmed.match(/^User[:\s]+(.*)$/i);
    
    if (assistantMatch) {
      turns.push({
        speaker: 'A',
        label: 'Assistant',
        text: assistantMatch[1].trim()
      });
      return;
    }
    
    if (userMatch) {
      turns.push({
        speaker: 'B',
        label: 'User',
        text: userMatch[1].trim()
      });
      return;
    }

    // Pattern 2: "A:" or "B:" at start
    const aMatch = trimmed.match(/^A[:\s]+(.*)$/i);
    const bMatch = trimmed.match(/^B[:\s]+(.*)$/i);
    
    if (aMatch) {
      turns.push({
        speaker: 'A',
        label: 'Assistant',
        text: aMatch[1].trim()
      });
      return;
    }
    
    if (bMatch) {
      turns.push({
        speaker: 'B',
        label: 'User',
        text: bMatch[1].trim()
      });
      return;
    }

    // Pattern 3: Check if line contains speaker indicators
    if (/assistant|agent|system/i.test(trimmed) && /[:]/.test(trimmed)) {
      const parts = trimmed.split(/[:]/);
      if (parts.length >= 2) {
        turns.push({
          speaker: 'A',
          label: 'Assistant',
          text: parts.slice(1).join(':').trim()
        });
        return;
      }
    }

    if (/patient|user|customer/i.test(trimmed) && /[:]/.test(trimmed)) {
      const parts = trimmed.split(/[:]/);
      if (parts.length >= 2) {
        turns.push({
          speaker: 'B',
          label: 'User',
          text: parts.slice(1).join(':').trim()
        });
        return;
      }
    }

    // If no pattern matches and we have previous turns, append to last turn
    if (turns.length > 0 && trimmed) {
      const lastTurn = turns[turns.length - 1];
      lastTurn.text += ' ' + trimmed;
    } else if (trimmed) {
      // First line with no pattern - assume it's from Assistant
      turns.push({
        speaker: 'A',
        label: 'Assistant',
        text: trimmed
      });
    }
  });

  return turns;
};

export const NotesModal = ({ isOpen, patientFirstName, patientLastName, notes, onClose }: NotesModalProps) => {
  const patientName = getFullName(patientFirstName, patientLastName);
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [hasConversationFormat, setHasConversationFormat] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && notes) {
      const turns = parseConversationTurns(notes);
      if (turns.length > 0) {
        setConversationTurns(turns);
        setHasConversationFormat(true);
      } else {
        setHasConversationFormat(false);
      }
      
      // Scroll to bottom when modal opens
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [isOpen, notes]);

  if (!isOpen) return null;

  const parsedNotes = parseNotes(notes);
  const groupedNotes = groupNotesByDateTime(parsedNotes);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4 md:p-6" onClick={onClose}>
      <div
        className="liquid-glass-strong rounded-2xl max-w-3xl w-full flex flex-col overflow-hidden shadow-2xl max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 md:px-6 py-3 sm:py-4 border-b border-white/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Call History & Notes</h2>
              <p className="text-sm text-muted-foreground">{patientName}</p>
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
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4"
        >
          {hasConversationFormat && conversationTurns.length > 0 ? (
            // Display as conversation turns with differentiation
            conversationTurns.map((turn, index) => (
              <div
                key={index}
                className={`flex ${turn.speaker === "A" ? "justify-start" : "justify-end"} group`}
              >
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mr-3 mt-1 shadow-lg ${turn.speaker === "A"
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 ring-2 ring-emerald-500/20"
                  : "order-2 ml-3 mr-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 ring-2 ring-white/50 dark:ring-white/10"
                  }`}>
                  {turn.speaker === "A" ? (
                    <div className="w-4 h-4 text-white">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                        <line x1="8" x2="16" y1="22" y2="22" />
                      </svg>
                    </div>
                  ) : (
                    <FiUser className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                  )}
                </div>

                <div className={`flex-1 max-w-[85%] liquid-glass rounded-xl p-4 shadow-sm ${turn.speaker === "A"
                  ? "bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 text-foreground rounded-tl-none"
                  : "bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-100/50 dark:border-emerald-500/20 text-foreground rounded-tr-none"
                  }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold uppercase tracking-wider ${turn.speaker === "A" ? "text-foreground" : "text-foreground"
                      }`}>
                      {turn.label}
                    </span>
                  </div>
                  <p className="text-sm sm:text-base leading-relaxed whitespace-pre-line">
                    {turn.text}
                  </p>
                </div>
              </div>
            ))
          ) : groupedNotes.length > 0 ? (
            // Display as grouped notes with timestamps
            groupedNotes.map((group, groupIndex) => (
              group.notes.map((note, noteIndex) => (
                <div key={`${groupIndex}-${noteIndex}`} className="liquid-glass rounded-xl p-4 space-y-3">
                  {/* Timestamp */}
                  {group.timestamp && group.timestamp !== 'no-timestamp' && (
                    <div className="flex items-center gap-2">
                      <FiClock className="text-primary" size={16} />
                      <span className="text-sm font-medium text-foreground/70">{group.formattedTimestamp}</span>
                    </div>
                  )}
                  
                  {/* Notes content */}
                  <div className="mt-2">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                </div>
              ))
            ))
          ) : notes && notes.trim() ? (
            // Fallback: show raw notes
            <div className="liquid-glass rounded-xl p-4 space-y-3">
              <div className="mt-2">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {notes}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8 md:py-10">
              <FiFileText className="mx-auto text-muted-foreground mb-2" size={32} />
              <p className="text-muted-foreground">No notes found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
