/**
 * UIController のデモンストレーション
 * 実際の使用例を示すためのサンプルコード
 */

import { UIController } from './UIController.js';
import type { NoteData } from './types.js';

// UIControllerの使用例
export function demonstrateUIController() {
  const uiController = new UIController();

  // 1. アプリケーション開始時
  uiController.updateAppState('idle');

  // 2. マイクアクセス要求時
  uiController.updateAppState('requesting-mic');

  // 3. 準備完了時
  uiController.updateAppState('ready');

  // 4. 音程検出結果の表示例
  
  // E2弦が正確にチューニングされている場合
  const accurateNote: NoteData = {
    frequency: 82.41,
    note: 'E2',
    cents: 2,
    isInTune: true,
    confidence: 0.9
  };
  uiController.updateDisplay(accurateNote);

  // A2弦が低い場合
  setTimeout(() => {
    const flatNote: NoteData = {
      frequency: 108.0,
      note: 'A2',
      cents: -18,
      isInTune: false,
      confidence: 0.8
    };
    uiController.updateDisplay(flatNote);
  }, 2000);

  // D3弦が高い場合
  setTimeout(() => {
    const sharpNote: NoteData = {
      frequency: 150.0,
      note: 'D3',
      cents: 22,
      isInTune: false,
      confidence: 0.7
    };
    uiController.updateDisplay(sharpNote);
  }, 4000);

  // チューニング完了の表示
  setTimeout(() => {
    const perfectNote: NoteData = {
      frequency: 196.00,
      note: 'G3',
      cents: 0,
      isInTune: true,
      confidence: 0.95
    };
    uiController.updateDisplay(perfectNote);
    uiController.showTuningComplete('G3');
  }, 6000);

  // エラー状態の表示例
  setTimeout(() => {
    uiController.showError('マイクアクセスが拒否されました');
  }, 8000);

  // 音量不足の警告例
  setTimeout(() => {
    uiController.showLowVolumeWarning();
  }, 10000);

  // 待機状態に戻る
  setTimeout(() => {
    uiController.showWaitingState();
  }, 12000);
}

// 実際のアプリケーションでの統合例
export class TunerApp {
  private uiController: UIController;

  constructor() {
    this.uiController = new UIController();
  }

  /**
   * アプリケーションの初期化
   */
  async initialize(): Promise<void> {
    try {
      this.uiController.updateAppState('requesting-mic');
      
      // マイクアクセスの取得（実際のAudioManagerを使用）
      // await this.audioManager.initialize();
      
      this.uiController.updateAppState('ready');
      this.startListening();
    } catch (error) {
      this.uiController.showError('マイクアクセスに失敗しました');
    }
  }

  /**
   * 音声検出の開始
   */
  private startListening(): void {
    this.uiController.updateAppState('listening');
    
    // 実際の音程検出ループ（例）
    // setInterval(() => {
    //   const audioData = this.audioManager.getAudioData();
    //   const frequency = this.pitchDetector.detectPitch(audioData);
    //   
    //   if (frequency) {
    //     const noteData = this.tunerEngine.analyzeNote(frequency);
    //     this.uiController.updateDisplay(noteData);
    //     
    //     if (noteData.isInTune) {
    //       this.uiController.showTuningComplete(noteData.note);
    //     }
    //   } else {
    //     this.uiController.showWaitingState();
    //   }
    // }, 100);
  }


}