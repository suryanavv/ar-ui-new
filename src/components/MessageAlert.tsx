import type { Message } from '../types';

interface MessageAlertProps {
  message: Message;
}

export const MessageAlert = ({ message }: MessageAlertProps) => {
  const styles = {
    success: 'bg-green-50 text-green-800 border-l-4 border-green-500',
    error: 'bg-red-50 text-red-800 border-l-4 border-red-500',
    info: 'bg-blue-50 text-blue-800 border-l-4 border-blue-500',
  };

  return (
    <div className={`px-6 py-4 mb-6 rounded-xl font-medium shadow-sm animate-slideDown ${styles[message.type]}`}>
      {message.text}
    </div>
  );
};
