/**
 * TunerEngine クラス
 * ギターチューニングロジックと音程分析を担当
 */

import type { NoteData } from './types.js';
import { GUITAR_TUNING, TUNING_TOLERANCE_CENTS } from './types.js';

export class TunerEngine {
  private readonly guitarNotes: Array<{ note: string; frequency: number }>;

  constructor() {
    // ギター音程を周波数順にソート（検索効率化のため）
    this.guitarNotes = Object.entries(GUITAR_TUNING)
      .map(([note, frequency]) => ({ note, frequency }))
      .sort((a, b) => a.frequency - b.frequency);
  }

  /**
   * 周波数を分析してNoteDataオブジェクトを生成
   * @param frequency 検出された周波数 (Hz)
   * @param confidence 検出の信頼度 (0-1)
   * @returns 音程分析結果
   */
  analyzeNote(frequency: number, confidence: number = 1.0): NoteData {
    const closestNote = this.getClosestGuitarNote(frequency);
    const targetFrequency = GUITAR_TUNING[closestNote];
    const cents = this.calculateCentsDifference(frequency, targetFrequency);
    const isInTune = Math.abs(cents) <= TUNING_TOLERANCE_CENTS;

    return {
      frequency,
      note: closestNote,
      cents,
      isInTune,
      confidence
    };
  }

  /**
   * 最も近いギター音程を特定
   * @param frequency 検出された周波数 (Hz)
   * @returns 最も近いギター音程名
   */
  private getClosestGuitarNote(frequency: number): string {
    let closestNote = this.guitarNotes[0];
    let minDifference = Math.abs(frequency - closestNote.frequency);

    for (const noteData of this.guitarNotes) {
      const difference = Math.abs(frequency - noteData.frequency);
      if (difference < minDifference) {
        minDifference = difference;
        closestNote = noteData;
      }
    }

    return closestNote.note;
  }

  /**
   * セント単位での音程差を計算
   * @param frequency 検出された周波数 (Hz)
   * @param targetFrequency 目標周波数 (Hz)
   * @returns セント単位での差 (正の値=高い、負の値=低い)
   */
  private calculateCentsDifference(frequency: number, targetFrequency: number): number {
    // セント計算式: 1200 * log2(f1/f2)
    return Math.round(1200 * Math.log2(frequency / targetFrequency));
  }
}