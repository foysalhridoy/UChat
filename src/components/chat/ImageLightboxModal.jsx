import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

export function ImageLightboxModal({ isOpen, imageUrl, caption, onClose }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `uchat_image_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // Direct anchor fallback
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <div
      className="lightbox-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Full screen image preview"
    >
      <div className="lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="lightbox-btn"
          onClick={handleDownload}
          title="Download photo"
          aria-label="Download photo"
        >
          <Download size={20} />
        </button>
        <button
          type="button"
          className="lightbox-btn close-btn"
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close"
        >
          <X size={22} />
        </button>
      </div>

      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img
          src={imageUrl}
          alt={caption || 'Chat photo'}
          className="lightbox-image"
        />
        {caption && <div className="lightbox-caption">{caption}</div>}
      </div>
    </div>
  );
}
