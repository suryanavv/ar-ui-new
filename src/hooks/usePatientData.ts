import { useState, useRef } from 'react';
import { getAllPatients, getPatientsByUploadId } from '../services/api';
import type { Patient } from '../types';

export const usePatientData = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const patientsRef = useRef<Patient[]>([]);
  const selectedUploadIdRef = useRef<number | null>(null);

  const loadPatientData = async (uploadId: number | null = null, silent: boolean = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      let response;
      if (uploadId) {
        response = await getPatientsByUploadId(uploadId);
      } else {
        response = await getAllPatients();
      }
      const updatedPatients = response.patients || [];
      setPatients(updatedPatients);
      patientsRef.current = updatedPatients;
    } catch (error) {
      console.error('Failed to load patient data:', error);
      setPatients([]);
      patientsRef.current = [];
      throw error;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Keep ref in sync with selectedUploadId
  const setSelectedUploadId = (uploadId: number | null) => {
    selectedUploadIdRef.current = uploadId;
  };

  const getSelectedUploadId = () => selectedUploadIdRef.current;

  return {
    patients,
    loading,
    patientsRef,
    selectedUploadIdRef,
    loadPatientData,
    setSelectedUploadId,
    getSelectedUploadId,
  };
};

