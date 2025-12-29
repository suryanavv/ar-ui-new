/**
 * Get the current date string in US/New_York timezone (YYYY-MM-DD format)
 */
export function getCurrentDateStringInNY(): string {
  const now = new Date()

  // Use Intl.DateTimeFormat to get the current date in NY timezone
  const nyDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now)

  // Convert MM/DD/YYYY to YYYY-MM-DD
  const [month, day, year] = nyDate.split('/')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/**
 * Get the current date and time in US/New_York timezone
 * Returns a Date object that behaves as if the system is in NY timezone
 */
export function getCurrentDateInNY(): Date {
  const now = new Date()

  // Get the current time in NY timezone as components
  const nyTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const parts = nyTimeFormatter.formatToParts(now)
  const nyComponents: { [key: string]: number } = {}

  parts.forEach(part => {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day' ||
        part.type === 'hour' || part.type === 'minute' || part.type === 'second') {
      nyComponents[part.type] = parseInt(part.value, 10)
    }
  })

  // Create a Date object with the NY time components
  // Note: This creates a Date in local timezone with NY time values,
  // which is what we want for date comparisons and time calculations
  return new Date(
    nyComponents.year!,
    nyComponents.month! - 1, // Date constructor months are 0-indexed
    nyComponents.day!,
    nyComponents.hour!,
    nyComponents.minute!,
    nyComponents.second!
  )
}

/**
 * Get the current date in local timezone
 * Returns a Date object representing today's date in the user's local timezone
 */
export function getCurrentDateInLocal(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * Get the current date string in local timezone (YYYY-MM-DD format)
 */
export function getCurrentDateStringInLocal(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDate(value: string | Date): Date | null {
  if (value instanceof Date) return value
  if (typeof value === "string") {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

/**
 * Format a date as MM/DD/YYYY in US format.
 * Accepts either a Date object or a parsable date string (e.g. "2025-12-04").
 * If parsing fails, falls back to the original string.
 */
export function formatDateUS(value: string | Date): string {
  const date = parseDate(value)
  if (!date) return String(value)

  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  const yyyy = date.getFullYear()

  return `${mm}/${dd}/${yyyy}`
}

/**
 * Format a date as 'MMM DD, YYYY' (e.g., 'Oct 23, 2025') in US style.
 */
export function formatDateUSShort(value: string | Date): string {
  const date = parseDate(value)
  if (!date) return String(value)

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}
