import { useEffect, useState, useRef } from 'react';
import { getSuperAdminDashboardStats, getPatientsByClinic, type SystemPatient } from '../services/api';
import { FiChevronDown, FiUser } from 'react-icons/fi';

interface Clinic {
  id: number;
  name: string;
}

export const SystemPatients = () => {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<number | null>(null);
  const [selectedClinicName, setSelectedClinicName] = useState<string>('');
  const [patients, setPatients] = useState<SystemPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [showClinicDropdown, setShowClinicDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // Refs for synchronized horizontal scrolling
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingSyncRef = useRef(false);

  // Sync scroll handlers
  const handleHeaderScroll = () => {
    if (isScrollingSyncRef.current) return;
    if (headerScrollRef.current && bodyScrollRef.current) {
      isScrollingSyncRef.current = true;
      bodyScrollRef.current.scrollLeft = headerScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isScrollingSyncRef.current = false;
      });
    }
  };

  const handleBodyScroll = () => {
    if (isScrollingSyncRef.current) return;
    if (headerScrollRef.current && bodyScrollRef.current) {
      isScrollingSyncRef.current = true;
      headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isScrollingSyncRef.current = false;
      });
    }
  };

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 640);
      setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Load clinics on mount
  useEffect(() => {
    const loadClinics = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getSuperAdminDashboardStats();
        const clinicsList = response.clinics.map(clinic => ({
          id: clinic.id,
          name: clinic.name
        }));
        setClinics(clinicsList);

        // Auto-select first clinic if available
        if (clinicsList.length > 0) {
          setSelectedClinicId(clinicsList[0].id);
          setSelectedClinicName(clinicsList[0].name);
        }
      } catch (error) {
        console.error('Failed to load clinics:', error);
        setError('Failed to load clinics. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadClinics();
  }, []);

  // Load patients when clinic is selected
  useEffect(() => {
    if (selectedClinicId) {
      const loadPatients = async () => {
        try {
          setPatientsLoading(true);
          setError(null);
          const response = await getPatientsByClinic(selectedClinicId);
          setPatients(response.patients);
        } catch (error) {
          console.error('Failed to load patients:', error);
          setError('Failed to load patients. Please try again.');
          setPatients([]);
        } finally {
          setPatientsLoading(false);
        }
      };

      loadPatients();
    }
  }, [selectedClinicId]);

  const handleClinicSelect = (clinic: Clinic) => {
    setSelectedClinicId(clinic.id);
    setSelectedClinicName(clinic.name);
    setShowClinicDropdown(false);
  };

  const formatCurrency = (amount: string | number): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(numAmount);
  };

  const getPatientName = (patient: SystemPatient): string => {
    const fullName = `${patient.patient_first_name} ${patient.patient_last_name}`.trim();
    return fullName
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatDate = (dateString: string): string => {
    if (!dateString || dateString === '-') return '-';
    
    // Parse date in MM/DD/YYYY format
    const parts = dateString.split('/');
    if (parts.length !== 3) return dateString;
    
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    if (isNaN(month) || isNaN(day) || isNaN(year)) return dateString;
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[month - 1];
    
    return `${monthName} ${day} ${year}`;
  };

  // Show full-page loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg text-foreground">Loading clinics...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !selectedClinicId) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="liquid-glass-btn-primary px-4 py-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-2 sm:px-4 md:px-0 -mt-4">
      {/* Header with Clinic Selector */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Heading */}
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          System Patients
        </h1>

        {/* Right: Clinic Selector */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-sm font-medium text-foreground whitespace-nowrap">Viewing Clinic:</span>
          <div className="relative flex-1 sm:flex-initial">
            <button
              onClick={() => setShowClinicDropdown(!showClinicDropdown)}
              className={`
                w-full sm:w-auto min-w-[250px] px-4 py-2.5 text-sm font-medium
                flex items-center justify-between gap-2
                bg-gradient-to-br from-white/50 via-white/30 to-primary/10 backdrop-blur-xl 
                border border-white/50 rounded-lg sm:rounded-xl
                shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_2px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(255,255,255,0.2)]
                transition-all duration-300
                hover:bg-gradient-to-br hover:from-white/60 hover:via-white/40 hover:to-primary/15 
                hover:shadow-[0_12px_40px_rgba(0,0,0,0.15),inset_0_2px_0_rgba(255,255,255,0.9)]
                focus:outline-none focus:ring-2 focus:ring-primary/40
                ${showClinicDropdown ? 'ring-2 ring-primary/40' : ''}
              `}
            >
              <span className="truncate flex-1 text-left text-foreground">
                {selectedClinicName || 'Select Clinic'}
              </span>
              <FiChevronDown
                className={`h-4 w-4 text-foreground flex-shrink-0 transition-transform duration-200 ${showClinicDropdown ? 'transform rotate-180' : ''
                  }`}
              />
            </button>

            {showClinicDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowClinicDropdown(false)}
                />
                <div className="absolute top-full left-0 mt-2 w-full sm:w-auto min-w-[250px] z-20 rounded-xl overflow-hidden
                  bg-gradient-to-br from-white/50 via-white/30 to-primary/10 backdrop-blur-xl
                  border border-white/50
                  shadow-[0_12px_40px_rgba(0,0,0,0.15),inset_0_2px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(255,255,255,0.2)]
                  max-h-60 overflow-y-auto">
                  {clinics.map((clinic) => (
                    <button
                      key={clinic.id}
                      onClick={() => handleClinicSelect(clinic)}
                      className={`
                        w-full px-4 py-2.5 text-left text-sm font-medium transition-all duration-200
                        ${selectedClinicId === clinic.id
                          ? 'bg-white/20 text-foreground font-semibold'
                            : 'text-foreground hover:bg-white/10'
                        }
                        first:rounded-t-xl last:rounded-b-xl
                      `}
                    >
                      {clinic.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Patients Table */}
      {selectedClinicId && (
        <>
          {patientsLoading ? (
            <div className="liquid-glass-table p-8 sm:p-10 md:p-12 flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm font-medium text-foreground">Loading patients...</p>
              </div>
            </div>
          ) : error ? (
            <div className="liquid-glass-table p-8 sm:p-10 md:p-12 flex items-center justify-center">
              <div className="text-center">
                <div className="text-red-500 mb-4">
                  <p className="font-medium">Failed to load patients</p>
                  <p className="text-sm text-foreground mt-1">{error}</p>
                </div>
                <button
                  onClick={() => {
                    const loadPatients = async () => {
                      try {
                        setPatientsLoading(true);
                        setError(null);
                        const response = await getPatientsByClinic(selectedClinicId!);
                        setPatients(response.patients);
                      } catch (error) {
                        console.error('Failed to load patients:', error);
                        setError('Failed to load patients. Please try again.');
                        setPatients([]);
                      } finally {
                        setPatientsLoading(false);
                      }
                    };
                    loadPatients();
                  }}
                  className="liquid-glass-btn-primary px-4 py-2"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : patients.length === 0 ? (
            <div className="liquid-glass-table p-8 sm:p-10 md:p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 border border-white/30">
                <FiUser className="w-8 h-8 text-foreground" />
              </div>
              <p className="text-foreground text-xl font-bold mb-2">No patients found</p>
              <p className="text-foreground">No patients are registered for this clinic.</p>
            </div>
          ) : (
            <div className="relative bg-gradient-to-br from-[#9a8ea2]/80 to-[#b0a4b2]/60 backdrop-blur-xl rounded-xl p-2 sm:p-3 md:p-4 border-[3px] border-[#e8a855]/70 shadow-[0_0_30px_rgba(232,168,85,0.5),0_0_60px_rgba(232,168,85,0.2),0_8px_32px_rgba(150,130,160,0.25),inset_0_1px_0_rgba(255,255,255,0.4)] flex flex-col overflow-hidden glass-shine">
              {/* Glossy Top Highlight */}
              <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-white/25 via-white/10 to-transparent rounded-t-xl pointer-events-none" />

              <div className="overflow-hidden rounded-xl flex-1 flex flex-col relative z-10">
                {/* Header scroll container */}
                <div ref={headerScrollRef} onScroll={handleHeaderScroll} className="overflow-x-auto xl:overflow-x-hidden" style={{ paddingRight: '17px' }}>
                  {/* Header Table - not scrollable vertically */}
                  <table className="w-full text-[10px] sm:text-xs md:text-sm xl:w-full lg:min-w-[800px] md:min-w-[600px] min-w-[500px]" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: isMobile ? '22%' : isTablet ? '24%' : '25%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: isMobile ? '18%' : isTablet ? '16%' : '15%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead className="bg-[#9a8ea2]">
                      <tr>
                        <th className="text-left font-semibold py-1.5 sm:py-2 px-1.5 sm:px-2 md:px-3 lg:px-4 text-foreground text-xs md:text-sm">
                          Patient Name
                        </th>
                        <th className="text-left font-semibold py-1.5 sm:py-2 px-1.5 sm:px-2 md:px-3 lg:px-4 text-foreground text-xs md:text-sm">
                          Contact Info
                        </th>
                        <th className="text-left font-semibold py-1.5 sm:py-2 px-1.5 sm:px-2 md:px-3 lg:px-4 text-foreground text-xs md:text-sm whitespace-nowrap">
                          Estimated Date
                        </th>
                        <th className="text-left font-semibold py-1.5 sm:py-2 px-1.5 sm:px-2 md:px-3 lg:px-4 text-foreground text-xs md:text-sm whitespace-nowrap">
                          Amount Paid
                        </th>
                        <th className="text-left font-semibold py-1.5 sm:py-2 px-1.5 sm:px-2 md:px-3 lg:px-4 text-foreground text-xs md:text-sm whitespace-nowrap">
                          Balance
                        </th>
                      </tr>
                    </thead>
                  </table>
                </div>

                {/* Scrollable Body Container - synced horizontal scroll with header */}
                <div ref={bodyScrollRef} onScroll={handleBodyScroll} className="max-h-[69vh] overflow-auto xl:overflow-x-hidden flex-1 bg-white/80 rounded-lg">
                  <table className="w-full text-[10px] sm:text-xs md:text-sm xl:w-full lg:min-w-[800px] md:min-w-[600px] min-w-[500px]" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: isMobile ? '22%' : isTablet ? '24%' : '25%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: isMobile ? '18%' : isTablet ? '16%' : '15%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '20%' }} />
                    </colgroup>
                    <tbody className="divide-y divide-[#9a8ea2]/30">
                      {patients.map((patient) => (
                        <tr
                          key={patient.id}
                          className="bg-transparent hover:bg-white/10 transition-all duration-200"
                        >
                          <td className="py-3 sm:py-4 px-1.5 sm:px-2 md:px-3 lg:px-4 text-[10px] sm:text-xs md:text-sm font-medium text-foreground truncate">
                            {getPatientName(patient)}
                          </td>
                          <td className="py-3 sm:py-4 px-1.5 sm:px-2 md:px-3 lg:px-4 text-[10px] sm:text-xs md:text-sm text-foreground truncate" style={{ textTransform: 'none' }}>
                            {patient.phone_number}
                          </td>
                          <td className="py-3 sm:py-4 px-1.5 sm:px-2 md:px-3 lg:px-4 text-[10px] sm:text-xs md:text-sm text-foreground whitespace-nowrap">
                            {formatDate(patient.estimated_date)}
                          </td>
                          <td className="py-3 sm:py-4 px-1.5 sm:px-2 md:px-3 lg:px-4 text-[10px] sm:text-xs md:text-sm font-medium text-green-600 whitespace-nowrap">
                            {formatCurrency(patient.amount_paid)}
                          </td>
                          <td className="py-3 sm:py-4 px-1.5 sm:px-2 md:px-3 lg:px-4 text-[10px] sm:text-xs md:text-sm font-semibold text-red-600 whitespace-nowrap">
                            {formatCurrency(patient.current_outstanding_balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!selectedClinicId && !loading && (
        <div className="liquid-glass-table p-8 sm:p-10 md:p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 border border-white/30">
            <FiUser className="w-8 h-8 text-foreground" />
          </div>
          <p className="text-foreground text-xl font-bold mb-2">Select a Clinic</p>
          <p className="text-foreground">Please select a clinic to view patients.</p>
        </div>
      )}
    </div>
  );
};

export default SystemPatients;
