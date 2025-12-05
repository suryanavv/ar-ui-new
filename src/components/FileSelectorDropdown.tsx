import { useState, useEffect, useRef } from 'react';
import { FiChevronDown, FiCheck, FiSearch, FiX, FiCalendar } from 'react-icons/fi';
import { BsFiletypePdf, BsFiletypeCsv, BsFileEarmarkExcel } from 'react-icons/bs';
import { utcToLocalDate, getLocalDateKey, formatDateKey } from '../utils/timezone';

interface FileOption {
  id: number;
  filename: string;
  displayName: string;
  uploaded_at: string | null;
  patient_count: number;
}

interface FileSelectorDropdownProps {
  options: FileOption[];
  selectedUploadId: number | null;
  onSelect: (uploadId: number | null) => void;
  disabled?: boolean;
}

export const FileSelectorDropdown = ({ 
  options, 
  selectedUploadId, 
  onSelect,
  disabled = false 
}: FileSelectorDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'filename' | 'date' | 'daterange'>('filename');
  const [singleDate, setSingleDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const getFileIcon = (filename: string) => {
    const name = filename.toLowerCase();
    if (name.endsWith('.pdf')) {
      return <BsFiletypePdf className="flex-shrink-0 text-red-600" size={16} />;
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      return <BsFileEarmarkExcel className="flex-shrink-0 text-green-600" size={16} />;
    } else if (name.endsWith('.csv')) {
      return <BsFiletypeCsv className="flex-shrink-0 text-blue-600" size={16} />;
    }
    return null;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current?.contains(target) ||
        buttonRef.current?.contains(target) ||
        buttonRef.current === target
      ) {
        return;
      }
      setIsOpen(false);
    };

    if (isOpen) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside, true);
      }, 0);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside, true);
      };
    }
  }, [isOpen]);

  // Filter options based on search criteria (timezone-aware)
  const filteredOptions = options.filter(option => {
    // Filename search
    if (searchType === 'filename' && searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      return option.displayName.toLowerCase().includes(search) || 
             option.filename.toLowerCase().includes(search);
    }
    
    // Single date search (timezone-aware)
    if (searchType === 'date' && singleDate && option.uploaded_at) {
      // Get the local date key from the UTC uploaded_at timestamp
      const uploadedLocalDateKey = getLocalDateKey(option.uploaded_at);
      if (!uploadedLocalDateKey) return false;
      
      // The selected date from the date picker is already in local timezone
      return uploadedLocalDateKey === singleDate;
    }
    
    // Date range search (timezone-aware)
    if (searchType === 'daterange' && startDate && endDate && option.uploaded_at) {
      // Convert the UTC uploaded_at to local Date object
      const uploadedLocalDate = utcToLocalDate(option.uploaded_at);
      if (!uploadedLocalDate) return false;
      
      // Get the local date key (YYYY-MM-DD) for comparison
      const uploadedDateKey = formatDateKey(uploadedLocalDate);
      
      // Compare date strings (YYYY-MM-DD format ensures proper comparison)
      return uploadedDateKey >= startDate && uploadedDateKey <= endDate;
    }
    
    return true;
  });

  const selectedOption = selectedUploadId 
    ? options.find(opt => opt.id === selectedUploadId)
    : null;

  const displayText = selectedOption 
    ? selectedOption.displayName 
    : 'All Patients (All Files)';

  const clearFilters = () => {
    setSearchTerm('');
    setSingleDate('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) {
            setIsOpen((prev) => !prev);
          }
        }}
        disabled={disabled}
        className={`
          w-full px-4 py-3 bg-white border border-gray-300 rounded-lg 
          text-sm text-gray-900 font-medium 
          flex items-center justify-between
          transition-all duration-200
          ${disabled 
            ? 'opacity-50 cursor-not-allowed bg-gray-50' 
            : 'hover:border-teal-500 hover:shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500'
          }
        `}
      >
        <span className="truncate flex-1 text-left">{displayText}</span>
        <FiChevronDown 
          className={`ml-2 h-5 w-5 text-gray-500 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div 
          className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sidebar Layout */}
          <div className="flex max-h-[420px]">
            {/* Left Sidebar - Search Controls */}
            <div className="w-44 bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">
              {/* Search Type Buttons */}
              <div className="p-2 space-y-1">
                <button
                  onClick={() => {
                    setSearchType('filename');
                    clearFilters();
                  }}
                  className={`w-full px-3 py-2 text-xs font-medium rounded transition-all text-left flex items-center justify-between ${
                    searchType === 'filename'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FiSearch className="w-3.5 h-3.5" />
                    File Name
                  </div>
                  {searchType === 'filename' && searchTerm && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  )}
                </button>
                <button
                  onClick={() => {
                    setSearchType('date');
                    clearFilters();
                  }}
                  className={`w-full px-3 py-2 text-xs font-medium rounded transition-all text-left flex items-center justify-between ${
                    searchType === 'date'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FiCalendar className="w-3.5 h-3.5" />
                    Single Date
                  </div>
                  {searchType === 'date' && singleDate && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  )}
                </button>
                <button
                  onClick={() => {
                    setSearchType('daterange');
                    clearFilters();
                  }}
                  className={`w-full px-3 py-2 text-xs font-medium rounded transition-all text-left flex items-center justify-between ${
                    searchType === 'daterange'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FiCalendar className="w-3.5 h-3.5" />
                    Date Range
                  </div>
                  {searchType === 'daterange' && startDate && endDate && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  )}
                </button>
              </div>
            </div>

            {/* Right Section - Search Input & File List */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Search Input Area */}
              <div className="p-3 border-b border-gray-200 bg-white">
                {/* Filename Search */}
                {searchType === 'filename' && (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type to search files..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    />
                    {searchTerm && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchTerm('');
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <FiX className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Single Date Search */}
                {searchType === 'date' && (
                  <input
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  />
                )}

                {/* Date Range Search */}
                {searchType === 'daterange' && (
                  <div className="space-y-1.5">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="From"
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="To"
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                )}

                {/* Results Count */}
                <div className="mt-2 text-xs text-gray-500">
                  {filteredOptions.length} file{filteredOptions.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* File Options List */}
              <div className="overflow-y-auto flex-1">
                {/* All Patients Option */}
                <button
                  onClick={() => {
                    onSelect(null);
                    setIsOpen(false);
                    clearFilters();
                  }}
                  className={`
                    w-full text-left px-3 py-2.5 text-sm transition-colors
                    flex items-center justify-between border-b border-gray-100
                    ${selectedUploadId === null
                      ? 'bg-teal-50 text-teal-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <span className="text-xs font-medium">All Files</span>
                  {selectedUploadId === null && (
                    <FiCheck className="h-4 w-4 text-teal-600" />
                  )}
                </button>

                {/* Filtered File Options */}
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        onSelect(option.id);
                        setIsOpen(false);
                        clearFilters();
                      }}
                      className={`
                        w-full text-left px-3 py-2.5 text-sm transition-colors
                        flex items-center justify-between border-b border-gray-100
                        ${selectedUploadId === option.id
                          ? 'bg-teal-50 text-teal-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                        {getFileIcon(option.filename)}
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-xs font-medium">{option.displayName}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {option.patient_count} patient{option.patient_count !== 1 ? 's' : ''}
                            {option.uploaded_at && (() => {
                              const localDate = utcToLocalDate(option.uploaded_at);
                              return localDate ? (
                                <span className="ml-1.5">
                                  • {localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </div>
                      {selectedUploadId === option.id && (
                        <FiCheck className="h-4 w-4 text-teal-600 flex-shrink-0" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-8 text-center text-xs text-gray-500">
                    No matching files
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

