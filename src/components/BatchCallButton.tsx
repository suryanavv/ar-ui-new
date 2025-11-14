import { FiPhone } from 'react-icons/fi';

interface BatchCallButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}

export const BatchCallButton = ({ onClick, disabled, loading }: BatchCallButtonProps) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-6 py-3 border-2 border-teal-700 text-teal-700 rounded-xl font-semibold transition-all ${
        disabled 
          ? 'opacity-60 cursor-not-allowed border-gray-400 text-gray-400' 
          : 'hover:bg-teal-50 hover:shadow-lg hover:-translate-y-0.5'
      }`}
    >
      <FiPhone size={18} />
      <span>{loading ? 'Calling...' : 'Start Calls'}</span>
    </button>
  );
};
