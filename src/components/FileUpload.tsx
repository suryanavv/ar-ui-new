import { useRef, useState } from 'react';
import { FiUpload, FiFile, FiX } from 'react-icons/fi';

interface FileUploadProps {
  onUpload: (file: File) => void;
  loading: boolean;
}

export const FileUpload = ({ onUpload, loading }: FileUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const isValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      
      if (!isValid) {
        alert('Please select a CSV, XLSX, or XLS file');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border-2 border-dashed border-blue-300 hover:border-indigo-500 hover:shadow-xl transition-all duration-300 backdrop-blur-sm">
        <div className="px-8 py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className={`p-4 rounded-full ${loading ? 'bg-gray-100' : 'bg-green-50'} transition-colors`}>
              {loading ? (
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
              ) : (
                <FiUpload className="text-green-600" size={32} />
              )}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {loading ? 'Uploading file...' : 'Upload Patient Invoice File'}
              </h3>
              <p className="text-sm text-gray-500">
                {loading ? 'Please wait while we process your file' : selectedFile ? 'File selected. Click Upload CSV to proceed.' : 'Drag and drop your file here, or click to browse'}
              </p>
            </div>

            {selectedFile ? (
              <div className="w-full max-w-md space-y-3">
                <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg border-2 border-green-300 shadow-sm">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FiFile className="text-green-600 flex-shrink-0" size={20} />
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {selectedFile.name}
                    </span>
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    disabled={loading}
                    className="ml-2 p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                  >
                    <FiX size={18} className="text-gray-500" />
                  </button>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className={`w-full inline-flex items-center justify-center gap-2 px-8 py-3 bg-green-500 text-white rounded-xl font-semibold transition-all ${
                    loading 
                      ? 'opacity-60 cursor-not-allowed' 
                      : 'hover:bg-green-600 hover:shadow-lg hover:-translate-y-0.5'
                  }`}
                >
                  <FiUpload size={18} />
                  <span>{loading ? 'Uploading...' : 'Upload CSV'}</span>
                </button>
              </div>
            ) : (
              <label className={`inline-flex items-center gap-2 px-8 py-3 bg-green-500 text-white rounded-xl font-semibold cursor-pointer transition-all ${loading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-600 hover:shadow-lg hover:-translate-y-0.5'}`}>
                <FiFile size={18} />
                <span>Choose File</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={loading}
                  className="hidden"
                />
              </label>
            )}

            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-400">Supported formats:</span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">CSV</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">XLSX</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">XLS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
