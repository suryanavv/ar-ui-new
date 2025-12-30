"use client"

import * as React from "react"
import { formatDateUS } from "@/lib/date"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  maxDate?: Date
  minDate?: Date
}

export function DatePicker({
  value,
  onChange,
  placeholder = "MM/DD/YYYY",
  disabled = false,
  required = false,
  className,
  maxDate,
  minDate
}: DatePickerProps) {
  const [isFocused, setIsFocused] = React.useState(false)
  const [displayText, setDisplayText] = React.useState('')
  const dateInputRef = React.useRef<HTMLInputElement>(null)
  const displayInputRef = React.useRef<HTMLInputElement>(null)

  // Sync displayText with value prop when value changes externally
  React.useEffect(() => {
    if (value) {
      setDisplayText(formatDateUS(value))
    } else {
      setDisplayText('')
    }
  }, [value])

  const handleDisplayClick = () => {
    if (!disabled && dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === 'function') {
        dateInputRef.current.showPicker()
      } else {
        dateInputRef.current.click()
      }
    }
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value)
  }

  // Handle manual text input - parse MM/DD/YYYY format with auto-slash
  const handleDisplayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value

    // Get only digits from input
    const digitsOnly = inputValue.replace(/\D/g, '')

    // Auto-format with slashes as user types
    let formatted = ''
    for (let i = 0; i < digitsOnly.length && i < 8; i++) {
      if (i === 2 || i === 4) {
        formatted += '/'
      }
      formatted += digitsOnly[i]
    }

    setDisplayText(formatted)

    // Validate complete date in MM/DD/YYYY format
    if (digitsOnly.length === 8) {
      const month = parseInt(digitsOnly.slice(0, 2), 10)
      const day = parseInt(digitsOnly.slice(2, 4), 10)
      const year = parseInt(digitsOnly.slice(4, 8), 10)

      // Basic validation: month 1-12, day 1-31, year reasonable range
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
        // Convert to YYYY-MM-DD format for the hidden date input
        const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        // Validate the date is real (handles Feb 30, etc.)
        const dateObj = new Date(isoDate)
        if (!isNaN(dateObj.getTime()) &&
          dateObj.getMonth() + 1 === month &&
          dateObj.getDate() === day) {
          // Check against min/max date constraints
          if (maxDate && dateObj > maxDate) return
          if (minDate && dateObj < minDate) return
          onChange?.(isoDate)
        }
      }
    }
  }

  return (
    <div className="relative">
      {/* Display input - shows formatted US date and allows manual typing */}
      <input
        ref={displayInputRef}
        type="text"
        value={displayText}
        onChange={handleDisplayChange}
        onClick={handleDisplayClick}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full px-3 py-2 text-sm liquid-glass-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground",
          isFocused && "ring-2 ring-ring",
          className
        )}
      />

      {/* Hidden date input - handles actual date selection */}
      <input
        ref={dateInputRef}
        type="date"
        value={value || ''}
        onChange={handleDateChange}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
        disabled={disabled}
        required={required}
        max={maxDate ? maxDate.toISOString().split('T')[0] : undefined}
        min={minDate ? minDate.toISOString().split('T')[0] : undefined}
      />
    </div>
  )
}
