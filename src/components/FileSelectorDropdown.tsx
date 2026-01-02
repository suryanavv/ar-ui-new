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
  total_paid_amount?: string;
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
      const isMobile = window.innerWidth < 640; // sm breakpoint
      const isTablet = window.innerWidth < 1024; // lg breakpoint
      
      let width = Math.max(rect.width, 600);
      let left = rect.left + window.scrollX;
      
      // On mobile, make it almost full width with some margin
      if (isMobile) {
        width = Math.min(window.innerWidth - 16, 600);
        left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      } else if (isTablet) {
        width = Math.min(Math.max(rect.width, 500), window.innerWidth - 32);
        left = Math.max(16, Math.min(left, window.innerWidth - width - 16));
      }
      
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: left,
        width: width
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
          w-full px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium
          flex items-center justify-between gap-1.5 sm:gap-2
          bg-gradient-to-br from-white/50 via-white/30 to-primary/10 backdrop-blur-xl 
          border border-white/50 rounded-lg sm:rounded-xl
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
          className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground flex-shrink-0 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''
            }`}
        />
      </button>

      {isOpen && !disabled && createPortal(
        <div
          ref={portalRef}
          className="fixed z-[9999] bg-gradient-to-br from-white/70 via-white/50 to-primary/5 backdrop-blur-3xl rounded-xl sm:rounded-2xl overflow-hidden border border-white/60 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.1),inset_0_2px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(255,255,255,0.3)] max-h-[60vh] sm:max-h-[400px] max-w-[calc(100vw-16px)] flex flex-col"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width
          }}
          onClick={(e) => e.stopPropagation()}
        >

          {/* Main Container */}
          <div className="flex flex-col sm:flex-row flex-1 min-h-0 max-h-[60vh] sm:max-h-[400px]">
            {/* Left Sidebar - Filter Navigation */}
            <div className="w-full sm:w-40 md:w-48 bg-gradient-to-b from-primary/10 via-white/20 to-white/5 sm:border-r border-b sm:border-b-0 border-white/40 flex flex-col flex-shrink-0 backdrop-blur-xl sm:h-full">
              <div className="p-2 sm:p-2 border-b border-white/30 bg-white/20 flex-shrink-0">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Filter by</span>
              </div>

              {/* Filter Type Navigation Items */}
              <div className="flex flex-row sm:flex-col p-2 sm:p-1.5 gap-2 sm:gap-0.5 flex-1 min-h-0 overflow-x-auto sm:overflow-x-visible scrollbar-hide">
                <button
                  onClick={() => {
                    setSearchType('filename');
                    clearFilters();
                  }}
                  className={`
                    flex-1 sm:w-full px-3 sm:px-2.5 py-2 sm:py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap
                    flex items-center justify-center sm:justify-between gap-2 transition-all text-center sm:text-left flex-shrink-0
                    ${searchType === 'filename'
                      ? 'bg-primary text-white shadow-[0_4px_12px_rgba(14,165,163,0.3),inset_0_1px_0_rgba(255,255,255,0.3)]'
                      : 'text-foreground bg-white/30 hover:bg-white/50 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <FiSearch className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">File Name</span>
                    <span className="sm:hidden">Name</span>
                  </div>
                  {searchType === 'filename' && searchTerm && (
                    <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-white flex-shrink-0"></div>
                  )}
                </button>

                <button
                  onClick={() => {
                    setSearchType('date');
                    clearFilters();
                  }}
                  className={`
                    flex-1 sm:w-full px-3 sm:px-2.5 py-2 sm:py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap
                    flex items-center justify-center sm:justify-between gap-2 transition-all text-center sm:text-left flex-shrink-0
                    ${searchType === 'date'
                      ? 'bg-primary text-white shadow-[0_4px_12px_rgba(14,165,163,0.3),inset_0_1px_0_rgba(255,255,255,0.3)]'
                      : 'text-foreground bg-white/30 hover:bg-white/50 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <FiCalendar className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">Single Date</span>
                    <span className="sm:hidden">Date</span>
                  </div>
                  {searchType === 'date' && singleDate && (
                    <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-white flex-shrink-0"></div>
                  )}
                </button>

                <button
                  onClick={() => {
                    setSearchType('daterange');
                    clearFilters();
                  }}
                  className={`
                    flex-1 sm:w-full px-3 sm:px-2.5 py-2 sm:py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap
                    flex items-center justify-center sm:justify-between gap-2 transition-all text-center sm:text-left flex-shrink-0
                    ${searchType === 'daterange'
                      ? 'bg-primary text-white shadow-[0_4px_12px_rgba(14,165,163,0.3),inset_0_1px_0_rgba(255,255,255,0.3)]'
                      : 'text-foreground bg-white/30 hover:bg-white/50 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <FiCalendar className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">Date Range</span>
                    <span className="sm:hidden">Range</span>
                  </div>
                  {searchType === 'daterange' && startDate && endDate && (
                    <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-white flex-shrink-0"></div>
                  )}
                </button>
              </div>
            </div>


            {/* Right Section - Search Input & File List */}
            <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-white/40 via-white/30 to-white/20 backdrop-blur-xl overflow-hidden">
              {/* Search Input Area */}
              <div className="p-2 sm:p-3 border-b border-white/30 bg-white/30 flex-shrink-0">

                {/* Filename Search */}
                {searchType === 'filename' && (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type to search files..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-gradient-to-br from-white/80 to-white/60 border border-white/60 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200"
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
                <div className="mt-1.5 sm:mt-2 text-xs text-muted-foreground font-medium">
                  {filteredOptions.length} file{filteredOptions.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* File Options List */}
              <div className="overflow-y-auto flex-1 min-h-0">
                {/* All Files Option */}
                <button
                  onClick={() => {
                    onSelect(null);
                    setIsOpen(false);
                    clearFilters();
                  }}
                  className={`
                    w-full text-left px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm transition-all duration-300
                    flex items-center justify-between border-b border-white/20
                    ${selectedUploadId === null
                      ? 'bg-gradient-to-r from-primary/20 to-primary/10 text-foreground font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_0_0_1px_rgba(14,165,163,0.25)]'
                      : 'text-foreground hover:bg-gradient-to-r hover:from-white/50 hover:to-white/30 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
                    }
                  `}
                >
                  <span className="text-xs sm:text-sm font-medium">All Files</span>
                  {selectedUploadId === null && (
                    <FiCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
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

                    const formatCurrency = (amount: string | undefined): string => {
                      if (!amount) return '$0.00';
                      const numAmount = parseFloat(amount);
                      if (isNaN(numAmount)) return '$0.00';
                      return new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2
                      }).format(numAmount);
                    };

                    const paidAmount = formatCurrency(option.total_paid_amount);

                    return (
                      <button
                        key={option.id}
                        onClick={() => {
                          onSelect(option.id);
                          setIsOpen(false);
                          clearFilters();
                        }}
                        className={`
                          w-full text-left px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm transition-all duration-300
                          flex items-center justify-between border-b border-white/20
                          ${selectedUploadId === option.id
                            ? 'bg-gradient-to-r from-primary/20 to-primary/10 text-foreground font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_0_0_1px_rgba(14,165,163,0.25)]'
                            : 'text-foreground hover:bg-gradient-to-r hover:from-white/50 hover:to-white/30 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
                          }
                        `}

                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 pr-2">
                          {getFileIcon(option.filename)}
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-xs sm:text-sm font-medium">{option.displayName}</div>
                            <div className="text-[10px] sm:text-xs text-foreground/70 mt-0.5 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span>{option.patient_count} patient{option.patient_count !== 1 ? 's' : ''}</span>
                              {formattedDate && (
                                <>
                                  <span>•</span>
                                  <span>{formattedDate}</span>
                                </>
                              )}
                              {option.total_paid_amount !== undefined && (
                                <>
                                  <span>•</span>
                                  <span className={parseFloat(option.total_paid_amount || '0') > 0 ? 'text-green-600 font-semibold' : ''}>
                                    {paidAmount}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        {selectedUploadId === option.id && (
                          <FiCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    );
                  })

                ) : (
                  <div className="px-3 sm:px-4 py-8 sm:py-12 text-center text-xs sm:text-sm text-foreground/60">
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
