import React, { useEffect } from 'react';
import { InstaxPhoto } from '../types';

interface PhotoViewerProps {
  photo: InstaxPhoto | null;
  onClose: () => void;
}

const PhotoViewer: React.FC<PhotoViewerProps> = ({ photo, onClose }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!photo) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="relative max-w-4xl max-h-[90vh] bg-white p-4 pb-12 shadow-2xl rounded-sm transform transition-transform duration-300 scale-100"
        onClick={(e) => e.stopPropagation()} // Prevent close when clicking image
      >
        <button 
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:text-amber-400 text-4xl font-light transition-colors"
        >
          &times;
        </button>
        
        <img 
          src={photo.url} 
          alt="Memory" 
          className="max-h-[75vh] w-auto object-contain border border-gray-200"
        />
        
        <div className="mt-4 text-center font-serif text-gray-800 text-xl tracking-widest">
            Christmas Memory #{photo.id + 1}
        </div>
      </div>
    </div>
  );
};

export default PhotoViewer;
