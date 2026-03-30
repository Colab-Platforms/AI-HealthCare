/**
 * Global Onboarding Guard - Synchronous logic executed before React mounts.
 * This ensures that if the tour is finished, we instantly lock out all beacons via root CSS.
 */
(function() {
  const isFinished = localStorage.getItem('joyride-completed-any') === 'true';
  const userData = localStorage.getItem('user');
  let hasSeenTour = isFinished;
  if (userData) {
    try {
      const user = JSON.parse(userData);
      if (user?.profile?.hasSeenMobileTour || localStorage.getItem(`joyride-completed-${user._id}`) === 'true') {
        hasSeenTour = true;
      }
    } catch(e) {}
  }
  if (hasSeenTour) {
    document.documentElement.setAttribute('data-tour-finished', 'true');
  }
})();

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <App />
          <Toaster position="top-right" />
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Capture beforeinstallprompt globally BEFORE React mounts so it's never lost
window.__deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__deferredInstallPrompt = e;
  console.log('✅ beforeinstallprompt captured globally');
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.log('❌ Service Worker registration failed:', error);
      });
  });
}
console.log('🚀 take.health AI Platform Initialized');
