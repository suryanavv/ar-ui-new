import { useState } from 'react';
import { uploadCSV, getAvailableFiles } from '../services/api';

interface FileOption {
  id: number;
  filename: string;
  displayName: string;
  uploaded_at: string | null;
  patient_count: number;
  total_paid_amount?: string;
}

interface UseFileUploadOptions {
  onUploadSuccess?: (filename: string, uploadId?: number) => void;
  onError?: (error: string) => void;
  showMessage?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const useFileUpload = (options: UseFileUploadOptions = {}) => {
  const [uploadLoading, setUploadLoading] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<Array<FileOption>>([]);
  const [lastUploadResponse, setLastUploadResponse] = useState<any>(null);

  const sanitizeFileName = (fileName: string): string => {
    const lastDotIndex = fileName.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
    const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
    
    let sanitized = nameWithoutExt.replace(/\s+/g, '');
    sanitized = sanitized.replace(/\(\d+\)/g, '');
    sanitized = sanitized.replace(/[()]/g, '');
    
    return sanitized + extension;
  };

  const loadAvailableFiles = async () => {
    try {
      const response = await getAvailableFiles();
      setAvailableFiles(response.files || []);
    } catch (error) {
      console.error('Failed to load available files:', error);
      setAvailableFiles([]);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadLoading(true);
    try {
      const sanitizedName = sanitizeFileName(file.name);
      const sanitizedFile = sanitizedName !== file.name 
        ? new File([file], sanitizedName, { type: file.type })
        : file;
      
      const response = await uploadCSV(sanitizedFile);
      const errorCount = response.errors?.length || 0;
      
      if (response.message) {
        options.showMessage?.('success', response.message);
        
        if (errorCount > 0) {
          const errorDetails = response.errors?.slice(0, 3).map((e: any) => {
            const firstName = e.patient_first_name || '';
            const lastName = e.patient_last_name || '';
            const patient = `${firstName} ${lastName}`.trim() || 'Unknown';
            const invoice = e.invoice_number || '';
            const error = e.error || 'Unknown error';
            return `${patient} (${invoice}): ${error.substring(0, 50)}${error.length > 50 ? '...' : ''}`;
          }).join('; ') || '';
          
          setTimeout(() => {
            options.showMessage?.(
              'error',
              `${errorCount} error(s) occurred during upload. ${errorCount <= 3 ? errorDetails : errorDetails + '...'}`
            );
          }, 1000);
        }
      } else {
        const newCount = response.new_count || 0;
        const updatedCount = response.updated_count || 0;
        if (newCount > 0 || updatedCount > 0) {
          options.showMessage?.('success', `Uploaded ${response.patient_count} patients successfully (${newCount} new, ${updatedCount} updated)`);
          if (errorCount > 0) {
            setTimeout(() => {
              options.showMessage?.('error', `${errorCount} error(s) occurred during upload. Check console for details.`);
            }, 1000);
          }
        } else {
          options.showMessage?.('info', `Processed ${response.patient_count} patients. All records already exist in database.`);
          if (errorCount > 0) {
            setTimeout(() => {
              options.showMessage?.('error', `${errorCount} error(s) occurred during upload. Check console for details.`);
            }, 1000);
          }
        }
      }
      
      if (errorCount > 0 && response.errors) {
        console.error('Upload errors:', response.errors);
      }
      
      const uploadedFilename = response.filename || '';
      const uploadId = response.upload_id;  // Get upload_id from response
      
      // Store the full upload response for download
      setLastUploadResponse(response);
      
      options.onUploadSuccess?.(uploadedFilename, uploadId);
      
      await loadAvailableFiles();
      
      return {
        filename: uploadedFilename,
        uploadId: uploadId,  // Return upload_id
        availableFiles: availableFiles,
      };
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      console.error('Upload failed:', error);
      const errorMessage = err.response?.data?.detail || 'Failed to upload file';
      options.showMessage?.('error', errorMessage);
      options.onError?.(errorMessage);
      throw error;
    } finally {
      setUploadLoading(false);
    }
  };

  return {
    uploadLoading,
    availableFiles,
    handleFileUpload,
    loadAvailableFiles,
    lastUploadResponse,
  };
};

