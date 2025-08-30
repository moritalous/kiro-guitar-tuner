/**
 * PitchDetector クラス
 * 自己相関アルゴリズムによる音程検出
 */

import type { AudioConfig } from './types.js';
import { DEFAULT_AUDIO_CONFIG } from './types.js';

export class PitchDetector {
  private sampleRate: number;
  private config: AudioConfig;

  constructor(sampleRate: number, config: AudioConfig = DEFAULT_AUDIO_CONFIG) {
    this.sampleRate = sampleRate;
    this.config = config;
  }

  /**
   * 音声バッファから音程を検出
   * @param audioBuffer 音声データ
   * @returns 検出された周波数 (Hz) または null
   */
  detectPitch(audioBuffer: Float32Array): number | null {
    if (audioBuffer.length === 0) {
      return null;
    }

    // ギター音域にフィルタリング
    const filteredBuffer = this.applyGuitarFrequencyFilter(audioBuffer);
    
    // 自己相関を計算
    const correlations = this.autocorrelate(filteredBuffer);
    
    // 基本周波数を検出
    const result = this.findFundamentalFrequencyWithConfidence(correlations);
    
    if (result === null) {
      return null;
    }

    const { frequency, confidence } = result;
    
    // ギター音域外の場合は無効とする
    if (frequency < this.config.minFrequency || 
        frequency > this.config.maxFrequency) {
      return null;
    }

    // 信頼度が低い場合は無効とする
    if (confidence < 0.3) {
      return null;
    }

    return frequency;
  }

  /**
   * 信頼度付きで音程を検出
   * @param audioBuffer 音声データ
   * @returns 検出された周波数と信頼度、または null
   */
  detectPitchWithConfidence(audioBuffer: Float32Array): { frequency: number; confidence: number } | null {
    if (audioBuffer.length === 0) {
      return null;
    }

    // ギター音域にフィルタリング
    const filteredBuffer = this.applyGuitarFrequencyFilter(audioBuffer);
    
    // 自己相関を計算
    const correlations = this.autocorrelate(filteredBuffer);
    
    // 基本周波数を検出
    const result = this.findFundamentalFrequencyWithConfidence(correlations);
    
    if (result === null) {
      return null;
    }

    const { frequency, confidence } = result;
    
    // ギター音域外の場合は無効とする
    if (frequency < this.config.minFrequency || 
        frequency > this.config.maxFrequency) {
      return null;
    }

    return { frequency, confidence };
  }

  /**
   * 自己相関を計算
   * @param buffer 音声バッファ
   * @returns 自己相関配列
   */
  private autocorrelate(buffer: Float32Array): Float32Array {
    const bufferLength = buffer.length;
    const correlations = new Float32Array(Math.floor(bufferLength / 2));
    
    // バッファの平均を除去（DCオフセット除去）
    const mean = buffer.reduce((sum, val) => sum + val, 0) / bufferLength;
    const centeredBuffer = new Float32Array(bufferLength);
    for (let i = 0; i < bufferLength; i++) {
      centeredBuffer[i] = buffer[i] - mean;
    }
    
    // 自己相関の正規化のための分母を計算
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      sumSquares += centeredBuffer[i] * centeredBuffer[i];
    }
    
    if (sumSquares === 0) {
      return correlations; // 無音の場合
    }
    
    // 各遅延に対して自己相関を計算
    for (let lag = 0; lag < correlations.length; lag++) {
      let sum = 0;
      const samplesUsed = bufferLength - lag;
      
      // 重複する部分のみを計算
      for (let i = 0; i < samplesUsed; i++) {
        sum += centeredBuffer[i] * centeredBuffer[i + lag];
      }
      
      // 正規化（0から1の範囲に）
      correlations[lag] = sum / sumSquares;
    }
    
