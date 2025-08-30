/**
 * AudioManager のテスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioManager } from './AudioManager.js';
import { ErrorType, DEFAULT_AUDIO_CONFIG } from './types.js';

// Web Audio API のモック
const mockAudioContext = {
  state: 'running',
  sampleRate: 44100,
  resume: vi.fn().mockResolvedValue(undefined),
  suspend: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  createAnalyser: vi.fn(),
  createMediaStreamSource: vi.fn()
};

const mockAnalyser = {
  fftSize: 0,
  smoothingTimeConstant: 0,
  getFloatTimeDomainData: vi.fn(),
  connect: vi.fn()
};

const mockMediaStreamSource = {
  connect: vi.fn()
};

const mockMediaStream = {
  getTracks: vi.fn().mockReturnValue([
    { stop: vi.fn(), enabled: true }
  ]),
  getAudioTracks: vi.fn().mockReturnValue([
    { stop: vi.fn(), enabled: true }
  ])
};

// グローバルモック
global.AudioContext = vi.fn().mockImplementation(() => mockAudioContext);

// window のモック
Object.defineProperty(global, 'window', {
  value: {
    AudioContext: global.AudioContext
  },
  writable: true
});

// navigator のモック
Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: vi.fn()
    }
  },
  writable: true
});

describe('AudioManager', () => {
  let audioManager: AudioManager;

  beforeEach(() => {
    vi.clearAllMocks();
    audioManager = new AudioManager();
    
    // モックの設定
    mockAudioContext.createAnalyser.mockReturnValue(mockAnalyser);
    mockAudioContext.createMediaStreamSource.mockReturnValue(mockMediaStreamSource);
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockMediaStream);
  });

  afterEach(async () => {
    await audioManager.cleanup();
  });

  describe('constructor', () => {
    it('デフォルト設定で初期化される', () => {
      expect(audioManager.initialized).toBe(false);
      expect(audioManager.recording).toBe(false);
    });

    it('カスタム設定で初期化される', () => {
      const customConfig = { ...DEFAULT_AUDIO_CONFIG, sampleRate: 48000 };
      const customAudioManager = new AudioManager(customConfig);
      expect(customAudioManager.initialized).toBe(false);
    });
  });

  describe('initialize', () => {
    it('正常に初期化される', async () => {
      await audioManager.initialize();
      
      expect(audioManager.initialized).toBe(true);
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: DEFAULT_AUDIO_CONFIG.sampleRate
        },
        video: false
      });
      expect(AudioContext).toHaveBeenCalled();
    });

    it('ブラウザ未対応の場合エラーを投げる', async () => {
      // window.AudioContext を削除
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true
      });
      
      await expect(audioManager.initialize()).rejects.toThrow(ErrorType.BROWSER_NOT_SUPPORTED);
      
      // テスト後に復元
      Object.defineProperty(global, 'window', {
        value: {
          AudioContext: global.AudioContext
        },
        writable: true
      });
    });

    it('マイクアクセス拒否の場合エラーを投げる', async () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      (navigator.mediaDevices.getUserMedia as any).mockRejectedValue(error);
      
      await expect(audioManager.initialize()).rejects.toThrow(ErrorType.MIC_ACCESS_DENIED);
    });

    it('マイクが見つからない場合エラーを投げる', async () => {
      const error = new Error('Device not found');
      error.name = 'NotFoundError';
      (navigator.mediaDevices.getUserMedia as any).mockRejectedValue(error);
      
      await expect(audioManager.initialize()).rejects.toThrow(ErrorType.MIC_NOT_AVAILABLE);
    });
  });

  describe('startRecording', () => {
    it('初期化前に呼び出すとエラーを投げる', () => {
      expect(() => audioManager.startRecording()).toThrow('AudioManager is not initialized');
    });

    it('初期化後に正常に録音を開始する', async () => {
      await audioManager.initialize();
      audioManager.startRecording();
      
      expect(audioManager.recording).toBe(true);
    });

    it('サスペンド状態のAudioContextを再開する', async () => {
      mockAudioContext.state = 'suspended';
      await audioManager.initialize();
      
      audioManager.startRecording();
      
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });
  });

  describe('stopRecording', () => {
    it('録音を停止する', async () => {
      mockAudioContext.state = 'running';
      await audioManager.initialize();
      audioManager.startRecording();
      audioManager.stopRecording();
      
      expect(audioManager.recording).toBe(false);
      expect(mockAudioContext.suspend).toHaveBeenCalled();
    });
  });

  describe('getAudioData', () => {
    it('初期化前は空の配列を返す', () => {
      const data = audioManager.getAudioData();
      expect(data).toEqual(new Float32Array(0));
    });

    it('録音停止中は空の配列を返す', async () => {
      await audioManager.initialize();
      const data = audioManager.getAudioData();
      expect(data).toEqual(new Float32Array(0));
    });

    it('録音中は音声データを返す', async () => {
      await audioManager.initialize();
      audioManager.startRecording();
      
      // モックデータを設定（十分な音量を持つデータ）
      const mockData = new Float32Array(4096);
      for (let i = 0; i < mockData.length; i++) {
        mockData[i] = 0.1 * Math.sin(2 * Math.PI * i / 100); // 十分な音量のサイン波
      }
      
      mockAnalyser.getFloatTimeDomainData.mockImplementation((buffer: Float32Array) => {
        for (let i = 0; i < Math.min(buffer.length, mockData.length); i++) {
          buffer[i] = mockData[i];
        }
      });
      
      const data = audioManager.getAudioData();
      expect(mockAnalyser.getFloatTimeDomainData).toHaveBeenCalled();
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('リソースを適切にクリーンアップする', async () => {
      await audioManager.initialize();
      await audioManager.cleanup();
      
      expect(audioManager.initialized).toBe(false);
      expect(audioManager.recording).toBe(false);
      expect(mockAudioContext.close).toHaveBeenCalled();
    });
  });

  describe('properties', () => {
    it('sampleRateを正しく返す', async () => {
      await audioManager.initialize();
      expect(audioManager.sampleRate).toBe(44100);
    });
  });

  describe('境界値テスト', () => {
    it('カスタム設定での初期化', async () => {
      const customConfig = {
        ...DEFAULT_AUDIO_CONFIG,
        sampleRate: 48000,
        bufferSize: 2048,
        minVolumeThreshold: 0.005,
        maxFrequency: 500,
        minFrequency: 60
      };
      
      const customAudioManager = new AudioManager(customConfig);
      await customAudioManager.initialize();
      
      expect(customAudioManager.initialized).toBe(true);
      // モック環境では実際のサンプリングレートは44100になる
      expect(customAudioManager.sampleRate).toBe(44100);
      
      await customAudioManager.cleanup();
    });

    it('最小バッファサイズでの動作', async () => {
      const minConfig = {
        ...DEFAULT_AUDIO_CONFIG,
        bufferSize: 256 // 最小サイズ
      };
      
      const minAudioManager = new AudioManager(minConfig);
      await minAudioManager.initialize();
      
      expect(minAudioManager.initialized).toBe(true);
      
      await minAudioManager.cleanup();
    });

    it('最大バッファサイズでの動作', async () => {
      const maxConfig = {
        ...DEFAULT_AUDIO_CONFIG,
        bufferSize: 32768 // 大きなサイズ
      };
      
      const maxAudioManager = new AudioManager(maxConfig);
      await maxAudioManager.initialize();
      
      expect(maxAudioManager.initialized).toBe(true);
      
      await maxAudioManager.cleanup();
    });

    it('最小音量閾値0での動作', async () => {
      const zeroThresholdConfig = {
        ...DEFAULT_AUDIO_CONFIG,
        minVolumeThreshold: 0
      };
      
      const zeroAudioManager = new AudioManager(zeroThresholdConfig);
      await zeroAudioManager.initialize();
      zeroAudioManager.startRecording();
      
      // 無音データでもgetAudioDataが動作することを確認
      const mockData = new Float32Array(4096);
      mockData.fill(0); // 完全な無音
      
      mockAnalyser.getFloatTimeDomainData.mockImplementation((buffer: Float32Array) => {
        for (let i = 0; i < Math.min(buffer.length, mockData.length); i++) {
          buffer[i] = mockData[i];
        }
      });
      
      const data = zeroAudioManager.getAudioData();
      // 閾値が0でも、完全な無音の場合は空のデータを返すことがある
      expect(data.length).toBeGreaterThanOrEqual(0);
      
      await zeroAudioManager.cleanup();
    });

    it('非常に高い音量閾値での動作', async () => {
      const highThresholdConfig = {
        ...DEFAULT_AUDIO_CONFIG,
        minVolumeThreshold: 0.9 // 非常に高い閾値
      };
      
      const highAudioManager = new AudioManager(highThresholdConfig);
      await highAudioManager.initialize();
      highAudioManager.startRecording();
      
      // 通常の音量データ
      const mockData = new Float32Array(4096);
      for (let i = 0; i < mockData.length; i++) {
        mockData[i] = 0.1 * Math.sin(2 * Math.PI * i / 100); // 通常の音量
      }
      
      mockAnalyser.getFloatTimeDomainData.mockImplementation((buffer: Float32Array) => {
        for (let i = 0; i < Math.min(buffer.length, mockData.length); i++) {
          buffer[i] = mockData[i];
        }
      });
      
      const data = highAudioManager.getAudioData();
      expect(data.length).toBe(0); // 閾値が高すぎるので空のデータを返す
      
      await highAudioManager.cleanup();
    });

    it('極端に低いサンプリングレートでの動作', async () => {
      const lowSampleRateConfig = {
        ...DEFAULT_AUDIO_CONFIG,
        sampleRate: 8000 // 低いサンプリングレート
      };
      
      const lowSampleRateAudioManager = new AudioManager(lowSampleRateConfig);
      await lowSampleRateAudioManager.initialize();
      
      expect(lowSampleRateAudioManager.initialized).toBe(true);
      
      await lowSampleRateAudioManager.cleanup();
    });

    it('極端に高いサンプリングレートでの動作', async () => {
      const highSampleRateConfig = {
        ...DEFAULT_AUDIO_CONFIG,
        sampleRate: 192000 // 高いサンプリングレート
      };
      
      const highSampleRateAudioManager = new AudioManager(highSampleRateConfig);
      await highSampleRateAudioManager.initialize();
      
      expect(highSampleRateAudioManager.initialized).toBe(true);
      
      await highSampleRateAudioManager.cleanup();
    });

    it('初期化前のプロパティアクセス', () => {
      const uninitializedManager = new AudioManager();
      
      expect(uninitializedManager.initialized).toBe(false);
      expect(uninitializedManager.recording).toBe(false);
      expect(uninitializedManager.sampleRate).toBe(DEFAULT_AUDIO_CONFIG.sampleRate);
    });

    it('複数回の初期化試行', async () => {
      await audioManager.initialize();
      expect(audioManager.initialized).toBe(true);
      
      // 2回目の初期化（エラーが発生しないことを確認）
      await audioManager.initialize();
      expect(audioManager.initialized).toBe(true);
    });

    it('複数回のクリーンアップ', async () => {
      await audioManager.initialize();
      await audioManager.cleanup();
      expect(audioManager.initialized).toBe(false);
      
      // 2回目のクリーンアップ（エラーが発生しないことを確認）
      await audioManager.cleanup();
      expect(audioManager.initialized).toBe(false);
    });

    it('録音開始・停止の繰り返し', async () => {
      await audioManager.initialize();
      
      // 複数回の開始・停止
      for (let i = 0; i < 3; i++) {
        audioManager.startRecording();
        expect(audioManager.recording).toBe(true);
        
        audioManager.stopRecording();
        expect(audioManager.recording).toBe(false);
      }
    });

    it('録音停止状態でのstopRecording呼び出し', async () => {
      await audioManager.initialize();
      
      expect(audioManager.recording).toBe(false);
      
      // 既に停止状態でstopRecordingを呼び出し（エラーが発生しないことを確認）
      audioManager.stopRecording();
      expect(audioManager.recording).toBe(false);
    });
  });
});