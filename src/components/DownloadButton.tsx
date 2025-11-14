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
      className={`inline-flex items-center gap-2 px-6 py-3 border-2 border-teal-700 text-teal-700 rounded-xl font-semibold transition-all ${
        disabled 
          ? 'opacity-60 cursor-not-allowed border-gray-400 text-gray-400' 
          : 'hover:bg-teal-50 hover:shadow-lg hover:-translate-y-0.5'
      }`}
    >
      <FiDownload size={18} />
      <span>Export CSV</span>
    </button>
  );
};

