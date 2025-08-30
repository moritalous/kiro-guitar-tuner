/**
 * ギターチューナーアプリケーションの型定義
 */

/**
 * 音程データの構造
 */
export interface NoteData {
  /** 検出された周波数 (Hz) */
  frequency: number;
  /** 最も近い音程名 (例: "E2", "A2") */
  note: string;
  /** セント単位での差 (-50 to +50) */
  cents: number;
  /** チューニングが正確か (±5セント以内) */
  isInTune: boolean;
  /** 検出の信頼度 (0-1) */
  confidence: number;
}

/**
 * ギター標準チューニングの定義
 * 各弦の標準周波数 (Hz)
 */
export const GUITAR_TUNING: Record<string, number> = {
  E2: 82.41,   // 6弦 (低いE)
  A2: 110.00,  // 5弦
  D3: 146.83,  // 4弦
  G3: 196.00,  // 3弦
  B3: 246.94,  // 2弦
  E4: 329.63   // 1弦 (高いE)
} as const;

/**
 * チューニング状態の定数
 */
export const TuningState = {
  FLAT: 'flat',      // 音程が低い
  IN_TUNE: 'in-tune', // 正確
  SHARP: 'sharp'     // 音程が高い
} as const;

export type TuningState = typeof TuningState[keyof typeof TuningState];

/**
 * アプリケーションの状態
 */
export const AppState = {
  IDLE: 'idle',                    // 待機中
  REQUESTING_MIC: 'requesting-mic', // マイクアクセス要求中
  READY: 'ready',                  // 準備完了
  LISTENING: 'listening',          // 音声検出中
  ERROR: 'error'                   // エラー状態
} as const;

export type AppState = typeof AppState[keyof typeof AppState];

/**
 * エラーの種類
 */
export const ErrorType = {
  MIC_ACCESS_DENIED: 'mic-access-denied',
  MIC_NOT_AVAILABLE: 'mic-not-available',
  BROWSER_NOT_SUPPORTED: 'browser-not-supported',
  AUDIO_CONTEXT_ERROR: 'audio-context-error',
  LOW_VOLUME: 'low-volume',
  AUDIO_PROCESSING_ERROR: 'audio-processing-error',
  INITIALIZATION_ERROR: 'initialization-error',
  UNKNOWN_ERROR: 'unknown-error'
} as const;

export type ErrorType = typeof ErrorType[keyof typeof ErrorType];

/**
 * 音声処理の設定
 */
export interface AudioConfig {
  /** サンプリングレート */
  sampleRate: number;
  /** バッファサイズ */
  bufferSize: number;
  /** 最小音量閾値 */
  minVolumeThreshold: number;
  /** 最大周波数 */
  maxFrequency: number;
  /** 最小周波数 */
  minFrequency: number;
}

/**
 * デフォルトの音声設定
 */
export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  sampleRate: 44100,
  bufferSize: 4096,
  minVolumeThreshold: 0.01,
  maxFrequency: 400,  // ギターの最高音程より少し上
  minFrequency: 70    // ギターの最低音程より少し下
} as const;

/**
 * チューニングの許容範囲 (セント)
 */
export const TUNING_TOLERANCE_CENTS = 5;

/**
 * UI更新の頻度制限 (FPS)
 */
export const MAX_UPDATE_FPS = 60;