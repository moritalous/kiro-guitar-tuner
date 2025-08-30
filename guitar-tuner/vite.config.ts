import { defineConfig } from 'vite';

export default defineConfig({
  // Build optimizations
  build: {
    // Enable minification
    minify: 'esbuild',
    // Generate source maps for debugging
    sourcemap: false,
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Separate vendor chunks if we had external dependencies
        },
        // Optimize asset naming for caching
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext || '')) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext || '')) {
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    // Target modern browsers for better optimization
    target: 'es2022',
    // Optimize CSS
    cssMinify: true,
    // Report compressed size
    reportCompressedSize: true,
    // Warn on large chunks
    chunkSizeWarningLimit: 1000,
  },
  
  // Development server configuration
  server: {
    // Enable HTTPS in development (required for microphone access)
    https: false, // Set to true when testing with real devices
    host: true,
    port: 3000,
    allowedHosts: [".free.pinggy.link"]
  },
  
  // Preview server configuration (for testing production build)
  preview: {
    https: false, // Set to true when testing with real devices
    host: true,
    port: 4173
  },
  
  // Base path for deployment
  base: './',
  
  // Environment variables
  define: {
    __DEV__: false,
  },
});