// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import compression from 'vite-plugin-compression';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    
    // PWA Plugin with comprehensive configuration
    VitePWA({
      registerType: 'prompt', // Show update prompt instead of auto-update
      includeAssets: [
        'favicon.ico',
        'icons/*.png',
        'icons/*.svg',
        'screenshots/*.png',
        'offline.html',
      ],
      
      // Use custom service worker
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'sw.ts',
      
      // Manifest configuration
      manifest: false, // Use public/manifest.json instead
      
      // Workbox configuration for injectManifest
      injectManifest: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff,woff2,wasm}',
        ],
        globIgnores: [
          '**/node_modules/**/*',
          'sw.js',
          'workbox-*.js',
        ],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB for audio samples
      },
      
      // Development options
      devOptions: {
        enabled: false,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
    
    // Gzip compression
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
      deleteOriginFile: false,
    }),
    
    // Brotli compression
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
      deleteOriginFile: false,
    }),
  ],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@audio': path.resolve(__dirname, './src/audio'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@platform': path.resolve(__dirname, './src/platform'),
      '@db': path.resolve(__dirname, './src/db'),
    },
  },
  
  build: {
    target: 'esnext',
    sourcemap: true,
    minify: 'terser',
    
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: true,
      },
    },
    
    rollupOptions: {
      output: {
        // Optimized chunk splitting for better caching
        manualChunks: {
          // Core React
          'react-vendor': ['react', 'react-dom'],
          
          // State management
          'state': ['zustand'],
          
          // Audio engine (large, rarely changes)
          'audio-engine': [
            './src/audio/AudioEngine.ts',
            './src/audio/AudioGraph.ts',
            './src/audio/Sequencer.ts',
            './src/audio/Transport.ts',
            './src/audio/MixerChannel.ts',
          ],
          
          // Audio effects
          'audio-effects': [
            './src/audio/effects/BaseEffect.ts',
            './src/audio/effects/Delay.ts',
            './src/audio/effects/Reverb.ts',
          ],
          
          // Instruments
          'instruments': [
            './src/audio/instruments/BaseInstrument.ts',
            './src/audio/instruments/Oscillator.ts',
          ],
          
          // Database/storage
          'storage': [
            'idb',
            './src/db/ProjectDB.ts',
          ],
          
          // Platform optimizations
          'platform': [
            './src/platform/TouchOptimizations.ts',
            './src/platform/KeyboardShortcuts.ts',
          ],
          
          // UI Components (split by area)
          'ui-common': [
            './src/components/common/Button.tsx',
            './src/components/common/Knob.tsx',
            './src/components/common/Slider.tsx',
            './src/components/common/VUMeter.tsx',
            './src/components/common/Waveform.tsx',
          ],
          
          'ui-editors': [
            './src/components/editors/PianoRoll.tsx',
            './src/components/editors/PatternEditor.tsx',
            './src/components/editors/SongEditor.tsx',
            './src/components/editors/AutomationEditor.tsx',
          ],
          
          'ui-mixer': [
            './src/components/mixer/MixerView.tsx',
            './src/components/mixer/MixerChannel.tsx',
          ],
        },
        
        // Asset file naming for better caching
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          
          // Fonts
          if (/woff2?|ttf|eot/.test(ext)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          
          // Images
          if (/png|jpe?g|svg|gif|webp|ico/.test(ext)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          
          // Audio
          if (/wav|mp3|ogg|flac/.test(ext)) {
            return 'assets/audio/[name]-[hash][extname]';
          }
          
          // WASM
          if (ext === 'wasm') {
            return 'assets/wasm/[name]-[hash][extname]';
          }
          
          return 'assets/[name]-[hash][extname]';
        },
        
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    
    // Chunk size warnings
    chunkSizeWarningLimit: 1000, // 1MB
    
    // CSS code splitting
    cssCodeSplit: true,
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      'idb',
    ],
    exclude: [
      '@audio/worklets',
    ],
  },
  
  // Worker configuration
  worker: {
    format: 'es',
    plugins: () => [],
  },
  
  // Server configuration for development
  server: {
    port: 5173,
    host: true,
    headers: {
      // Required for SharedArrayBuffer (audio worklets)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  
  // Preview server configuration
  preview: {
    port: 4173,
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  
  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  
  // CSS configuration
  css: {
    devSourcemap: true,
  },
  
  // Enable JSON imports
  json: {
    stringify: true,
  },
});
