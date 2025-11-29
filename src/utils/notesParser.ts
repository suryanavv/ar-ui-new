/**
 * Utility functions for parsing and formatting call notes
 * Converts UTC timestamps from notes to local timezone for display
 */
import { formatDateTime } from './timezone';

export interface ParsedNote {
  timestamp: string;
  content: string;
  isPaymentLink?: boolean;
  isVerificationFailed?: boolean;
  isVerificationSuccess?: boolean;
  hasEstimatedDate?: boolean;
  estimatedDate?: string;
}

/**
 * Parse notes string into individual entries with timestamps
 * Format: [timestamp] note | [timestamp] note | ...
 * Handles various timestamp formats and embedded timestamps
 */
export const parseNotes = (notes: string): ParsedNote[] => {
  if (!notes || !notes.trim()) {
    return [];
  }

  // Split by " | " to get individual entries
  const entries = notes.split(' | ').filter(entry => entry.trim());
  
  const parsed: ParsedNote[] = [];
  
  entries.forEach(entry => {
    const trimmed = entry.trim();
    if (!trimmed) return;
    
    // Pattern 1: Timestamp at the very start: [MM/DD/YYYY HH:MM AM/PM] content
    const timestampMatch = trimmed.match(/^\[(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s+[AaPp][Mm])\]\s*(.*)$/);
    
    if (timestampMatch) {
      const timestamp = timestampMatch[1].trim();
      const content = timestampMatch[2].trim();
      
      // Check if content starts with another timestamp (nested)
      const nestedTimestampMatch = content.match(/^\[(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s+[AaPp][Mm])\]\s*(.*)$/);
      if (nestedTimestampMatch) {
        // This entry has a nested timestamp - split into two entries
        // First entry with outer timestamp
        parsed.push({
          timestamp,
          content: '', // Empty content for the outer timestamp
          isPaymentLink: false,
          isVerificationFailed: false,
          isVerificationSuccess: false,
          hasEstimatedDate: false
        });
        // Second entry with nested timestamp
        const nestedTimestamp = nestedTimestampMatch[1].trim();
        const nestedContent = nestedTimestampMatch[2].trim();
        parsed.push(createNoteFromContent(nestedTimestamp, nestedContent));
        return;
      }
      
      parsed.push(createNoteFromContent(timestamp, content));
      return;
    }
    
    // Pattern 2: Timestamp embedded in content (not at start)
    // Look for timestamp pattern anywhere in the first 150 characters
    const contentPreview = trimmed.substring(0, 150);
    const embeddedMatch = contentPreview.match(/\[(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s+[AaPp][Mm])\]/);
    
    if (embeddedMatch) {
      const timestamp = embeddedMatch[1].trim();
      parsed.push(createNoteFromContent(timestamp, trimmed));
      return;
    }
    
    // Pattern 3: No timestamp found - treat as continuation of previous entry
    parsed.push({
      timestamp: '',
      content: trimmed,
      isPaymentLink: false,
      isVerificationFailed: false,
      isVerificationSuccess: false,
      hasEstimatedDate: false
    });
  });
  
  return parsed;
};

/**
 * Helper function to create a ParsedNote from timestamp and content
 */
