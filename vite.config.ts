import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { offlineApp } from './scripts/offline-app.ts'

export default defineConfig({
  // Relative base so the built app works from any folder or static host.
  base: './',
  plugins: [react(), offlineApp()],
  // Polling: file change events are unreliable in OneDrive folders, so edits could be missed.
  server: { host: true, watch: { usePolling: true, interval: 300 } },
  preview: { host: true },
  // One bundle of about 0.5 MB is fine for an app that runs from the computer itself.
  build: { chunkSizeWarningLimit: 900 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
