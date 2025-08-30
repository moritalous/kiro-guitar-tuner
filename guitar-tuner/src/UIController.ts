/**
 * UIController - ユーザーインターフェースの制御を担当
 * 音程検出結果の表示、チューニング状態の視覚化、ステータスメッセージの管理を行う
 */

import type { NoteData } from './types.js';
import { AppState } from './types.js';

export class UIController {
  private noteDisplayElement: HTMLElement;
  private statusMessageElement: HTMLElement;
  private centsValueElement: HTMLElement;
  private tuningDisplayElement: HTMLElement;
  private meterNeedleElement: HTMLElement;
  private meterContainerElement: HTMLElement;
  private instructionsElement: HTMLElement;
  private toggleInstructionsButton: HTMLElement;
  private showInstructionsButton: HTMLElement;
  
  // DOM更新の最適化のためのキャッシュ
  private lastDisplayedNote: string = '';
  private lastDisplayedCents: number = NaN;
  private lastTuningState: string = '';
  private lastStatusMessage: string = '';
  private lastMeterPosition: number = NaN;

  constructor() {
    // DOM要素の取得
    this.noteDisplayElement = this.getElement('detected-note');
    this.statusMessageElement = this.getElement('status-message');
    this.centsValueElement = this.getElement('cents-value');
    this.tuningDisplayElement = this.getElement('tuning-display');
    this.meterNeedleElement = this.getElement('meter-needle');
    this.meterContainerElement = this.getElement('meter-container');
    this.instructionsElement = this.getElement('instructions');
    this.toggleInstructionsButton = this.getElement('toggle-instructions');
    this.showInstructionsButton = this.getElement('show-instructions');

    this.initializeUI();
    this.initializeInstructions();
  }

