import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);


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
      // Check if click is inside button, dropdown container, or portal content
      if (
        dropdownRef.current?.contains(target) ||
        buttonRef.current?.contains(target) ||
        buttonRef.current === target ||
        portalRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    if (isOpen) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside, true);
      }, 10); // Slight delay to prevent immediate close

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
      const uploadedLocalDateKey = getLocalDateKey(option.uploaded_at);
      if (!uploadedLocalDateKey) return false;
      return uploadedLocalDateKey === singleDate;
    }

    // Date range search (timezone-aware)
    if (searchType === 'daterange' && startDate && endDate && option.uploaded_at) {
      const uploadedLocalDate = utcToLocalDate(option.uploaded_at);
      if (!uploadedLocalDate) return false;
      const uploadedDateKey = formatDateKey(uploadedLocalDate);
      return uploadedDateKey >= startDate && uploadedDateKey <= endDate;
    }

    return true;
  });

  const selectedOption = selectedUploadId
    ? options.find(opt => opt.id === selectedUploadId)
    : null;

  const displayText = selectedOption
    ? selectedOption.displayName
    : 'All Files';

  const clearFilters = () => {
    setSearchTerm('');
    setSingleDate('');
    setStartDate('');
    setEndDate('');
  };

  // Calculate dropdown position when opening
  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 600)
      });
    }
  };

  // Update position when isOpen changes
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      // Also update on scroll/resize
      const handleUpdate = () => updateDropdownPosition();
      window.addEventListener('scroll', handleUpdate, true);
      window.addEventListener('resize', handleUpdate);
      return () => {
        window.removeEventListener('scroll', handleUpdate, true);
        window.removeEventListener('resize', handleUpdate);
      };
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button - Glass Style */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) {
            updateDropdownPosition();
            setIsOpen((prev) => !prev);
          }
        }}
        disabled={disabled}
        className={`
          w-full px-3 py-2 text-sm font-medium
          flex items-center justify-between gap-2
          bg-gradient-to-br from-white/50 via-white/30 to-primary/10 backdrop-blur-xl 
          border border-white/50 rounded-xl
          shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_2px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(255,255,255,0.2)]
          transition-all duration-300
          ${disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-gradient-to-br hover:from-white/60 hover:via-white/40 hover:to-primary/15 hover:shadow-[0_12px_40px_rgba(0,0,0,0.15),inset_0_2px_0_rgba(255,255,255,0.9)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40'
          }
        `}
      >
        <span className="truncate flex-1 text-left text-foreground">{displayText}</span>
        <FiChevronDown
          className={`h-4 w-4 text-foreground flex-shrink-0 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''
            }`}
        />
      </button>

      {isOpen && !disabled && createPortal(
        <div
          ref={portalRef}
          className="fixed z-[9999] bg-gradient-to-br from-white/70 via-white/50 to-primary/5 backdrop-blur-3xl rounded-2xl overflow-hidden border border-white/60 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.1),inset_0_2px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(255,255,255,0.3)]"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            maxHeight: '500px'
          }}
          onClick={(e) => e.stopPropagation()}
        >

          {/* Main Container */}
          <div className="flex h-full">
            {/* Left Sidebar - Filter Navigation */}
            <div className="w-48 bg-gradient-to-b from-primary/10 via-white/20 to-white/5 border-r border-white/40 flex flex-col flex-shrink-0 backdrop-blur-xl">
              <div className="p-3 border-b border-white/30 bg-white/20">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Filter by</span>
              </div>

              {/* Filter Type Navigation Items */}
              <div className="flex flex-col p-2 gap-1">
                <button
                  onClick={() => {
                    setSearchType('filename');
                    clearFilters();
                  }}
                  className={`
                    w-full px-3 py-2 text-sm font-medium rounded-lg
                    flex items-center gap-2 transition-all text-left
                    ${searchType === 'filename'
                      ? 'bg-primary text-white shadow-[0_4px_12px_rgba(14,165,163,0.3),inset_0_1px_0_rgba(255,255,255,0.3)]'
                      : 'text-foreground hover:bg-white/40 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
                    }
                  `}
                >
                  <FiSearch className="w-4 h-4 flex-shrink-0" />
                  <span>File Name</span>
                  {searchType === 'filename' && searchTerm && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>
                  )}
                </button>

                <button
                  onClick={() => {
                    setSearchType('date');
                    clearFilters();
                  }}
                  className={`
                    w-full px-3 py-2 text-sm font-medium rounded-lg
                    flex items-center gap-2 transition-all text-left
                    ${searchType === 'date'
                      ? 'bg-primary text-white shadow-[0_4px_12px_rgba(14,165,163,0.3),inset_0_1px_0_rgba(255,255,255,0.3)]'
                      : 'text-foreground hover:bg-white/40 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
                    }
                  `}
                >
                  <FiCalendar className="w-4 h-4 flex-shrink-0" />
                  <span>Single Date</span>
                  {searchType === 'date' && singleDate && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>
                  )}
                </button>

                <button
                  onClick={() => {
                    setSearchType('daterange');
                    clearFilters();
                  }}
                  className={`
                    w-full px-3 py-2 text-sm font-medium rounded-lg
                    flex items-center gap-2 transition-all text-left
                    ${searchType === 'daterange'
                      ? 'bg-primary text-white shadow-[0_4px_12px_rgba(14,165,163,0.3),inset_0_1px_0_rgba(255,255,255,0.3)]'
                      : 'text-foreground hover:bg-white/40 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
                    }
                  `}
                >
                  <FiCalendar className="w-4 h-4 flex-shrink-0" />
                  <span>Date Range</span>
                  {searchType === 'daterange' && startDate && endDate && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>
                  )}
                </button>
              </div>
            </div>


            {/* Right Section - Search Input & File List */}
            <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-white/40 via-white/30 to-white/20 backdrop-blur-xl">
              {/* Search Input Area */}
              <div className="p-4 border-b border-white/30 bg-white/30">

                {/* Filename Search */}
                {searchType === 'filename' && (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type to search files..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-3 py-2 text-sm bg-gradient-to-br from-white/80 to-white/60 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200"
                    />
                    {searchTerm && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchTerm('');
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <FiX className="w-4 h-4" />
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
                    className="w-full px-3 py-2 text-sm bg-gradient-to-br from-white/80 to-white/60 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200"
                  />
                )}

                {/* Date Range Search */}
                {searchType === 'daterange' && (
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="From"
                      className="w-full px-3 py-2 text-sm bg-gradient-to-br from-white/80 to-white/60 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200"
                    />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="To"
                      className="w-full px-3 py-2 text-sm bg-gradient-to-br from-white/80 to-white/60 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200"
                    />
                  </div>
                )}

                {/* Results Count */}
                <div className="mt-3 text-xs text-muted-foreground font-medium">
                  {filteredOptions.length} file{filteredOptions.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* File Options List */}
              <div className="overflow-y-auto flex-1">
                {/* All Files Option */}
                <button
                  onClick={() => {
                    onSelect(null);
                    setIsOpen(false);
                    clearFilters();
                  }}
                  className={`
                    w-full text-left px-4 py-3 text-sm transition-all duration-300
                    flex items-center justify-between border-b border-white/20
                    ${selectedUploadId === null
                      ? 'bg-gradient-to-r from-primary/20 to-primary/10 text-foreground font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_0_0_1px_rgba(14,165,163,0.25)]'
                      : 'text-foreground hover:bg-gradient-to-r hover:from-white/50 hover:to-white/30 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
                    }
                  `}
                >
                  <span className="text-sm font-medium">All Files</span>
                  {selectedUploadId === null && (
                    <FiCheck className="h-4 w-4 text-primary flex-shrink-0" />
                  )}

                </button>


                {/* Filtered File Options */}
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => {
                    const localDate = option.uploaded_at ? utcToLocalDate(option.uploaded_at) : null;
                    const formattedDate = localDate
                      ? localDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })
                      : null;

                    return (
                      <button
                        key={option.id}
                        onClick={() => {
                          onSelect(option.id);
                          setIsOpen(false);
                          clearFilters();
                        }}
                        className={`
                          w-full text-left px-4 py-3 text-sm transition-all duration-300
                          flex items-center justify-between border-b border-white/20
                          ${selectedUploadId === option.id
                            ? 'bg-gradient-to-r from-primary/20 to-primary/10 text-foreground font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_0_0_1px_rgba(14,165,163,0.25)]'
                            : 'text-foreground hover:bg-gradient-to-r hover:from-white/50 hover:to-white/30 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
                          }
                        `}

                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                          {getFileIcon(option.filename)}
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-sm font-medium">{option.displayName}</div>
                            <div className="text-xs text-foreground/70 mt-0.5 flex items-center gap-2">
                              <span>{option.patient_count} patient{option.patient_count !== 1 ? 's' : ''}</span>
                              {formattedDate && (
                                <>
                                  <span>•</span>
                                  <span>{formattedDate}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        {selectedUploadId === option.id && (
                          <FiCheck className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    );
                  })

                ) : (
                  <div className="px-4 py-12 text-center text-sm text-foreground/60">
                    No matching files
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
