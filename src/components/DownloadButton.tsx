import { useState } from 'react';
import { FiDownload } from 'react-icons/fi';
import api from '../services/api';

interface DownloadButtonProps {
  filename: string;
  uploadId?: number | null;  // Optional upload ID for precise filtering
  disabled: boolean;
}

export const DownloadButton = ({ filename, uploadId, disabled }: DownloadButtonProps) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (disabled || downloading) return;
    
    try {
      setDownloading(true);
      
      // Build query parameters
      const params: { upload_id?: number } = {};
      if (uploadId) {
        params.upload_id = uploadId;
      }
      
      // Use authenticated axios request to download the file
      // Use upload_id if provided for precise filtering, otherwise use filename
      const response = await api.get(`/download/${filename}`, {
        params,
        responseType: 'blob', // Important: tell axios to expect binary data
      });
      
      // Create a blob from the response
      const blob = new Blob([response.data], { type: 'text/csv' });
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let downloadFilename = filename;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/i);
        if (filenameMatch) {
          downloadFilename = filenameMatch[1];
        }
      }
      
      // Ensure .csv extension
      if (!downloadFilename.endsWith('.csv')) {
        downloadFilename = `${downloadFilename}.csv`;
      }
      
      link.setAttribute('download', downloadFilename);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      
      // Handle blob error responses (when backend returns JSON error as blob)
      let errorMessage = 'Failed to download file';
      const error = err as { response?: { status?: number; data?: Blob | { detail?: string; message?: string } }; message?: string };
      
      if (error.response?.data instanceof Blob) {
        // Try to parse the blob as JSON if it's an error response
        try {
          const text = await error.response.data.text();
          const jsonError = JSON.parse(text) as { detail?: string; message?: string };
          errorMessage = jsonError.detail || jsonError.message || errorMessage;
        } catch {
          // If parsing fails, use default message
          errorMessage = error.response?.status === 401 
            ? 'Not authenticated. Please log in again.' 
            : 'Failed to download file';
        }
      } else {
        const data = error.response?.data as { detail?: string; message?: string } | undefined;
        errorMessage = data?.detail || data?.message || error.message || errorMessage;
      }
      
      // Show user-friendly error message
      alert(`Download failed: ${errorMessage}`);
      
      // If authentication error, suggest re-login
      if (error.response?.status === 401) {
        const shouldRelogin = confirm('Your session may have expired. Would you like to reload the page to log in again?');
        if (shouldRelogin) {
          window.location.reload();
        }
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || downloading}
      className={`inline-flex items-center justify-center p-2 border-2 border-teal-700 text-teal-700 rounded-lg transition-all ${
        disabled || downloading
          ? 'opacity-60 cursor-not-allowed border-gray-400 text-gray-400' 
          : 'hover:bg-teal-50 hover:shadow-sm'
      }`}
      title={downloading ? 'Downloading...' : 'Export Results'}
    >
      <FiDownload size={18} />
    </button>
  );
};

