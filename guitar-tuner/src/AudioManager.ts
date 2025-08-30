/**
 * AudioManager クラス
 * マイクアクセスと音声データの取得を管理
 */

import type { AudioConfig } from './types.js';
import { DEFAULT_AUDIO_CONFIG, ErrorType } from './types.js';

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private audioBuffer: Float32Array | null = null;
  private config: AudioConfig;
  private isInitialized = false;
  private isRecording = false;

  constructor(config: AudioConfig = DEFAULT_AUDIO_CONFIG) {
    this.config = config;
  }

  /**
   * AudioManagerを初期化し、マイクアクセスを取得
   */
  async initialize(): Promise<void> {
    try {
      // ブラウザサポートチェック
      if (!this.isBrowserSupported()) {
        throw new Error(ErrorType.BROWSER_NOT_SUPPORTED);
      }

      // マイクアクセス許可を取得
      await this.requestMicrophoneAccess();

      // AudioContextを初期化
      await this.initializeAudioContext();

      // 音声処理パイプラインを設定
      this.setupAudioPipeline();

      this.isInitialized = true;
    } catch (error) {
      await this.cleanup();
      throw this.handleError(error);
    }
  }

  /**
   * 音声録音を開始
   */
  startRecording(): void {
    if (!this.isInitialized) {
      throw new Error('AudioManager is not initialized. Call initialize() first.');
    }

    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }

    this.isRecording = true;
  }

  /**
   * 音声録音を停止
   */
  stopRecording(): void {
    this.isRecording = false;
    
    if (this.audioContext?.state === 'running') {
      this.audioContext.suspend();
    }
  }

  /**
   * 現在の音声データを取得
   */
  getAudioData(): Float32Array {
    if (!this.isInitialized || !this.isRecording || !this.analyser || !this.audioBuffer) {
      return new Float32Array(0);
    }

    // 時間領域の音声データを取得
    this.analyser.getFloatTimeDomainData(this.audioBuffer);
    
    // 音量チェック
    if (!this.hasMinimumVolume(this.audioBuffer)) {
      return new Float32Array(0);
    }

    return this.audioBuffer.slice(); // コピーを返す
  }

  /**
   * リソースをクリーンアップ
   */
  async cleanup(): Promise<void> {
    this.isRecording = false;
    this.isInitialized = false;

    // MediaStreamを停止
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // AudioContextを閉じる
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // 参照をクリア
    this.analyser = null;
    this.microphone = null;
    this.audioBuffer = null;
  }

  /**
   * 初期化状態を取得
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 録音状態を取得
   */
  get recording(): boolean {
    return this.isRecording;
  }

  /**
   * サンプリングレートを取得
   */
  get sampleRate(): number {
    return this.audioContext?.sampleRate || this.config.sampleRate;
  }

  /**
   * ブラウザサポートをチェック
   */
  private isBrowserSupported(): boolean {
    // MediaDevices API のサポートチェック
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      console.error('MediaDevices API is not supported');
      return false;
    }

    // Web Audio API のサポートチェック
    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      console.error('Web Audio API is not supported');
      return false;
    }

    // HTTPS または localhost でない場合の警告
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      console.warn('HTTPS connection is recommended for microphone access');
    }

    return true;
  }

  /**
   * マイクアクセス許可を要求
   */
  private async requestMicrophoneAccess(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: this.config.sampleRate
        },
        video: false
      });

      // マイクアクセスが成功したかを確認
      if (!this.mediaStream || this.mediaStream.getTracks().length === 0) {
        throw new Error(ErrorType.MIC_NOT_AVAILABLE);
      }

      // オーディオトラックが有効かを確認
      const audioTracks = this.mediaStream.getAudioTracks();
      if (audioTracks.length === 0 || !audioTracks[0].enabled) {
        throw new Error(ErrorType.MIC_NOT_AVAILABLE);
      }

    } catch (error) {
      if (error instanceof Error) {
        // 既知のエラータイプの場合はそのまま再スロー
        if (Object.values(ErrorType).includes(error.message as ErrorType)) {
          throw error;
        }

        // ブラウザ固有のエラーハンドリング
        switch (error.name) {
          case 'NotAllowedError':
          case 'PermissionDeniedError':
            console.error('Microphone access denied by user');
            throw new Error(ErrorType.MIC_ACCESS_DENIED);
          
          case 'NotFoundError':
          case 'DevicesNotFoundError':
            console.error('No microphone device found');
            throw new Error(ErrorType.MIC_NOT_AVAILABLE);
          
          case 'NotReadableError':
          case 'TrackStartError':
            console.error('Microphone is already in use by another application');
            throw new Error(ErrorType.MIC_NOT_AVAILABLE);
          
          case 'OverconstrainedError':
          case 'ConstraintNotSatisfiedError':
            console.error('Microphone constraints could not be satisfied');
            throw new Error(ErrorType.MIC_NOT_AVAILABLE);
          
          case 'NotSupportedError':
            console.error('getUserMedia is not supported');
            throw new Error(ErrorType.BROWSER_NOT_SUPPORTED);
          
          case 'AbortError':
            console.error('getUserMedia was aborted');
            throw new Error(ErrorType.UNKNOWN_ERROR);
          
          default:
            console.error('Unknown getUserMedia error:', error);
            throw new Error(ErrorType.UNKNOWN_ERROR);
        }
      }
      
      console.error('Unexpected error during microphone access:', error);
      throw new Error(ErrorType.UNKNOWN_ERROR);
    }
  }

  /**
   * AudioContextを初期化
   */
  private async initializeAudioContext(): Promise<void> {
    try {
      // ブラウザ互換性のためのAudioContextの取得
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      if (!AudioContextClass) {
        throw new Error(ErrorType.BROWSER_NOT_SUPPORTED);
      }

      this.audioContext = new AudioContextClass({
        sampleRate: this.config.sampleRate
      });

      // AudioContextの状態をチェック
      if (!this.audioContext) {
        throw new Error(ErrorType.AUDIO_CONTEXT_ERROR);
      }

      // ユーザーインタラクション後にコンテキストを再開
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // AudioContextが正常に動作しているかを確認
      if (this.audioContext.state === 'closed') {
        throw new Error(ErrorType.AUDIO_CONTEXT_ERROR);
      }

    } catch (error) {
      if (error instanceof Error && Object.values(ErrorType).includes(error.message as ErrorType)) {
        throw error;
      }
      
      console.error('AudioContext initialization failed:', error);
      throw new Error(ErrorType.AUDIO_CONTEXT_ERROR);
    }
  }

  /**
   * 音声処理パイプラインを設定
   */
  private setupAudioPipeline(): void {
    if (!this.audioContext || !this.mediaStream) {
      throw new Error('AudioContext or MediaStream not available');
    }

    // マイクからの音声ソースを作成
    this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);

    // アナライザーノードを作成
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.config.bufferSize * 2; // 時間領域データのため2倍
    this.analyser.smoothingTimeConstant = 0.0; // スムージングを無効化

    // 音声バッファを初期化
    this.audioBuffer = new Float32Array(this.analyser.fftSize);

    // ノードを接続
    this.microphone.connect(this.analyser);
    // 注意: スピーカーには接続しない（フィードバック防止）
  }

  /**
   * 最小音量をチェック
   */
  private hasMinimumVolume(buffer: Float32Array): boolean {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sum / buffer.length);
    return rms > this.config.minVolumeThreshold;
  }

  /**
   * エラーハンドリング
   */
  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      // 既知のエラータイプの場合はそのまま返す
      if (Object.values(ErrorType).includes(error.message as ErrorType)) {
        return error;
      }
    }

    console.error('AudioManager error:', error);
    return new Error(ErrorType.UNKNOWN_ERROR);
  }
}