  /**
   * DOM要素を安全に取得
   */
  private getElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Element with id "${id}" not found`);
    }
    return element;
  }

  /**
   * UIの初期化
   */
  private initializeUI(): void {
    this.showStatus('マイクアクセスを許可してください');
    this.hideNoteDisplay();
  }

  /**
   * 使用方法の説明の初期化
   */
  private initializeInstructions(): void {
    // 初期状態では説明を表示
    this.showInstructions();
    
    // トグルボタンのイベントリスナーを設定
    this.toggleInstructionsButton.addEventListener('click', () => {
      this.toggleInstructions();
    });
    
    // 表示ボタンのイベントリスナーを設定
    this.showInstructionsButton.addEventListener('click', () => {
      this.showInstructions();
    });
  }

  /**
   * 検出された音程データに基づいてUIを更新
   * @param noteData 音程データ
   */
  updateDisplay(noteData: NoteData): void {
    // 待機状態のアニメーションを停止
    this.stopWaitingAnimation();
    
    // 不要なDOM更新を削減するため、変更があった場合のみ更新
    this.updateNoteDisplay(noteData.note);
    this.updateCentsDisplay(noteData.cents);
    this.updateTuningState(noteData);
    this.showNoteDisplay();
  }

  /**
   * 検出された音程名を表示
   * @param note 音程名 (例: "E2", "A2")
   */
  private updateNoteDisplay(note: string): void {
    if (this.lastDisplayedNote !== note) {
      this.noteDisplayElement.textContent = note;
      this.lastDisplayedNote = note;
    }
  }

  /**
   * セント値を表示
   * @param cents セント値
   */
  private updateCentsDisplay(cents: number): void {
    const roundedCents = Math.round(cents);
    if (this.lastDisplayedCents !== roundedCents) {
      this.centsValueElement.textContent = roundedCents.toString();
      this.lastDisplayedCents = roundedCents;
    }
  }

  /**
   * チューニング状態に基づいてUIの色とスタイルを更新
   * @param noteData 音程データ
   */
  private updateTuningState(noteData: NoteData): void {
    let tuningState: string;
    let statusMessage: string;
    
    if (noteData.isInTune) {
      tuningState = 'in-tune';
      statusMessage = '正確にチューニングされています';
    } else if (noteData.cents < 0) {
      tuningState = 'flat';
      statusMessage = '音程が低いです - 弦を締めてください';
    } else {
      tuningState = 'sharp';
      statusMessage = '音程が高いです - 弦を緩めてください';
    }

    // チューニング状態が変更された場合のみDOM更新
    if (this.lastTuningState !== tuningState) {
      // 既存のチューニング状態クラスを削除
      this.tuningDisplayElement.classList.remove('flat', 'sharp', 'in-tune');
      this.meterContainerElement.classList.remove('flat', 'sharp', 'in-tune');
      
      // 新しいチューニング状態のクラスを追加
      this.tuningDisplayElement.classList.add(tuningState);
      this.meterContainerElement.classList.add(tuningState);
      
      this.lastTuningState = tuningState;
    }

    // ステータスメッセージを更新
    this.showStatus(statusMessage);

    // メーターの針を更新
    this.updateMeter(noteData.cents);
  }

  /**
   * チューニングメーターの針の位置を更新
   * @param cents セント値 (-50 to +50)
   */
  updateMeter(cents: number): void {
    // セント値を-50から+50の範囲に制限
    const clampedCents = Math.max(-50, Math.min(50, cents));
    
    // セント値を0-100%の範囲に変換（-50セント = 0%, 0セント = 50%, +50セント = 100%）
    const percentage = ((clampedCents + 50) / 100) * 100;
    
    // 針の位置が変更された場合のみ更新（小数点以下1桁で比較）
    const roundedPercentage = Math.round(percentage * 10) / 10;
    if (this.lastMeterPosition !== roundedPercentage) {
      this.meterNeedleElement.style.left = `${percentage}%`;
      this.lastMeterPosition = roundedPercentage;
    }
    
    // 針の色を設定（色の変更が必要な場合のみ）
    let needleColor: string;
    let needleShadow: string;
    
    if (Math.abs(clampedCents) <= 5) {
      // 正確な範囲（±5セント以内）は緑色
      needleColor = 'var(--success-color)';
      needleShadow = '0 0 8px rgba(39, 174, 96, 0.6)';
    } else if (Math.abs(clampedCents) <= 15) {
      // 少しずれている範囲（±15セント以内）は黄色
      needleColor = 'var(--warning-color)';
      needleShadow = '0 0 8px rgba(243, 156, 18, 0.6)';
    } else {
      // 大きくずれている範囲は赤色
      needleColor = 'var(--danger-color)';
      needleShadow = '0 0 8px rgba(231, 76, 60, 0.6)';
    }
    
    // 色が変更された場合のみスタイルを更新
    if (this.meterNeedleElement.style.backgroundColor !== needleColor) {
      this.meterNeedleElement.style.backgroundColor = needleColor;
      this.meterNeedleElement.style.boxShadow = needleShadow;
    }
  }

  /**
   * メーターをリセット（中央位置、デフォルト色）
   */
  resetMeter(): void {
    this.meterNeedleElement.style.left = '50%';
    this.meterNeedleElement.style.backgroundColor = 'var(--text-color)';
    this.meterNeedleElement.style.boxShadow = 'none';
    
    // キャッシュもリセット
    this.lastMeterPosition = 50;
  }

  /**
   * ステータスメッセージを表示
   * @param message 表示するメッセージ
   */
  showStatus(message: string): void {
    if (this.lastStatusMessage !== message) {
      this.statusMessageElement.textContent = message;
      this.lastStatusMessage = message;
    }
  }

  /**
   * アプリケーション状態に基づいてステータスメッセージを更新
   * @param state アプリケーション状態
   */
  updateAppState(state: AppState): void {
    switch (state) {
      case 'idle':
        this.showStatus('開始ボタンを押してください');
        this.hideNoteDisplay();
        break;
      case 'requesting-mic':
        this.showStatus('マイクアクセスを許可してください');
        this.hideNoteDisplay();
        break;
      case 'ready':
        this.showStatus('準備完了 - ギターを弾いてください');
        this.showNoteDisplay();
        break;
      case 'listening':
        this.showStatus('音を検出中...');
        this.showNoteDisplay();
        break;
      case 'error':
        this.hideNoteDisplay();
        break;
    }
  }

  /**
   * エラーメッセージを表示
   * @param errorMessage エラーメッセージ
   * @param helpMessage ヘルプメッセージ（オプション）
   */
  showError(errorMessage: string, helpMessage?: string): void {
    let fullMessage = `エラー: ${errorMessage}`;
    
    if (helpMessage) {
      fullMessage += `\n\n💡 ${helpMessage}`;
    }
    
    this.showStatus(fullMessage);
    this.hideNoteDisplay();
    
    // エラー状態のスタイルを適用
    this.statusMessageElement.classList.add('error-message');
    
    // 一定時間後にエラースタイルを削除
    setTimeout(() => {
      this.statusMessageElement.classList.remove('error-message');
    }, 10000);
  }

  /**
   * 音量不足の警告を表示
   */
  showLowVolumeWarning(): void {
    this.showStatus('音が小さすぎます - もう少し大きな音で弾いてください');
  }

  /**
   * 音程表示エリアを表示
   */
  private showNoteDisplay(): void {
    this.tuningDisplayElement.style.display = 'block';
  }

  /**
   * 音程表示エリアを非表示
   */
  private hideNoteDisplay(): void {
    this.tuningDisplayElement.style.display = 'none';
  }

  /**
   * チューニング完了時の視覚的フィードバック
   * @param note チューニングされた音程
   */
  showTuningComplete(note: string): void {
    this.showStatus(`🎯 ${note} - チューニング完了！`);
    
    // 強化された視覚的フィードバック
    this.tuningDisplayElement.classList.add('tuning-complete-celebration');
    
    // 音程表示の特別なスタイル
    this.noteDisplayElement.style.transform = 'scale(1.2)';
    this.noteDisplayElement.style.transition = 'transform 0.5s ease';
    
    // 2秒後にアニメーションを削除
    setTimeout(() => {
      this.tuningDisplayElement.classList.remove('tuning-complete-celebration');
      this.noteDisplayElement.style.transform = '';
      this.noteDisplayElement.style.transition = '';
    }, 2000);
    
    // 成功音の代わりに視覚的な効果を追加
    this.createSuccessParticles();
  }

  /**
   * 成功時のパーティクル効果を作成
   */
  private createSuccessParticles(): void {
    const particles = document.createElement('div');
    particles.className = 'success-particles';
    particles.innerHTML = '🎵 ✨ 🎶 ✨ 🎵';
    particles.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 2rem;
      pointer-events: none;
      animation: particleFloat 2s ease-out forwards;
      z-index: 1000;
    `;
    
