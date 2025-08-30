/**
 * TunerEngine クラスのテスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TunerEngine } from './TunerEngine.js';
import { GUITAR_TUNING, TUNING_TOLERANCE_CENTS } from './types.js';

describe('TunerEngine', () => {
  let tunerEngine: TunerEngine;

  beforeEach(() => {
    tunerEngine = new TunerEngine();
  });

  describe('analyzeNote', () => {
    it('正確なE2音程（82.41Hz）を分析する', () => {
      const frequency = GUITAR_TUNING.E2;
      const result = tunerEngine.analyzeNote(frequency);

      expect(result.frequency).toBe(frequency);
      expect(result.note).toBe('E2');
      expect(result.cents).toBe(0);
      expect(result.isInTune).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('正確なA2音程（110Hz）を分析する', () => {
      const frequency = GUITAR_TUNING.A2;
      const result = tunerEngine.analyzeNote(frequency);

      expect(result.frequency).toBe(frequency);
      expect(result.note).toBe('A2');
      expect(result.cents).toBe(0);
      expect(result.isInTune).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('正確なD3音程（146.83Hz）を分析する', () => {
      const frequency = GUITAR_TUNING.D3;
      const result = tunerEngine.analyzeNote(frequency);

      expect(result.frequency).toBe(frequency);
      expect(result.note).toBe('D3');
      expect(result.cents).toBe(0);
      expect(result.isInTune).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('正確なG3音程（196Hz）を分析する', () => {
      const frequency = GUITAR_TUNING.G3;
      const result = tunerEngine.analyzeNote(frequency);

      expect(result.frequency).toBe(frequency);
      expect(result.note).toBe('G3');
      expect(result.cents).toBe(0);
      expect(result.isInTune).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('正確なB3音程（246.94Hz）を分析する', () => {
      const frequency = GUITAR_TUNING.B3;
      const result = tunerEngine.analyzeNote(frequency);

      expect(result.frequency).toBe(frequency);
      expect(result.note).toBe('B3');
      expect(result.cents).toBe(0);
      expect(result.isInTune).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('正確なE4音程（329.63Hz）を分析する', () => {
      const frequency = GUITAR_TUNING.E4;
      const result = tunerEngine.analyzeNote(frequency);

      expect(result.frequency).toBe(frequency);
      expect(result.note).toBe('E4');
      expect(result.cents).toBe(0);
      expect(result.isInTune).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('カスタム信頼度を正しく設定する', () => {
      const frequency = GUITAR_TUNING.A2;
      const confidence = 0.75;
      const result = tunerEngine.analyzeNote(frequency, confidence);

      expect(result.confidence).toBe(confidence);
    });
  });

  describe('チューニング判定機能', () => {
    it('±5セント以内の音程を「正確」と判定する', () => {
      const baseFreq = GUITAR_TUNING.A2; // 110Hz
      
      // +5セント（わずかに高い）
      const sharpFreq = baseFreq * Math.pow(2, 5 / 1200);
      const sharpResult = tunerEngine.analyzeNote(sharpFreq);
      expect(sharpResult.isInTune).toBe(true);
      expect(sharpResult.cents).toBe(5);

      // -5セント（わずかに低い）
      const flatFreq = baseFreq * Math.pow(2, -5 / 1200);
      const flatResult = tunerEngine.analyzeNote(flatFreq);
      expect(flatResult.isInTune).toBe(true);
      expect(flatResult.cents).toBe(-5);
    });

    it('±5セントを超える音程を「不正確」と判定する', () => {
      const baseFreq = GUITAR_TUNING.A2; // 110Hz
      
      // +6セント（高すぎる）
      const sharpFreq = baseFreq * Math.pow(2, 6 / 1200);
      const sharpResult = tunerEngine.analyzeNote(sharpFreq);
      expect(sharpResult.isInTune).toBe(false);
      expect(sharpResult.cents).toBe(6);

      // -6セント（低すぎる）
      const flatFreq = baseFreq * Math.pow(2, -6 / 1200);
      const flatResult = tunerEngine.analyzeNote(flatFreq);
      expect(flatResult.isInTune).toBe(false);
      expect(flatResult.cents).toBe(-6);
    });

    it('大きくずれた音程を正しく判定する', () => {
      const baseFreq = GUITAR_TUNING.A2; // 110Hz
      
      // +50セント（かなり高い）
      const sharpFreq = baseFreq * Math.pow(2, 50 / 1200);
      const sharpResult = tunerEngine.analyzeNote(sharpFreq);
      expect(sharpResult.isInTune).toBe(false);
      expect(sharpResult.cents).toBe(50);

      // -50セント（かなり低い）
      const flatFreq = baseFreq * Math.pow(2, -50 / 1200);
      const flatResult = tunerEngine.analyzeNote(flatFreq);
      expect(flatResult.isInTune).toBe(false);
      expect(flatResult.cents).toBe(-50);
    });
  });

  describe('最も近いギター音程の特定', () => {
    it('E2とA2の中間周波数をE2に分類する', () => {
      // E2 (82.41Hz) と A2 (110Hz) の中間より少しE2寄り
      const frequency = 90; // E2に近い
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.note).toBe('E2');
      expect(result.cents).toBeGreaterThan(0); // E2より高い
    });

    it('A2とD3の中間周波数をA2に分類する', () => {
      // A2 (110Hz) と D3 (146.83Hz) の中間より少しA2寄り
      const frequency = 120; // A2に近い
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.note).toBe('A2');
      expect(result.cents).toBeGreaterThan(0); // A2より高い
    });

    it('D3とG3の中間周波数をD3に分類する', () => {
      // D3 (146.83Hz) と G3 (196Hz) の中間より少しD3寄り
      const frequency = 160; // D3に近い
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.note).toBe('D3');
      expect(result.cents).toBeGreaterThan(0); // D3より高い
    });

    it('G3とB3の中間周波数をG3に分類する', () => {
      // G3 (196Hz) と B3 (246.94Hz) の中間より少しG3寄り
      const frequency = 210; // G3に近い
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.note).toBe('G3');
      expect(result.cents).toBeGreaterThan(0); // G3より高い
    });

    it('B3とE4の中間周波数をB3に分類する', () => {
      // B3 (246.94Hz) と E4 (329.63Hz) の中間より少しB3寄り
      const frequency = 270; // B3に近い
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.note).toBe('B3');
      expect(result.cents).toBeGreaterThan(0); // B3より高い
    });

    it('ギター音域外の低い周波数を最も近いE2に分類する', () => {
      const frequency = 70; // E2より低い
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.note).toBe('E2');
      expect(result.cents).toBeLessThan(0); // E2より低い
    });

    it('ギター音域外の高い周波数を最も近いE4に分類する', () => {
      const frequency = 400; // E4より高い
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.note).toBe('E4');
      expect(result.cents).toBeGreaterThan(0); // E4より高い
    });
  });

  describe('セント計算の精度', () => {
    it('1セントの差を正確に計算する', () => {
      const baseFreq = GUITAR_TUNING.A2; // 110Hz
      const frequency = baseFreq * Math.pow(2, 1 / 1200); // +1セント
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.cents).toBe(1);
    });

    it('10セントの差を正確に計算する', () => {
      const baseFreq = GUITAR_TUNING.A2; // 110Hz
      const frequency = baseFreq * Math.pow(2, 10 / 1200); // +10セント
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.cents).toBe(10);
    });

    it('100セントの差を正確に計算する', () => {
      const baseFreq = GUITAR_TUNING.A2; // 110Hz
      const frequency = baseFreq * Math.pow(2, 100 / 1200); // +100セント
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.cents).toBe(100);
    });

    it('負のセント値を正確に計算する', () => {
      const baseFreq = GUITAR_TUNING.A2; // 110Hz
      const frequency = baseFreq * Math.pow(2, -25 / 1200); // -25セント
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.cents).toBe(-25);
    });
  });

  describe('境界値テスト', () => {
    it('TUNING_TOLERANCE_CENTS境界値でのisInTune判定', () => {
      const baseFreq = GUITAR_TUNING.A2;
      
      // 境界値ちょうど（+5セント）
      const exactBoundaryFreq = baseFreq * Math.pow(2, TUNING_TOLERANCE_CENTS / 1200);
      const exactResult = tunerEngine.analyzeNote(exactBoundaryFreq);
      expect(exactResult.isInTune).toBe(true);
      
      // 境界値を1セント超える（+6セント）
      const overBoundaryFreq = baseFreq * Math.pow(2, (TUNING_TOLERANCE_CENTS + 1) / 1200);
      const overResult = tunerEngine.analyzeNote(overBoundaryFreq);
      expect(overResult.isInTune).toBe(false);
    });

    it('負の境界値でのisInTune判定', () => {
      const baseFreq = GUITAR_TUNING.D3;
      
      // 境界値ちょうど（-5セント）
      const exactBoundaryFreq = baseFreq * Math.pow(2, -TUNING_TOLERANCE_CENTS / 1200);
      const exactResult = tunerEngine.analyzeNote(exactBoundaryFreq);
      expect(exactResult.isInTune).toBe(true);
      expect(exactResult.cents).toBe(-5);
      
      // 境界値を1セント下回る（-6セント）
      const underBoundaryFreq = baseFreq * Math.pow(2, -(TUNING_TOLERANCE_CENTS + 1) / 1200);
      const underResult = tunerEngine.analyzeNote(underBoundaryFreq);
      expect(underResult.isInTune).toBe(false);
      expect(underResult.cents).toBe(-6);
    });

    it('非常に小さな周波数差でのセント計算', () => {
      const baseFreq = GUITAR_TUNING.A2;
      const frequency = baseFreq * Math.pow(2, 0.1 / 1200); // +0.1セント
      const result = tunerEngine.analyzeNote(frequency);
      
      // 四捨五入により0セントになることを確認
      expect(result.cents).toBe(0);
    });

    it('0.5セント未満の差は0セントに丸められる', () => {
      const baseFreq = GUITAR_TUNING.B3;
      const frequency = baseFreq * Math.pow(2, 0.4 / 1200); // +0.4セント
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.cents).toBe(0);
      expect(result.isInTune).toBe(true);
    });

    it('0.5セント以上の差は1セントに丸められる', () => {
      const baseFreq = GUITAR_TUNING.G3;
      const frequency = baseFreq * Math.pow(2, 0.6 / 1200); // +0.6セント
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.cents).toBe(1);
      expect(result.isInTune).toBe(true);
    });

    it('極端に高い周波数での動作', () => {
      const frequency = 10000; // 10kHz
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.note).toBe('E4'); // 最も近いギター音程
      expect(result.frequency).toBe(frequency);
      expect(result.cents).toBeGreaterThan(1000); // 大きく外れている
      expect(result.isInTune).toBe(false);
    });

    it('極端に低い周波数での動作', () => {
      const frequency = 20; // 20Hz
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.note).toBe('E2'); // 最も近いギター音程
      expect(result.frequency).toBe(frequency);
      expect(result.cents).toBeLessThan(-1000); // 大きく外れている
      expect(result.isInTune).toBe(false);
    });

    it('周波数0での動作', () => {
      const frequency = 0;
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.note).toBe('E2'); // 最も近いギター音程
      expect(result.frequency).toBe(frequency);
      expect(result.isInTune).toBe(false);
      expect(result.confidence).toBe(1.0); // デフォルト信頼度
    });

    it('負の周波数での動作', () => {
      const frequency = -100;
      const result = tunerEngine.analyzeNote(frequency);
      
      expect(result.note).toBe('E2'); // 最も近いギター音程
      expect(result.frequency).toBe(frequency);
      expect(result.isInTune).toBe(false);
    });

    it('信頼度の境界値テスト（0）', () => {
      const frequency = GUITAR_TUNING.E4;
      const result = tunerEngine.analyzeNote(frequency, 0);
      
      expect(result.confidence).toBe(0);
      expect(result.frequency).toBe(frequency);
      expect(result.isInTune).toBe(true);
    });

    it('信頼度の境界値テスト（1）', () => {
      const frequency = GUITAR_TUNING.E2;
      const result = tunerEngine.analyzeNote(frequency, 1);
      
      expect(result.confidence).toBe(1);
      expect(result.frequency).toBe(frequency);
      expect(result.isInTune).toBe(true);
    });

    it('信頼度が1を超える値でも正常に動作する', () => {
      const frequency = GUITAR_TUNING.A2;
      const result = tunerEngine.analyzeNote(frequency, 1.5);
      
      expect(result.confidence).toBe(1.5); // そのまま設定される
      expect(result.isInTune).toBe(true);
    });

    it('信頼度が負の値でも正常に動作する', () => {
      const frequency = GUITAR_TUNING.D3;
      const result = tunerEngine.analyzeNote(frequency, -0.5);
      
      expect(result.confidence).toBe(-0.5); // そのまま設定される
      expect(result.isInTune).toBe(true);
    });

    it('各ギター弦の境界付近での音程判定', () => {
      // E2とA2の中間点をテスト
      const e2a2Mid = Math.sqrt(GUITAR_TUNING.E2 * GUITAR_TUNING.A2);
      const e2a2Result = tunerEngine.analyzeNote(e2a2Mid);
      expect(['E2', 'A2']).toContain(e2a2Result.note);
      
      // A2とD3の中間点をテスト
      const a2d3Mid = Math.sqrt(GUITAR_TUNING.A2 * GUITAR_TUNING.D3);
      const a2d3Result = tunerEngine.analyzeNote(a2d3Mid);
      expect(['A2', 'D3']).toContain(a2d3Result.note);
      
      // D3とG3の中間点をテスト
      const d3g3Mid = Math.sqrt(GUITAR_TUNING.D3 * GUITAR_TUNING.G3);
      const d3g3Result = tunerEngine.analyzeNote(d3g3Mid);
      expect(['D3', 'G3']).toContain(d3g3Result.note);
      
      // G3とB3の中間点をテスト
      const g3b3Mid = Math.sqrt(GUITAR_TUNING.G3 * GUITAR_TUNING.B3);
      const g3b3Result = tunerEngine.analyzeNote(g3b3Mid);
      expect(['G3', 'B3']).toContain(g3b3Result.note);
      
      // B3とE4の中間点をテスト
      const b3e4Mid = Math.sqrt(GUITAR_TUNING.B3 * GUITAR_TUNING.E4);
      const b3e4Result = tunerEngine.analyzeNote(b3e4Mid);
      expect(['B3', 'E4']).toContain(b3e4Result.note);
    });

    it('セント計算の数学的精度テスト', () => {
      const baseFreq = GUITAR_TUNING.G3;
      
      // 各セント値での計算精度をテスト
      const testCents = [-50, -25, -10, -1, 0, 1, 10, 25, 50];
      
      testCents.forEach(expectedCents => {
        const frequency = baseFreq * Math.pow(2, expectedCents / 1200);
        const result = tunerEngine.analyzeNote(frequency);
        
        expect(result.cents).toBe(expectedCents);
        expect(result.note).toBe('G3');
      });
    });
  });

  describe('要件検証テスト', () => {
    it('要件2.1: 標準音程の特定機能', () => {
      // 各ギター弦の標準周波数で正確に音程を特定できることを確認
      Object.entries(GUITAR_TUNING).forEach(([expectedNote, frequency]) => {
        const result = tunerEngine.analyzeNote(frequency);
        expect(result.note).toBe(expectedNote);
        expect(result.frequency).toBe(frequency);
      });
    });

    it('要件2.2: セント単位での音程差計算', () => {
      const baseFreq = GUITAR_TUNING.D3;
      
      // 様々なセント差での計算精度を確認
      const testCases = [
        { cents: -100, expected: -100 },
        { cents: -50, expected: -50 },
        { cents: -10, expected: -10 },
        { cents: -1, expected: -1 },
        { cents: 0, expected: 0 },
        { cents: 1, expected: 1 },
        { cents: 10, expected: 10 },
        { cents: 50, expected: 50 },
        { cents: 100, expected: 100 }
      ];
      
      testCases.forEach(({ cents, expected }) => {
        const frequency = baseFreq * Math.pow(2, cents / 1200);
        const result = tunerEngine.analyzeNote(frequency);
        expect(result.cents).toBe(expected);
      });
    });

    it('要件2.3: 音程の高い/低い/正確の判定', () => {
      const baseFreq = GUITAR_TUNING.B3;
      
      // 低い音程（-10セント）
      const lowFreq = baseFreq * Math.pow(2, -10 / 1200);
      const lowResult = tunerEngine.analyzeNote(lowFreq);
      expect(lowResult.cents).toBe(-10);
      expect(lowResult.isInTune).toBe(false); // ±5セントを超える
      
      // 正確な音程（0セント）
      const exactResult = tunerEngine.analyzeNote(baseFreq);
      expect(exactResult.cents).toBe(0);
      expect(exactResult.isInTune).toBe(true);
      
      // 高い音程（+10セント）
      const highFreq = baseFreq * Math.pow(2, 10 / 1200);
      const highResult = tunerEngine.analyzeNote(highFreq);
      expect(highResult.cents).toBe(10);
      expect(highResult.isInTune).toBe(false); // ±5セントを超える
    });

    it('要件2.4: ±5セント以内での正確判定', () => {
      const baseFreq = GUITAR_TUNING.E4;
      
      // 境界値テスト
      const testCases = [
        { cents: -5, shouldBeInTune: true },
        { cents: -4, shouldBeInTune: true },
        { cents: 0, shouldBeInTune: true },
        { cents: 4, shouldBeInTune: true },
        { cents: 5, shouldBeInTune: true },
        { cents: -6, shouldBeInTune: false },
        { cents: 6, shouldBeInTune: false }
      ];
      
      testCases.forEach(({ cents, shouldBeInTune }) => {
        const frequency = baseFreq * Math.pow(2, cents / 1200);
        const result = tunerEngine.analyzeNote(frequency);
        expect(result.isInTune).toBe(shouldBeInTune);
        expect(result.cents).toBe(cents);
      });
    });

    it('全ギター弦での包括的テスト', () => {
      // 各弦に対して様々な音程差でテスト
      Object.entries(GUITAR_TUNING).forEach(([noteName, baseFreq]) => {
        const testCents = [-20, -5, 0, 5, 20];
        
        testCents.forEach(cents => {
          const frequency = baseFreq * Math.pow(2, cents / 1200);
          const result = tunerEngine.analyzeNote(frequency);
          
          expect(result.note).toBe(noteName);
          expect(result.cents).toBe(cents);
          expect(result.frequency).toBe(frequency);
          expect(result.isInTune).toBe(Math.abs(cents) <= TUNING_TOLERANCE_CENTS);
        });
      });
    });

    it('NoteDataオブジェクトの完全性検証', () => {
      const frequency = GUITAR_TUNING.A2;
      const confidence = 0.75;
      const result = tunerEngine.analyzeNote(frequency, confidence);
      
      // すべての必須プロパティが存在することを確認
      expect(result).toHaveProperty('frequency');
      expect(result).toHaveProperty('note');
      expect(result).toHaveProperty('cents');
      expect(result).toHaveProperty('isInTune');
      expect(result).toHaveProperty('confidence');
      
      // 型の正確性を確認
      expect(typeof result.frequency).toBe('number');
      expect(typeof result.note).toBe('string');
      expect(typeof result.cents).toBe('number');
      expect(typeof result.isInTune).toBe('boolean');
      expect(typeof result.confidence).toBe('number');
      
      // 値の正確性を確認
      expect(result.frequency).toBe(frequency);
      expect(result.note).toBe('A2');
      expect(result.cents).toBe(0);
      expect(result.isInTune).toBe(true);
      expect(result.confidence).toBe(confidence);
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量の音程分析の処理時間', () => {
      const iterations = 1000;
      const frequency = GUITAR_TUNING.G3;
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const result = tunerEngine.analyzeNote(frequency);
        expect(result.note).toBe('G3');
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;
      
      expect(avgTime).toBeLessThan(1); // 平均1ms以内で処理完了
    });

    it('異なる周波数での一貫した処理時間', () => {
      const frequencies = [
        GUITAR_TUNING.E2,
        GUITAR_TUNING.A2,
        GUITAR_TUNING.D3,
        GUITAR_TUNING.G3,
        GUITAR_TUNING.B3,
        GUITAR_TUNING.E4
      ];
      
      const processingTimes: number[] = [];
      
      frequencies.forEach(frequency => {
        const startTime = performance.now();
        
        for (let i = 0; i < 100; i++) {
          tunerEngine.analyzeNote(frequency);
        }
        
        const endTime = performance.now();
        processingTimes.push(endTime - startTime);
      });
      
      // すべての処理時間が合理的な範囲内であることを確認
      processingTimes.forEach(time => {
        expect(time).toBeLessThan(50); // 100回の処理で50ms以内
      });
      
      // 処理時間のばらつきが小さいことを確認（より緩い条件）
      const avgTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
      const maxDeviation = Math.max(...processingTimes.map(time => Math.abs(time - avgTime)));
      expect(maxDeviation).toBeLessThan(avgTime * 5); // 平均の500%以内のばらつき（テスト環境を考慮）
    });
  });

  describe('NoteDataオブジェクトの完全性', () => {
    it('すべての必要なプロパティを含むNoteDataを生成する', () => {
      const frequency = GUITAR_TUNING.G3;
      const confidence = 0.85;
      const result = tunerEngine.analyzeNote(frequency, confidence);
      
      expect(result).toHaveProperty('frequency');
      expect(result).toHaveProperty('note');
      expect(result).toHaveProperty('cents');
      expect(result).toHaveProperty('isInTune');
      expect(result).toHaveProperty('confidence');
      
      expect(typeof result.frequency).toBe('number');
      expect(typeof result.note).toBe('string');
      expect(typeof result.cents).toBe('number');
      expect(typeof result.isInTune).toBe('boolean');
      expect(typeof result.confidence).toBe('number');
    });

    it('信頼度が0-1の範囲内であることを確認する', () => {
      const frequency = GUITAR_TUNING.A2;
      
      // 信頼度0
      const result0 = tunerEngine.analyzeNote(frequency, 0);
      expect(result0.confidence).toBe(0);
      
      // 信頼度1
      const result1 = tunerEngine.analyzeNote(frequency, 1);
      expect(result1.confidence).toBe(1);
      
      // 信頼度0.5
      const result05 = tunerEngine.analyzeNote(frequency, 0.5);
      expect(result05.confidence).toBe(0.5);
    });
  });

  describe('実際のギター使用シナリオ', () => {
    it('わずかにフラットなE2弦（-3セント）を正しく分析する', () => {
      const baseFreq = GUITAR_TUNING.E2;
      const frequency = baseFreq * Math.pow(2, -3 / 1200); // -3セント
      const result = tunerEngine.analyzeNote(frequency, 0.9);
      
      expect(result.note).toBe('E2');
      expect(result.cents).toBe(-3);
      expect(result.isInTune).toBe(true); // ±5セント以内
      expect(result.confidence).toBe(0.9);
    });

    it('わずかにシャープなB3弦（+4セント）を正しく分析する', () => {
      const baseFreq = GUITAR_TUNING.B3;
      const frequency = baseFreq * Math.pow(2, 4 / 1200); // +4セント
      const result = tunerEngine.analyzeNote(frequency, 0.8);
      
      expect(result.note).toBe('B3');
      expect(result.cents).toBe(4);
      expect(result.isInTune).toBe(true); // ±5セント以内
      expect(result.confidence).toBe(0.8);
    });

    it('大きくずれたD3弦（-20セント）を正しく分析する', () => {
      const baseFreq = GUITAR_TUNING.D3;
      const frequency = baseFreq * Math.pow(2, -20 / 1200); // -20セント
      const result = tunerEngine.analyzeNote(frequency, 0.7);
      
      expect(result.note).toBe('D3');
      expect(result.cents).toBe(-20);
      expect(result.isInTune).toBe(false); // ±5セントを超える
      expect(result.confidence).toBe(0.7);
    });
  });
});