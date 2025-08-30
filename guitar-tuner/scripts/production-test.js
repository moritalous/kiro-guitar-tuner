#!/usr/bin/env node

/**
 * Production readiness testing script
 * Tests the built application for production deployment
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const distPath = join(projectRoot, 'dist');

console.log('🚀 Production Readiness Test\n');

let passed = 0;
let failed = 0;

function test(name, condition, message = '') {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}${message ? ': ' + message : ''}`);
    failed++;
  }
}

// Check if build exists
test('Build directory exists', existsSync(distPath));

if (!existsSync(distPath)) {
  console.log('\n❌ Build not found. Run "npm run build" first.');
  process.exit(1);
}

// Check HTML file
const htmlPath = join(distPath, 'index.html');
test('HTML file exists', existsSync(htmlPath));

if (existsSync(htmlPath)) {
  const htmlContent = readFileSync(htmlPath, 'utf-8');
  
  // Security headers check
  test('CSP meta tag present', htmlContent.includes('Content-Security-Policy'));
  test('X-Frame-Options present', htmlContent.includes('X-Frame-Options'));
  test('X-Content-Type-Options present', htmlContent.includes('X-Content-Type-Options'));
  test('Permissions Policy present', htmlContent.includes('Permissions-Policy'));
  
  // SEO and meta tags
  test('Description meta tag present', htmlContent.includes('name="description"'));
  test('Viewport meta tag present', htmlContent.includes('name="viewport"'));
  test('Theme color present', htmlContent.includes('name="theme-color"'));
  
  // Check for minified assets
  test('CSS assets linked', htmlContent.includes('.css'));
  test('JS assets linked', htmlContent.includes('.js'));
  test('Assets have hash', /assets\/(css|js)\/.*-[a-zA-Z0-9]+\.(css|js)/.test(htmlContent));
}

// Check asset files
const assetsPath = join(distPath, 'assets');
test('Assets directory exists', existsSync(assetsPath));

// Check file sizes (approximate)
if (existsSync(htmlPath)) {
  const htmlSize = readFileSync(htmlPath).length;
  test('HTML file size reasonable', htmlSize < 10000, `${htmlSize} bytes`);
}

// Check for security files
const headersPath = join(distPath, '_headers');
const htaccessPath = join(distPath, '.htaccess');
test('Security headers file exists', existsSync(headersPath));
test('Apache config file exists', existsSync(htaccessPath));

// Summary
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All tests passed! Ready for production deployment.');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please fix the issues before deploying.');
  process.exit(1);
}