    // パーティクルアニメーションのCSSを動的に追加
    if (!document.querySelector('#particle-animation-style')) {
      const style = document.createElement('style');
      style.id = 'particle-animation-style';
      style.textContent = `
        @keyframes particleFloat {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(0.5);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -70%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -90%) scale(1.2);
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    this.tuningDisplayElement.style.position = 'relative';
    this.tuningDisplayElement.appendChild(particles);
    
    // 2秒後にパーティクルを削除
    setTimeout(() => {
      if (particles.parentNode) {
        particles.parentNode.removeChild(particles);
      }
    }, 2000);
  }

  /**
   * 待機状態の表示
   */
  showWaitingState(): void {
    this.showStatus('🎸 音程を検出中... ギターを弾いてください');
    
    // 待機状態のアニメーションクラスを追加
    this.tuningDisplayElement.classList.add('waiting-state');
    
    // 不要なDOM更新を避けるため、変更が必要な場合のみ更新
    if (this.lastDisplayedNote !== '--') {
      this.noteDisplayElement.textContent = '--';
      this.lastDisplayedNote = '--';
    }
    
    if (this.lastDisplayedCents !== 0) {
      this.centsValueElement.textContent = '0';
      this.lastDisplayedCents = 0;
    }
    
    // チューニング状態クラスをリセット（変更があった場合のみ）
    if (this.lastTuningState !== '') {
      this.tuningDisplayElement.classList.remove('flat', 'sharp', 'in-tune');
      this.meterContainerElement.classList.remove('flat', 'sharp', 'in-tune');
      this.lastTuningState = '';
    }
    
    // メーターをリセット
    this.resetMeter();
  }

  /**
   * 待機状態のアニメーションを停止
   */
  private stopWaitingAnimation(): void {
    this.tuningDisplayElement.classList.remove('waiting-state');
  }

  /**
   * 信頼度が低い場合の表示
   */
  showLowConfidenceWarning(): void {
    this.showStatus('音程の検出が不安定です - クリアに弾いてください');
  }

  /**
   * 使用方法の説明を表示
   */
  showInstructions(): void {
    this.instructionsElement.classList.remove('hidden');
    this.toggleInstructionsButton.textContent = '説明を隠す';
    this.showInstructionsButton.classList.add('hidden');
  }

  /**
   * 使用方法の説明を非表示
   */
  hideInstructions(): void {
    this.instructionsElement.classList.add('hidden');
    this.toggleInstructionsButton.textContent = '使用方法を表示';
    this.showInstructionsButton.classList.remove('hidden');
  }

  /**
   * 使用方法の説明の表示/非表示を切り替え
   */
  toggleInstructions(): void {
    if (this.instructionsElement.classList.contains('hidden')) {
      this.showInstructions();
    } else {
      this.hideInstructions();
    }
  }
}