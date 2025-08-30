/**
 * ブラウザ互換性テスト
 * 異なるブラウザ環境での動作確認
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioManager } from './AudioManager.js';
import { PitchDetector } from './PitchDetector.js';
import { TunerEngine } from './TunerEngine.js';
import { UIController } from './UIController.js';
import { ErrorType } from './types.js';

describe('ブラウザ互換性テスト', () => {
  let originalWindow: any;
  let originalNavigator: any;

  beforeEach(() => {
    // 元のグローバルオブジェクトを保存
    originalWindow = global.window;
    originalNavigator = global.navigator;
  });

  afterEach(() => {
    // グローバルオブジェクトを復元
    global.window = originalWindow;
    global.navigator = originalNavigator;
  });

  describe('Web Audio API サポート', () => {
    it('標準的なAudioContextをサポートするブラウザ', async () => {
      // 標準的なAudioContextを模擬
      const mockAudioContext = {
        state: 'running',
        sampleRate: 44100,
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createAnalyser: vi.fn().mockReturnValue({
          fftSize: 0,
          smoothingTimeConstant: 0,
          getFloatTimeDomainData: vi.fn(),
          connect: vi.fn()
        }),
        createMediaStreamSource: vi.fn().mockReturnValue({
          connect: vi.fn()
        })
      };

      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: vi.fn().mockImplementation(() => mockAudioContext)
        },
        writable: true
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue({
              getTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
              getAudioTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }])
            })
          }
        },
        writable: true
      });

      const audioManager = new AudioManager();
      await audioManager.initialize();
      
      expect(audioManager.initialized).toBe(true);
      expect(window.AudioContext).toHaveBeenCalled();
      
      await audioManager.cleanup();
    });

    it('webkitAudioContextを使用する古いブラウザ', async () => {
      // webkitAudioContextを模擬（Safari等）
      const mockWebkitAudioContext = {
        state: 'running',
        sampleRate: 44100,
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createAnalyser: vi.fn().mockReturnValue({
          fftSize: 0,
          smoothingTimeConstant: 0,
          getFloatTimeDomainData: vi.fn(),
          connect: vi.fn()
        }),
        createMediaStreamSource: vi.fn().mockReturnValue({
          connect: vi.fn()
        })
      };

      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: undefined,
          webkitAudioContext: vi.fn().mockImplementation(() => mockWebkitAudioContext)
        },
        writable: true
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue({
              getTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
              getAudioTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }])
            })
          }
        },
        writable: true
      });

      const audioManager = new AudioManager();
      await audioManager.initialize();
      
      expect(audioManager.initialized).toBe(true);
      expect((window as any).webkitAudioContext).toHaveBeenCalled();
      
      await audioManager.cleanup();
    });

    it('Web Audio APIをサポートしないブラウザ', async () => {
      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: undefined,
          webkitAudioContext: undefined
        },
        writable: true
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn()
          }
        },
        writable: true
      });

      const audioManager = new AudioManager();
      
      await expect(audioManager.initialize()).rejects.toThrow(ErrorType.BROWSER_NOT_SUPPORTED);
      expect(audioManager.initialized).toBe(false);
    });
  });

  describe('MediaDevices API サポート', () => {
    it('標準的なgetUserMediaをサポートするブラウザ', async () => {
      const mockAudioContext = {
        state: 'running',
        sampleRate: 44100,
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createAnalyser: vi.fn().mockReturnValue({
          fftSize: 0,
          smoothingTimeConstant: 0,
          getFloatTimeDomainData: vi.fn(),
          connect: vi.fn()
        }),
        createMediaStreamSource: vi.fn().mockReturnValue({
          connect: vi.fn()
        })
      };

      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: vi.fn().mockImplementation(() => mockAudioContext)
        },
        writable: true
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue({
              getTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
              getAudioTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }])
            })
          }
        },
        writable: true
      });

      const audioManager = new AudioManager();
      await audioManager.initialize();
      
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        },
        video: false
      });
      
      await audioManager.cleanup();
    });

    it('MediaDevices APIをサポートしないブラウザ', async () => {
      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: vi.fn()
        },
        writable: true
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: undefined
        },
        writable: true
      });

      const audioManager = new AudioManager();
      
      await expect(audioManager.initialize()).rejects.toThrow(ErrorType.BROWSER_NOT_SUPPORTED);
    });

    it('getUserMediaが関数でないブラウザ', async () => {
      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: vi.fn()
        },
        writable: true
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: undefined
          }
        },
        writable: true
      });

      const audioManager = new AudioManager();
      
      await expect(audioManager.initialize()).rejects.toThrow(ErrorType.BROWSER_NOT_SUPPORTED);
    });
  });

  describe('サンプリングレート互換性', () => {
    it('44.1kHzサンプリングレート', async () => {
      const mockAudioContext = {
        state: 'running',
        sampleRate: 44100,
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createAnalyser: vi.fn().mockReturnValue({
          fftSize: 0,
          smoothingTimeConstant: 0,
          getFloatTimeDomainData: vi.fn(),
          connect: vi.fn()
        }),
        createMediaStreamSource: vi.fn().mockReturnValue({
          connect: vi.fn()
        })
      };

      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: vi.fn().mockImplementation(() => mockAudioContext)
        },
        writable: true
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue({
              getTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
              getAudioTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }])
            })
          }
        },
        writable: true
      });

      const audioManager = new AudioManager();
      await audioManager.initialize();
      
      expect(audioManager.sampleRate).toBe(44100);
      
      const pitchDetector = new PitchDetector(audioManager.sampleRate);
      expect(pitchDetector).toBeDefined();
      
      await audioManager.cleanup();
    });

    it('48kHzサンプリングレート', async () => {
      const mockAudioContext = {
        state: 'running',
        sampleRate: 48000,
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createAnalyser: vi.fn().mockReturnValue({
          fftSize: 0,
          smoothingTimeConstant: 0,
          getFloatTimeDomainData: vi.fn(),
          connect: vi.fn()
        }),
        createMediaStreamSource: vi.fn().mockReturnValue({
          connect: vi.fn()
        })
      };

      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: vi.fn().mockImplementation(() => mockAudioContext)
        },
        writable: true
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue({
              getTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
              getAudioTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }])
            })
          }
        },
        writable: true
      });

      const audioManager = new AudioManager();
      await audioManager.initialize();
      
      expect(audioManager.sampleRate).toBe(48000);
      
      const pitchDetector = new PitchDetector(audioManager.sampleRate);
      expect(pitchDetector).toBeDefined();
      
      await audioManager.cleanup();
    });

    it('非標準サンプリングレート（22.05kHz）', async () => {
      const mockAudioContext = {
        state: 'running',
        sampleRate: 22050,
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createAnalyser: vi.fn().mockReturnValue({
          fftSize: 0,
          smoothingTimeConstant: 0,
          getFloatTimeDomainData: vi.fn(),
          connect: vi.fn()
        }),
        createMediaStreamSource: vi.fn().mockReturnValue({
          connect: vi.fn()
        })
      };

      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: vi.fn().mockImplementation(() => mockAudioContext)
        },
        writable: true
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue({
              getTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
              getAudioTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }])
            })
          }
        },
        writable: true
      });

      const audioManager = new AudioManager();
      await audioManager.initialize();
      
      expect(audioManager.sampleRate).toBe(22050);
      
      // 低いサンプリングレートでも動作することを確認
      const pitchDetector = new PitchDetector(audioManager.sampleRate);
      expect(pitchDetector).toBeDefined();
      
      await audioManager.cleanup();
    });
  });

  describe('HTTPS要件', () => {
    it('HTTPS環境での動作', async () => {
      // location.protocolをHTTPSに設定
      Object.defineProperty(global, 'location', {
        value: {
          protocol: 'https:',
          hostname: 'example.com'
        },
        writable: true
      });

      const mockAudioContext = {
        state: 'running',
        sampleRate: 44100,
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createAnalyser: vi.fn().mockReturnValue({
          fftSize: 0,
          smoothingTimeConstant: 0,
          getFloatTimeDomainData: vi.fn(),
          connect: vi.fn()
        }),
        createMediaStreamSource: vi.fn().mockReturnValue({
          connect: vi.fn()
        })
      };

      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: vi.fn().mockImplementation(() => mockAudioContext)
        },
        writable: true
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue({
              getTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
              getAudioTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }])
            })
          }
        },
        writable: true
      });

      const audioManager = new AudioManager();
      await audioManager.initialize();
      
      expect(audioManager.initialized).toBe(true);
      
      await audioManager.cleanup();
    });

    it('localhost環境での動作', async () => {
      // location.hostnameをlocalhostに設定
      Object.defineProperty(global, 'location', {
        value: {
          protocol: 'http:',
          hostname: 'localhost'
        },
        writable: true
      });

      const mockAudioContext = {
        state: 'running',
        sampleRate: 44100,
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createAnalyser: vi.fn().mockReturnValue({
          fftSize: 0,
          smoothingTimeConstant: 0,
          getFloatTimeDomainData: vi.fn(),
          connect: vi.fn()
        }),
        createMediaStreamSource: vi.fn().mockReturnValue({
          connect: vi.fn()
        })
      };

      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: vi.fn().mockImplementation(() => mockAudioContext)
        },
        writable: true
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue({
              getTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
              getAudioTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }])
            })
          }
        },
        writable: true
      });

      const audioManager = new AudioManager();
      await audioManager.initialize();
      
      expect(audioManager.initialized).toBe(true);
      
      await audioManager.cleanup();
    });
  });

  describe('モバイルブラウザ互換性', () => {
    it('モバイルSafariでの動作', async () => {
      // モバイルSafariのUser Agentを模擬
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
          mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue({
              getTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
              getAudioTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }])
            })
          }
        },
        writable: true
      });

      const mockAudioContext = {
        state: 'suspended', // モバイルSafariでは初期状態がsuspended
        sampleRate: 44100,
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createAnalyser: vi.fn().mockReturnValue({
          fftSize: 0,
          smoothingTimeConstant: 0,
          getFloatTimeDomainData: vi.fn(),
          connect: vi.fn()
        }),
        createMediaStreamSource: vi.fn().mockReturnValue({
          connect: vi.fn()
        })
      };

      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: undefined,
          webkitAudioContext: vi.fn().mockImplementation(() => mockAudioContext)
        },
        writable: true
      });

      const audioManager = new AudioManager();
      await audioManager.initialize();
      
      expect(audioManager.initialized).toBe(true);
      
      // モバイルSafariではユーザーインタラクション後にresumeが必要
      audioManager.startRecording();
      expect(mockAudioContext.resume).toHaveBeenCalled();
      
      await audioManager.cleanup();
    });

    it('Android Chromeでの動作', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
          mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue({
              getTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
              getAudioTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }])
            })
          }
        },
        writable: true
      });

      const mockAudioContext = {
        state: 'running',
        sampleRate: 48000, // Androidでは48kHzが一般的
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createAnalyser: vi.fn().mockReturnValue({
          fftSize: 0,
          smoothingTimeConstant: 0,
          getFloatTimeDomainData: vi.fn(),
          connect: vi.fn()
        }),
        createMediaStreamSource: vi.fn().mockReturnValue({
          connect: vi.fn()
        })
      };

      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: vi.fn().mockImplementation(() => mockAudioContext)
        },
        writable: true
      });

      const audioManager = new AudioManager();
      await audioManager.initialize();
      
      expect(audioManager.initialized).toBe(true);
      expect(audioManager.sampleRate).toBe(48000);
      
      await audioManager.cleanup();
    });
  });

  describe('エラーハンドリング互換性', () => {
    it('異なるブラウザでのエラーメッセージ', async () => {
      const mockAudioContext = {
        state: 'running',
        sampleRate: 44100,
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createAnalyser: vi.fn().mockReturnValue({
          fftSize: 0,
          smoothingTimeConstant: 0,
          getFloatTimeDomainData: vi.fn(),
          connect: vi.fn()
        }),
        createMediaStreamSource: vi.fn().mockReturnValue({
          connect: vi.fn()
        })
      };

      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: vi.fn().mockImplementation(() => mockAudioContext)
        },
        writable: true
      });

      // Chrome風のエラー
      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }))
          }
        },
        writable: true
      });

      let audioManager = new AudioManager();
      await expect(audioManager.initialize()).rejects.toThrow(ErrorType.MIC_ACCESS_DENIED);

      // Firefox風のエラー
      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error('Permission denied'), { name: 'PermissionDeniedError' }))
          }
        },
        writable: true
      });

      audioManager = new AudioManager();
      await expect(audioManager.initialize()).rejects.toThrow(ErrorType.MIC_ACCESS_DENIED);

      // Safari風のエラー
      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error('Device not found'), { name: 'NotFoundError' }))
          }
        },
        writable: true
      });

      audioManager = new AudioManager();
      await expect(audioManager.initialize()).rejects.toThrow(ErrorType.MIC_NOT_AVAILABLE);
    });
  });

  describe('コンポーネント互換性', () => {
    it('すべてのコンポーネントが異なるブラウザ環境で動作する', () => {
      // PitchDetectorの互換性
      const pitchDetector44k = new PitchDetector(44100);
      const pitchDetector48k = new PitchDetector(48000);
      
      expect(pitchDetector44k).toBeDefined();
      expect(pitchDetector48k).toBeDefined();
      
      // TunerEngineの互換性
      const tunerEngine = new TunerEngine();
      expect(tunerEngine).toBeDefined();
      
      // 基本的な動作確認
      const noteData = tunerEngine.analyzeNote(110, 0.8);
      expect(noteData.note).toBe('A2');
      expect(noteData.frequency).toBe(110);
      expect(noteData.confidence).toBe(0.8);
    });

    it('UIControllerのDOM互換性', () => {
      // DOM要素のモック
      const mockElement = {
        textContent: '',
        className: '',
        style: {},
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn().mockReturnValue(false)
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        click: vi.fn(),
        hidden: false
      };

      Object.defineProperty(global, 'document', {
        value: {
          getElementById: vi.fn().mockReturnValue(mockElement),
          querySelector: vi.fn().mockReturnValue(mockElement)
        },
        writable: true
      });

      const uiController = new UIController();
      expect(uiController).toBeDefined();
      
      // 基本的なUI操作が例外を投げないことを確認
      expect(() => {
        uiController.showStatus('Test message');
        uiController.updateMeter(10);
        // setTuningIndicatorメソッドは存在しないため除外
      }).not.toThrow();
    });
  });
});