/**
 * UIController のテスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UIController } from './UIController.js';
import { NoteData, AppState } from './types.js';

describe('UIController', () => {
  let uiController: UIController;

  beforeEach(() => {
    // DOM要素を作成
    document.body.innerHTML = `
      <div id="detected-note">--</div>
      <div id="status-message">初期メッセージ</div>
      <div id="cents-value">0</div>
      <div id="tuning-display" style="display: block;"></div>
      <div id="meter-needle"></div>
      <div id="meter-container"></div>
      <div id="instructions" class="hidden">
        <button id="toggle-instructions">説明を隠す</button>
      </div>
      <button id="show-instructions" class="hidden">使用方法</button>
    `;

    uiController = new UIController();
  });

  describe('初期化', () => {
    it('必要なDOM要素が正しく取得される', () => {
      expect(document.getElementById('detected-note')).toBeTruthy();
      expect(document.getElementById('status-message')).toBeTruthy();
      expect(document.getElementById('cents-value')).toBeTruthy();
      expect(document.getElementById('tuning-display')).toBeTruthy();
      expect(document.getElementById('meter-needle')).toBeTruthy();
      expect(document.getElementById('meter-container')).toBeTruthy();
    });

    it('初期状態のメッセージが設定される', () => {
      const statusElement = document.getElementById('status-message');
      expect(statusElement?.textContent).toBe('マイクアクセスを許可してください');
    });

    it('音程表示が非表示になる', () => {
      const tuningDisplay = document.getElementById('tuning-display') as HTMLElement;
      expect(tuningDisplay.style.display).toBe('none');
    });
  });

  describe('updateDisplay', () => {
    it('正確にチューニングされた音程データを正しく表示する', () => {
      const noteData: NoteData = {
        frequency: 82.41,
        note: 'E2',
        cents: 2,
        isInTune: true,
        confidence: 0.9
      };

      uiController.updateDisplay(noteData);

      const noteElement = document.getElementById('detected-note');
      const centsElement = document.getElementById('cents-value');
      const statusElement = document.getElementById('status-message');
      const tuningDisplay = document.getElementById('tuning-display') as HTMLElement;

      expect(noteElement?.textContent).toBe('E2');
      expect(centsElement?.textContent).toBe('2');
      expect(statusElement?.textContent).toBe('正確にチューニングされています');
      expect(tuningDisplay.style.display).toBe('block');
      expect(tuningDisplay.classList.contains('in-tune')).toBe(true);
    });

    it('音程が低い場合の表示を正しく行う', () => {
      const noteData: NoteData = {
        frequency: 80.0,
        note: 'E2',
        cents: -15,
        isInTune: false,
        confidence: 0.8
      };

      uiController.updateDisplay(noteData);

      const noteElement = document.getElementById('detected-note');
      const centsElement = document.getElementById('cents-value');
      const statusElement = document.getElementById('status-message');
      const tuningDisplay = document.getElementById('tuning-display') as HTMLElement;

      expect(noteElement?.textContent).toBe('E2');
      expect(centsElement?.textContent).toBe('-15');
      expect(statusElement?.textContent).toBe('音程が低いです - 弦を締めてください');
      expect(tuningDisplay.classList.contains('flat')).toBe(true);
    });

    it('音程が高い場合の表示を正しく行う', () => {
      const noteData: NoteData = {
        frequency: 85.0,
        note: 'E2',
        cents: 20,
        isInTune: false,
        confidence: 0.7
      };

      uiController.updateDisplay(noteData);

      const noteElement = document.getElementById('detected-note');
      const centsElement = document.getElementById('cents-value');
      const statusElement = document.getElementById('status-message');
      const tuningDisplay = document.getElementById('tuning-display') as HTMLElement;

      expect(noteElement?.textContent).toBe('E2');
      expect(centsElement?.textContent).toBe('20');
      expect(statusElement?.textContent).toBe('音程が高いです - 弦を緩めてください');
      expect(tuningDisplay.classList.contains('sharp')).toBe(true);
    });
  });

  describe('showStatus', () => {
    it('ステータスメッセージを正しく表示する', () => {
      const message = 'テストメッセージ';
      uiController.showStatus(message);
      const statusElement = document.getElementById('status-message');
      expect(statusElement?.textContent).toBe(message);
    });
  });

  describe('updateAppState', () => {
    it('idle状態を正しく表示する', () => {
      uiController.updateAppState('idle');
      const statusElement = document.getElementById('status-message');
      const tuningDisplay = document.getElementById('tuning-display') as HTMLElement;
      expect(statusElement?.textContent).toBe('開始ボタンを押してください');
      expect(tuningDisplay.style.display).toBe('none');
    });

    it('requesting-mic状態を正しく表示する', () => {
      uiController.updateAppState('requesting-mic');
      const statusElement = document.getElementById('status-message');
      const tuningDisplay = document.getElementById('tuning-display') as HTMLElement;
      expect(statusElement?.textContent).toBe('マイクアクセスを許可してください');
      expect(tuningDisplay.style.display).toBe('none');
    });

    it('ready状態を正しく表示する', () => {
      uiController.updateAppState('ready');
      const statusElement = document.getElementById('status-message');
      const tuningDisplay = document.getElementById('tuning-display') as HTMLElement;
      expect(statusElement?.textContent).toBe('準備完了 - ギターを弾いてください');
      expect(tuningDisplay.style.display).toBe('block');
    });

    it('listening状態を正しく表示する', () => {
      uiController.updateAppState('listening');
      const statusElement = document.getElementById('status-message');
      const tuningDisplay = document.getElementById('tuning-display') as HTMLElement;
      expect(statusElement?.textContent).toBe('音を検出中...');
      expect(tuningDisplay.style.display).toBe('block');
    });

    it('error状態を正しく表示する', () => {
      uiController.updateAppState('error');
      const tuningDisplay = document.getElementById('tuning-display') as HTMLElement;
      expect(tuningDisplay.style.display).toBe('none');
    });
  });

  describe('showError', () => {
    it('エラーメッセージを正しく表示する', () => {
      const errorMessage = 'マイクアクセスが拒否されました';
      uiController.showError(errorMessage);
      const statusElement = document.getElementById('status-message');
      const tuningDisplay = document.getElementById('tuning-display') as HTMLElement;
      expect(statusElement?.textContent).toBe(`エラー: ${errorMessage}`);
      expect(tuningDisplay.style.display).toBe('none');
    });
  });

  describe('showLowVolumeWarning', () => {
    it('音量不足の警告を正しく表示する', () => {
      uiController.showLowVolumeWarning();
      const statusElement = document.getElementById('status-message');
      expect(statusElement?.textContent).toBe('音が小さすぎます - もう少し大きな音で弾いてください');
    });
  });

  describe('showTuningComplete', () => {
    it('チューニング完了メッセージを正しく表示する', () => {
      const note = 'E2';
      uiController.showTuningComplete(note);
      const statusElement = document.getElementById('status-message');
      const tuningDisplay = document.getElementById('tuning-display') as HTMLElement;
      expect(statusElement?.textContent).toBe(`🎯 ${note} - チューニング完了！`);
      expect(tuningDisplay.classList.contains('tuning-complete-celebration')).toBe(true);
    });
  });

  describe('showWaitingState', () => {
    it('待機状態を正しく表示する', () => {
      uiController.showWaitingState();
      const statusElement = document.getElementById('status-message');
      const noteElement = document.getElementById('detected-note');
      const centsElement = document.getElementById('cents-value');
      expect(statusElement?.textContent).toBe('🎸 音程を検出中... ギターを弾いてください');
      expect(noteElement?.textContent).toBe('--');
      expect(centsElement?.textContent).toBe('0');
    });
  });

  describe('showLowConfidenceWarning', () => {
    it('信頼度が低い場合の警告を正しく表示する', () => {
      uiController.showLowConfidenceWarning();
      const statusElement = document.getElementById('status-message');
      expect(statusElement?.textContent).toBe('音程の検出が不安定です - クリアに弾いてください');
    });
  });

  describe('updateMeter', () => {
    it('正確な音程（±5セント以内）で緑色の針を表示する', () => {
      uiController.updateMeter(3);
      const needleElement = document.getElementById('meter-needle') as HTMLElement;
      
      // 3セントは53%の位置に相当 ((3 + 50) / 100 * 100 = 53%)
      expect(needleElement.style.left).toBe('53%');
      expect(needleElement.style.backgroundColor).toBe('var(--success-color)');
    });

    it('少しずれた音程（±15セント以内）で黄色の針を表示する', () => {
      uiController.updateMeter(-10);
      const needleElement = document.getElementById('meter-needle') as HTMLElement;
      
      // -10セントは40%の位置に相当 ((-10 + 50) / 100 * 100 = 40%)
      expect(needleElement.style.left).toBe('40%');
      expect(needleElement.style.backgroundColor).toBe('var(--warning-color)');
    });

    it('大きくずれた音程で赤色の針を表示する', () => {
      uiController.updateMeter(25);
      const needleElement = document.getElementById('meter-needle') as HTMLElement;
      
      // 25セントは75%の位置に相当 ((25 + 50) / 100 * 100 = 75%)
      expect(needleElement.style.left).toBe('75%');
      expect(needleElement.style.backgroundColor).toBe('var(--danger-color)');
    });

    it('範囲外の値を適切に制限する', () => {
      uiController.updateMeter(100); // 50セントを超える値
      const needleElement = document.getElementById('meter-needle') as HTMLElement;
      
      // 100%の位置（50セントに制限される）
      expect(needleElement.style.left).toBe('100%');
      
      uiController.updateMeter(-100); // -50セントを下回る値
      
      // 0%の位置（-50セントに制限される）
      expect(needleElement.style.left).toBe('0%');
    });
  });

  describe('resetMeter', () => {
    it('メーターを中央位置にリセットする', () => {
      // まず針を移動
      uiController.updateMeter(20);
      
      // リセット
      uiController.resetMeter();
      
      const needleElement = document.getElementById('meter-needle') as HTMLElement;
      expect(needleElement.style.left).toBe('50%');
      expect(needleElement.style.backgroundColor).toBe('var(--text-color)');
      expect(needleElement.style.boxShadow).toBe('none');
    });
  });
});