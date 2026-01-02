/**
 * Timezone utility module for converting UTC timestamps to local timezone
 * All functions automatically use the system's local timezone
 */

/**
 * Converts a UTC timestamp string to a Date object in local timezone
 * Handles timestamps with or without 'Z' suffix
 * 
 * @param utcTimestamp - UTC timestamp string (e.g., "2025-11-19T16:33:04.162611" or "2025-11-19T16:33:04.162611Z")
 * @returns Date object in local timezone, or null if invalid
 */
export const utcToLocalDate = (utcTimestamp: string | null): Date | null => {
  if (!utcTimestamp) return null;
  
  try {
    // Ensure the timestamp is treated as UTC
    // Backend returns timestamps like "2025-11-19T16:33:04.162611" without timezone indicator
    // If it doesn't have 'Z' or timezone offset (+/-HH:MM), add 'Z' to ensure UTC parsing
    let utcString = utcTimestamp;
    if (!utcTimestamp.includes('Z') && !utcTimestamp.match(/[+-]\d{2}:\d{2}$/)) {
      utcString = `${utcTimestamp}Z`;
    }
    
    // Create date from UTC string - JavaScript will automatically convert to local timezone
    const date = new Date(utcString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  } catch {
    return null;
  }
};

/**
 * Gets the local date key (YYYY-MM-DD) from a UTC timestamp
 * This is used for grouping calls by date in the local timezone
 * 
 * @param utcTimestamp - UTC timestamp string
 * @returns Date key string in format YYYY-MM-DD in local timezone, or null if invalid
 */
export const getLocalDateKey = (utcTimestamp: string | null): string | null => {
  const localDate = utcToLocalDate(utcTimestamp);
  if (!localDate) return null;
  
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Formats a UTC timestamp to a readable date-time string in local timezone
 * 
 * @param utcTimestamp - UTC timestamp string
 * @param options - Optional formatting options
 * @returns Formatted date-time string, or 'N/A' if invalid
 */
export const formatDateTime = (
  utcTimestamp: string | null,
  options?: {
    includeTime?: boolean;
    includeDate?: boolean;
    hour12?: boolean;
  }
): string => {
  const localDate = utcToLocalDate(utcTimestamp);
  if (!localDate) return 'N/A';
  
  const defaultOptions = {
    includeTime: true,
    includeDate: true,
    hour12: true,
    ...options,
  };
  
  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  
  if (defaultOptions.includeDate) {
    formatOptions.month = 'short';
    formatOptions.day = 'numeric';
    formatOptions.year = 'numeric';
  }
  
  if (defaultOptions.includeTime) {
    formatOptions.hour = 'numeric';
    formatOptions.minute = '2-digit';
    formatOptions.hour12 = defaultOptions.hour12;
  }
  
  try {
    return new Intl.DateTimeFormat('en-US', formatOptions).format(localDate);
  } catch {
    return utcTimestamp || 'N/A';
  }
};

/**
 * Formats a UTC timestamp to time only (HH:MM AM/PM) in local timezone
 * 
 * @param utcTimestamp - UTC timestamp string
 * @returns Formatted time string, or empty string if invalid
 */
export const formatTime = (utcTimestamp: string | null): string => {
  const localDate = utcToLocalDate(utcTimestamp);
  if (!localDate) return '';
  
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).format(localDate);
  } catch {
    return '';
  }
};

/**
 * Groups calls by local date instead of UTC date
 * Converts the backend's UTC-based date grouping to local timezone-based grouping
 * 
 * @param callsByDate - Object with UTC date keys and arrays of calls
 * @returns Object with local date keys and arrays of calls
 */
export const groupCallsByLocalDate = <T extends { called_at: string }>(
  callsByDate: Record<string, T[]>
): Record<string, T[]> => {
  const grouped: Record<string, T[]> = {};
  
  // Iterate through all UTC date groups
  Object.entries(callsByDate).forEach(([, calls]) => {
    // For each call, determine its local date
    calls.forEach((call) => {
      const localDateKey = getLocalDateKey(call.called_at);
      
      if (localDateKey) {
        // Initialize array if it doesn't exist
        if (!grouped[localDateKey]) {
          grouped[localDateKey] = [];
        }
        
        // Add call to the local date group
        grouped[localDateKey].push(call);
      }
    });
  });
  
  // Sort calls within each date group by called_at (most recent first)
  Object.keys(grouped).forEach((dateKey) => {
    grouped[dateKey].sort((a, b) => {
      const dateA = utcToLocalDate(a.called_at);
      const dateB = utcToLocalDate(b.called_at);
      
      if (!dateA || !dateB) return 0;
      
      // Sort descending (most recent first)
      return dateB.getTime() - dateA.getTime();
    });
  });
  
  return grouped;
};

/**
 * Gets the current local timezone name (e.g., "Asia/Kolkata", "America/New_York")
 * 
 * @returns Timezone name string
 */
export const getLocalTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Formats a date object to YYYY-MM-DD string in local timezone
 * Used for date picker and calendar operations
 * 
 * @param date - Date object
 * @returns Date key string in format YYYY-MM-DD
 */
export const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

