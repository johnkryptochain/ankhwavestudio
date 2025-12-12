// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment
    environment: 'jsdom',
    
    // Setup files
    setupFiles: ['./src/tests/setup.ts'],
    
    // Global test APIs
    globals: true,
    
    // Include patterns
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/tests/**/*.{test,spec}.{ts,tsx}',
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      'e2e',
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/tests/**',
        'src/vite-env.d.ts',
        'src/main.tsx',
      ],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Hook timeout
    hookTimeout: 10000,
    
    // Reporter
    reporters: ['verbose'],
    
    // Watch mode
    watch: false,
    
    // CSS handling
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    
    // Mock reset
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    
    // Deps optimization
    deps: {
      optimizer: {
        web: {
          include: ['zustand'],
        },
      },
    },
  },
  
  // Resolve aliases
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
      '@stores': fileURLToPath(new URL('./src/stores', import.meta.url)),
      '@types': fileURLToPath(new URL('./src/types', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      '@audio': fileURLToPath(new URL('./src/audio', import.meta.url)),
    },
  },
});