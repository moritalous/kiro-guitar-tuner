/**
 * テスト環境のセットアップ
 */

import { vi } from 'vitest';

// DOM環境のセットアップ
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    createAnalyser: vi.fn(),
    createScriptProcessor: vi.fn(),
    createMediaStreamSource: vi.fn(),
    sampleRate: 44100,
    state: 'running',
    resume: vi.fn(),
    close: vi.fn()
  }))
});

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: window.AudioContext
});

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn()
  }
});