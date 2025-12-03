import { useRef, useEffect } from 'react';

interface UseAutoRefreshOptions {
  activeSection: 'dashboard' | 'upload' | 'invoice-list' | 'users' | 'patients';
  callingInProgress: boolean;
  setCallingInProgress: (value: boolean) => void;
  setActiveCalls: React.Dispatch<React.SetStateAction<Map<string, { timestamp: number; conversationId?: string }>>>;
  activeCallsRef: React.MutableRefObject<Map<string, { timestamp: number; conversationId?: string }>>;
  loadPatientData: (uploadId: number | null, silent: boolean) => Promise<void>;
  getSelectedUploadId: () => number | null;
}

export const useAutoRefresh = (options: UseAutoRefreshOptions) => {
  const {
    activeSection,
    callingInProgress,
    setCallingInProgress,
    setActiveCalls,
    activeCallsRef,
    loadPatientData,
    getSelectedUploadId,
  } = options;

  const refreshIntervalRef = useRef<number | null>(null);

  const startSmartAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    if (!callingInProgress) {
      return;
    }

    let count = 0;
    const maxRefreshes = 60;
    const refreshInterval = 2000;
    
    const checkAndRefresh = async () => {
      if (!callingInProgress || count >= maxRefreshes) {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
        setCallingInProgress(false);
        localStorage.removeItem('callingInProgress');
        return;
      }

      if (activeSection === 'upload') {
        // Refresh patient data periodically - call_status is included in patient data
              const currentUploadId = getSelectedUploadId();
              await loadPatientData(currentUploadId, true);
      } else {
          const currentUploadId = getSelectedUploadId();
          await loadPatientData(currentUploadId, true);
          if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
          }
          setCallingInProgress(false);
          localStorage.removeItem('callingInProgress');
          return;
      }
      
      count++;
      
      setActiveCalls((prevActiveCalls) => {
        const now = Date.now();
        const newActiveCalls = new Map(prevActiveCalls);
        
        prevActiveCalls.forEach((callInfo, phone) => {
          if (now - callInfo.timestamp > 10 * 60 * 1000) {
            newActiveCalls.delete(phone);
          }
        });
        
        activeCallsRef.current = newActiveCalls;
        return newActiveCalls;
      });

      if (count >= maxRefreshes) {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
        setCallingInProgress(false);
        localStorage.removeItem('callingInProgress');
        setActiveCalls(new Map());
        activeCallsRef.current = new Map();
        localStorage.removeItem('activeCalls');
      }
    };
    
    refreshIntervalRef.current = window.setInterval(checkAndRefresh, refreshInterval);
    
    if (activeSection === 'upload') {
      const currentUploadId = getSelectedUploadId();
      loadPatientData(currentUploadId, true);
    }
  };

  const stopAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    setCallingInProgress(false);
    localStorage.removeItem('callingInProgress');
  };

  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    startSmartAutoRefresh,
    stopAutoRefresh,
  };
};