function createNoteFromContent(timestamp: string, content: string): ParsedNote {
  // Detect note types for styling
  const isPaymentLink = /payment link.*sent/i.test(content);
  const isVerificationFailed = /verification failed|does not match|did not match/i.test(content);
  const isVerificationSuccess = /verified identity|patient verified/i.test(content) && !isVerificationFailed;
  
  // Extract estimated date if present
  const estimatedDateMatch = content.match(/estimated payment date[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const hasEstimatedDate = !!estimatedDateMatch;
  const estimatedDate = estimatedDateMatch ? estimatedDateMatch[1] : undefined;
  
  return {
    timestamp: timestamp.trim(),
    content: content.trim(),
    isPaymentLink,
    isVerificationFailed,
    isVerificationSuccess,
    hasEstimatedDate,
    estimatedDate
  };
}

/**
 * Format timestamp for display using timezone utility
 * Parses UTC timestamp string and converts it to local timezone
 * Input format: "11/28/2025 11:53 AM" (UTC)
 * Output format: "Nov 28, 2025, 11:53 AM" (local timezone)
 */
export const formatTimestamp = (timestamp: string): string => {
  if (!timestamp) return '';
  
  try {
    // Parse format: "11/28/2025 11:53 AM" (this is UTC)
    const [datePart, timePart, ampm] = timestamp.split(' ');
    if (!datePart || !timePart || !ampm) {
      return timestamp; // Return original if format is unexpected
    }
    
    const [month, day, year] = datePart.split('/');
    const [hours, minutes] = timePart.split(':');
    
    if (!month || !day || !year || !hours || !minutes) {
      return timestamp; // Return original if parsing fails
    }
    
    // Convert to 24-hour format
    let hour24 = parseInt(hours, 10);
    if (ampm === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (ampm === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    
    // Create UTC Date object (treat the parsed time as UTC)
    // Format: YYYY-MM-DDTHH:mm:ssZ
    const utcDateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(hour24).padStart(2, '0')}:${minutes.padStart(2, '0')}:00Z`;
    
    // Use timezone utility to convert UTC to local timezone and format
    return formatDateTime(utcDateString, {
      includeDate: true,
      includeTime: true,
      hour12: true
    });
  } catch {
    return timestamp; // Return original if parsing fails
  }
};

/**
 * Get note type badge color
 */
export const getNoteTypeColor = (note: ParsedNote): string => {
  if (note.isVerificationFailed) {
    return 'bg-red-50 border-red-200 text-red-800';
  }
  if (note.isVerificationSuccess) {
    return 'bg-green-50 border-green-200 text-green-800';
  }
  if (note.isPaymentLink) {
    return 'bg-blue-50 border-blue-200 text-blue-800';
  }
  if (note.hasEstimatedDate) {
    return 'bg-purple-50 border-purple-200 text-purple-800';
  }
  return 'bg-gray-50 border-gray-200 text-gray-800';
};

/**
 * Group notes by date/time - notes with the same date/time are grouped together
 */
export interface GroupedNote {
  timestamp: string;
  formattedTimestamp: string;
  notes: ParsedNote[];
}

export const groupNotesByDateTime = (parsedNotes: ParsedNote[]): GroupedNote[] => {
  if (parsedNotes.length === 0) {
    return [];
  }
  
  const grouped: GroupedNote[] = [];
  let currentGroup: GroupedNote | null = null;
  
  parsedNotes.forEach(note => {
    // Check if note has a timestamp
    const hasTimestamp = note.timestamp && note.timestamp.trim() !== '';
    
    if (hasTimestamp) {
      // Normalize timestamp for comparison (remove any extra whitespace)
      const normalizedTimestamp = note.timestamp.trim();
      
      // Check if this timestamp matches the current group's timestamp (exact match)
      if (currentGroup && currentGroup.timestamp && currentGroup.timestamp.trim() === normalizedTimestamp) {
        // Same timestamp - add to current group
        currentGroup.notes.push(note);
      } else {
        // Different timestamp or no current group - start new group
        // Save previous group if it exists
        if (currentGroup) {
          grouped.push(currentGroup);
        }
        // Start new group with this timestamp
        currentGroup = {
          timestamp: normalizedTimestamp,
          formattedTimestamp: formatTimestamp(normalizedTimestamp),
          notes: [note]
        };
      }
    } else {
      // Note without timestamp - only add to current group if it exists and has a valid timestamp
      // Don't attach to groups that are "no-timestamp"
      if (currentGroup && currentGroup.timestamp && currentGroup.timestamp.trim() !== '') {
        // Add to existing timestamped group (this is a continuation of the previous call)
        currentGroup.notes.push(note);
      } else {
        // No current group or current group is "no-timestamp" - create new "no-timestamp" group
        if (currentGroup) {
          grouped.push(currentGroup);
        }
        currentGroup = {
          timestamp: '',
          formattedTimestamp: '',
          notes: [note]
        };
      }
    }
  });
  
  // Don't forget the last group
  if (currentGroup) {
    grouped.push(currentGroup);
  }
  
  return grouped;
};

