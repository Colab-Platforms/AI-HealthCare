import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Plugin: inject Firebase env vars into service worker at build time
function injectFirebaseSwPlugin() {
  return {
    name: 'inject-firebase-sw',
    writeBundle(_, bundle) {
      const swPath = path.resolve(__dirname, 'dist/firebase-messaging-sw.js');
      if (!fs.existsSync(swPath)) return;

      let content = fs.readFileSync(swPath, 'utf-8');
      const replacements = {
        '__FIREBASE_API_KEY__': process.env.VITE_FIREBASE_API_KEY || '',
        '__FIREBASE_AUTH_DOMAIN__': process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
        '__FIREBASE_PROJECT_ID__': process.env.VITE_FIREBASE_PROJECT_ID || '',
        '__FIREBASE_STORAGE_BUCKET__': process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
        '__FIREBASE_MESSAGING_SENDER_ID__': process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        '__FIREBASE_APP_ID__': process.env.VITE_FIREBASE_APP_ID || '',
      };
      for (const [key, val] of Object.entries(replacements)) {
        content = content.replaceAll(key, JSON.stringify(val));
      }
      fs.writeFileSync(swPath, content);
    },
    // Dev mode: serve the SW with replacements on the fly
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/firebase-messaging-sw.js') return next();

        const swPath = path.resolve(__dirname, 'public/firebase-messaging-sw.js');
        let content = fs.readFileSync(swPath, 'utf-8');
        const env = loadEnv('development', process.cwd(), '');
        content = content
          .replaceAll('self.__FIREBASE_API_KEY__', JSON.stringify(env.VITE_FIREBASE_API_KEY || ''))
          .replaceAll('self.__FIREBASE_AUTH_DOMAIN__', JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN || ''))
          .replaceAll('self.__FIREBASE_PROJECT_ID__', JSON.stringify(env.VITE_FIREBASE_PROJECT_ID || ''))
          .replaceAll('self.__FIREBASE_STORAGE_BUCKET__', JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET || ''))
          .replaceAll('self.__FIREBASE_MESSAGING_SENDER_ID__', JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''))
          .replaceAll('self.__FIREBASE_APP_ID__', JSON.stringify(env.VITE_FIREBASE_APP_ID || ''));

        res.setHeader('Content-Type', 'application/javascript');
        res.end(content);
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), injectFirebaseSwPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react', 'recharts']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 5173,
    host: '0.0.0.0', // Allow access from other devices on the network
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (path) => path
      },
      // Interactive Swagger UI (backend serves /api-docs)
      '/api-docs': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  }
});
