import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TextSelectionPopup() {
  const [selectedText, setSelectedText] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (text.length > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        setSelectedText(text);
        setPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        });
        setShow(true);
      } else {
        setShow(false);
      }
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);

    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('touchend', handleSelection);
    };
  }, []);

  const handleAskAI = () => {
    navigate('/ai-chat', { state: { selectedText } });
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed z-50 animate-fade-in"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%)'
      }}
    >
      <button
        onClick={handleAskAI}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-orange-500 text-white rounded-lg shadow-lg hover:shadow-xl transition-all text-sm font-medium"
      >
        <MessageSquare className="w-4 h-4" />
        Ask AI
      </button>
    </div>
  );
}
