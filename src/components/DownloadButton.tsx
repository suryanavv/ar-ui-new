import { FiDownload } from 'react-icons/fi';

interface DownloadButtonProps {
  filename: string;
  disabled: boolean;
}

export const DownloadButton = ({ filename, disabled }: DownloadButtonProps) => {
  const handleDownload = () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    window.open(`${API_URL}/download/${filename}`, '_blank');
  };

  return (
    <button
      onClick={handleDownload}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-semibold transition-all ${
        disabled 
          ? 'opacity-60 cursor-not-allowed' 
          : 'hover:bg-teal-700 hover:shadow-lg hover:-translate-y-0.5'
      }`}
    >
      <FiDownload size={18} />
      <span>Export CSV</span>
    </button>
  );
};