    return correlations;
  }

  /**
   * 自己相関から基本周波数を信頼度付きで検出
   * @param correlations 自己相関配列
   * @returns 基本周波数と信頼度、または null
   */
  private findFundamentalFrequencyWithConfidence(correlations: Float32Array): { frequency: number; confidence: number } | null {
    const minPeriod = Math.floor(this.sampleRate / this.config.maxFrequency);
    const maxPeriod = Math.floor(this.sampleRate / this.config.minFrequency);
    
    // 最初のピーク（lag=0）を無視するため、最小周期から開始
    let maxCorrelation = 0;
    let bestPeriod = 0;
    let secondBestCorrelation = 0;
    
    // より良いピーク検出のため、局所最大値を探す
    for (let period = minPeriod; period < Math.min(maxPeriod, correlations.length - 1); period++) {
      const correlation = correlations[period];
      
      // 局所最大値かチェック（前後の値より大きい）
      const isLocalMax = correlation > correlations[period - 1] && 
                        correlation > correlations[period + 1];
      
      if (isLocalMax) {
        if (correlation > maxCorrelation) {
          secondBestCorrelation = maxCorrelation;
          maxCorrelation = correlation;
          bestPeriod = period;
        } else if (correlation > secondBestCorrelation) {
          secondBestCorrelation = correlation;
        }
      }
    }
    
    // 相関が十分に強くない場合は無効
    const threshold = 0.15; // 閾値を下げて感度を上げる
    if (maxCorrelation < threshold || bestPeriod === 0) {
      return null;
    }
    
    // 信頼度を計算（最大相関と2番目の相関の差を考慮）
    const confidence = this.calculateConfidence(maxCorrelation, secondBestCorrelation, correlations, bestPeriod);
    
    // より精密な周波数計算のため、パラボリック補間を使用
    const frequency = this.parabolicInterpolation(correlations, bestPeriod);
    
    return { frequency, confidence };
  }

  /**
   * 自己相関から基本周波数を検出（後方互換性のため）
   * @param correlations 自己相関配列
   * @returns 基本周波数 (Hz) または null
   */
  // @ts-ignore - Used for backward compatibility
  private findFundamentalFrequency(correlations: Float32Array): number | null {
    const result = this.findFundamentalFrequencyWithConfidence(correlations);
    return result ? result.frequency : null;
  }

  /**
   * ギター音域にフィルタリング（簡易ローパス・ハイパスフィルタ）
   * @param buffer 音声バッファ
   * @returns フィルタリングされたバッファ
   */
  private applyGuitarFrequencyFilter(buffer: Float32Array): Float32Array {
    // 簡易的なローパスフィルタ（高周波ノイズを除去）
    const filtered = new Float32Array(buffer.length);
    const alpha = 0.8; // フィルタ係数
    
    filtered[0] = buffer[0];
    for (let i = 1; i < buffer.length; i++) {
      filtered[i] = alpha * filtered[i - 1] + (1 - alpha) * buffer[i];
    }
    
    // DCオフセット除去
    const mean = filtered.reduce((sum, val) => sum + val, 0) / filtered.length;
    for (let i = 0; i < filtered.length; i++) {
      filtered[i] -= mean;
    }
    
    return filtered;
  }

  /**
   * 信頼度を計算
   * @param maxCorrelation 最大相関値
   * @param secondBestCorrelation 2番目の相関値
   * @param correlations 自己相関配列
   * @param bestPeriod 最適周期
   * @returns 信頼度 (0-1)
   */
  private calculateConfidence(
    maxCorrelation: number, 
    secondBestCorrelation: number, 
    correlations: Float32Array, 
    bestPeriod: number
  ): number {
    // 基本信頼度：最大相関値そのもの
    let confidence = maxCorrelation;
    
    // 最大相関と2番目の相関の差が大きいほど信頼度が高い
    const correlationRatio = secondBestCorrelation > 0 ? maxCorrelation / secondBestCorrelation : maxCorrelation;
    confidence *= Math.min(correlationRatio / 2, 1);
    
    // 低周波数（ギターの低音弦）の場合は信頼度を少し上げる
    const frequency = this.sampleRate / bestPeriod;
    if (frequency < 150) { // D3より低い
      confidence *= 1.1;
    }
    
    // 周辺の相関値との一貫性をチェック
    const consistencyBonus = this.calculateConsistencyBonus(correlations, bestPeriod);
    confidence *= (1 + consistencyBonus * 0.2);
    
    return Math.min(confidence, 1); // 1を超えないように制限
  }

  /**
   * 周辺相関値との一貫性ボーナスを計算
   * @param correlations 自己相関配列
   * @param bestPeriod 最適周期
   * @returns 一貫性ボーナス (0-1)
   */
  private calculateConsistencyBonus(correlations: Float32Array, bestPeriod: number): number {
    const windowSize = 3;
    let consistentPeaks = 0;
    let totalChecked = 0;
    
    // 倍音の位置での相関値をチェック
    for (let harmonic = 2; harmonic <= 4; harmonic++) {
      const harmonicPeriod = Math.floor(bestPeriod / harmonic);
      if (harmonicPeriod >= windowSize && harmonicPeriod < correlations.length - windowSize) {
        const harmonicCorrelation = correlations[harmonicPeriod];
        const avgNeighbor = (correlations[harmonicPeriod - 1] + correlations[harmonicPeriod + 1]) / 2;
        
        if (harmonicCorrelation > avgNeighbor * 1.1) {
          consistentPeaks++;
        }
        totalChecked++;
      }
    }
    
    return totalChecked > 0 ? consistentPeaks / totalChecked : 0;
  }

  /**
   * パラボリック補間による精密な周波数計算
   * @param correlations 自己相関配列
   * @param peakIndex ピークのインデックス
   * @returns 補間された周波数
   */
  private parabolicInterpolation(correlations: Float32Array, peakIndex: number): number {
    if (peakIndex <= 0 || peakIndex >= correlations.length - 1) {
      return this.sampleRate / peakIndex;
    }
    
    const y1 = correlations[peakIndex - 1];
    const y2 = correlations[peakIndex];
    const y3 = correlations[peakIndex + 1];
    
    // パラボリック補間の公式
    const a = (y1 - 2 * y2 + y3) / 2;
    const b = (y3 - y1) / 2;
    
    if (a === 0) {
      return this.sampleRate / peakIndex;
    }
    
    const xOffset = -b / (2 * a);
    const interpolatedPeriod = peakIndex + xOffset;
    
    return this.sampleRate / interpolatedPeriod;
  }

  /**
   * サンプリングレートを更新
   * @param sampleRate 新しいサンプリングレート
   */
  updateSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
  }
}