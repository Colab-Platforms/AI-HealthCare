import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed recently
    const dismissedTime = localStorage.getItem('pwa-install-dismissed');
    if (dismissedTime) {
      const timeSinceDismissed = Date.now() - parseInt(dismissedTime);
      const twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds
      
      if (timeSinceDismissed < twoMinutes) {
        // Set timeout to show after remaining time
        const remainingTime = twoMinutes - timeSinceDismissed;
        setTimeout(() => {
          setShowPrompt(true);
        }, remainingTime);
        return;
      }
    }

    // Show prompt immediately if not dismissed recently
    setShowPrompt(true);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Fallback for browsers that don't support beforeinstallprompt
      alert('To install this app:\n\n1. Tap the Share button\n2. Select "Add to Home Screen"');
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setIsInstalled(true);
    } else {
      console.log('User dismissed the install prompt');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleClose = () => {
    setShowPrompt(false);
    // Store dismissal time
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    
    // Show again after 2 minutes
    setTimeout(() => {
      setShowPrompt(true);
    }, 2 * 60 * 1000); // 2 minutes
  };

  // Don't show if already installed or prompt is hidden
  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-24 right-4 z-40 md:hidden animate-slide-up">
      <div className="relative">
        {/* Close button - positioned at top right */}
        <button
          onClick={handleClose}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg z-10"
          aria-label="Close"
        >
          <X className="w-3 h-3 text-white" />
        </button>

        {/* Circular main button */}
        <button
          onClick={handleInstallClick}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2FC8B9] to-[#1db7a6] shadow-2xl flex items-center justify-center border-2 border-white hover:scale-110 transition-transform active:scale-95"
          aria-label="Install App"
        >
          <Download className="w-7 h-7 text-white" />
        </button>
      </div>
    </div>
  );
}
