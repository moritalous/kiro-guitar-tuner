import './style.css'
import type { NoteData } from './types'
import { AppState, ErrorType, MAX_UPDATE_FPS } from './types'
import { AudioManager } from './AudioManager.js'
import { PitchDetector } from './PitchDetector.js'
import { TunerEngine } from './TunerEngine.js'
import { UIController } from './UIController.js'
import { ThemeManager } from './ThemeManager.js'

/**
 * ギターチューナーアプリケーションのメインエントリーポイント
 */
class GuitarTunerApp {
  private currentState: AppState = AppState.IDLE;
  private audioManager: AudioManager;
  private pitchDetector: PitchDetector | null = null;
  private tunerEngine: TunerEngine;
  private uiController: UIController;
  private themeManager: ThemeManager;
  private processingLoopId: number | null = null;
  private lastUpdateTime: number = 0;
  private readonly updateInterval: number = 1000 / MAX_UPDATE_FPS; // 60FPS制限
  private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListener }> = [];
  
  // パフォーマンス最適化のための状態追跡
  private lastStableNote: string = '';
  private stableNoteCount: number = 0;
  private readonly stableNoteThreshold: number = 10; // 安定判定のための連続回数
  private audioProcessingErrorCount: number = 0; // 音声処理エラーのカウンター

  constructor() {
    this.audioManager = new AudioManager();
    this.tunerEngine = new TunerEngine();
    this.uiController = new UIController();
    this.themeManager = new ThemeManager();
    
    // UIControllerとThemeManagerを連携
    this.uiController.setThemeManager(this.themeManager);
    
    this.initializeApp();
    this.initializeResponsiveHandlers();
    this.initializeVisibilityHandling();
  }

  private initializeApp(): void {
    console.log('ギターチューナーアプリケーションを初期化中...');
    
    // DOM要素の取得
    const startButton = document.querySelector<HTMLButtonElement>('#start-button');
    const stopButton = document.querySelector<HTMLButtonElement>('#stop-button');
    const statusMessage = document.querySelector<HTMLElement>('#status-message');

    if (!startButton || !stopButton || !statusMessage) {
      console.error('必要なDOM要素が見つかりません');
      return;
    }

    // テーマシステムの初期化処理
    this.initializeThemeSystem();

    // イベントリスナーの設定
    const startHandler = () => this.handleStart();
    const stopHandler = () => this.handleStop();
    
    startButton.addEventListener('click', startHandler);
    stopButton.addEventListener('click', stopHandler);
    
    // イベントリスナーを追跡（クリーンアップ用）
    this.eventListeners.push(
      { element: startButton, event: 'click', handler: startHandler },
      { element: stopButton, event: 'click', handler: stopHandler }
    );

    // 初期状態の設定
    this.updateUI();
  }

  private async handleStart(): Promise<void> {
    console.log('チューナー開始');
    this.currentState = AppState.REQUESTING_MIC;
    this.updateUI();
    
    try {
      // AudioManagerを初期化
      await this.audioManager.initialize();
      
      // PitchDetectorを初期化（サンプリングレートが確定してから）
      this.pitchDetector = new PitchDetector(this.audioManager.sampleRate);
      
      // 録音を開始
      this.audioManager.startRecording();
      
      this.currentState = AppState.READY;
      this.updateUI();
      
      // 使用方法の説明を自動的に隠す（チューニング開始時）
      this.uiController.hideInstructions();
      
      // リアルタイム音声処理パイプラインを開始
      this.startAudioProcessingPipeline();
      
    } catch (error) {
      console.error('AudioManager初期化エラー:', error);
      this.handleError(error as Error);
    }
  }

  private async handleStop(): Promise<void> {
    console.log('チューナー停止');
    
    // 音声処理ループを停止
    this.stopAudioProcessingPipeline();
    
    // 録音を停止
    this.audioManager.stopRecording();
    
    // AudioManagerをクリーンアップ
    await this.audioManager.cleanup();
    
    // PitchDetectorをクリア
    this.pitchDetector = null;
    
    this.currentState = AppState.IDLE;
    this.updateUI();
  }

  private updateUI(): void {
    const startButton = document.querySelector<HTMLButtonElement>('#start-button');
    const stopButton = document.querySelector<HTMLButtonElement>('#stop-button');

    if (!startButton || !stopButton) return;

    // ボタンの状態を更新
    switch (this.currentState) {
      case AppState.IDLE:
        startButton.disabled = false;
        stopButton.disabled = true;
        break;
      
      case AppState.REQUESTING_MIC:
        startButton.disabled = true;
        stopButton.disabled = false;
        break;
      
      case AppState.READY:
      case AppState.LISTENING:
        startButton.disabled = true;
        stopButton.disabled = false;
        break;
      
      case AppState.ERROR:
        startButton.disabled = false;
        stopButton.disabled = true;
        break;
    }

    // UIControllerに状態を通知
    this.uiController.updateAppState(this.currentState);
  }

  /**
   * テーマシステムの初期化処理
   * 保存されたテーマ設定の復元とシステムテーマ変更の監視を設定
   */
  private initializeThemeSystem(): void {
    try {
      console.log('テーマシステムを初期化中...');
      
      // ThemeManagerの初期化（システムテーマ検出と保存設定復元）
      this.themeManager.initialize();
      
      // テーマ切り替えボタンのイベントリスナー設定
      this.themeManager.setupThemeToggleButton();
      
      // システムテーマ変更のリアルタイム監視を開始
      this.setupSystemThemeMonitoring();
      
      console.log('テーマシステムの初期化が完了しました');
      
    } catch (error) {
      console.warn('テーマシステムの初期化に失敗しました:', error);
      // テーマシステムの失敗はアプリケーション全体の動作を妨げないため、
      // エラーログのみ出力してアプリケーションの初期化を継続
    }
  }

  /**
   * システムテーマ変更のリアルタイム監視を設定
   * prefers-color-scheme の変更を検出してテーマを自動更新
   */
  private setupSystemThemeMonitoring(): void {
    if (typeof window === 'undefined' || !window.matchMedia) {
      console.warn('matchMedia APIが利用できません。システムテーマの自動切り替えは無効です。');
      return;
    }

    try {
      // システムテーマ変更の監視
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const systemThemeChangeHandler = (event: MediaQueryListEvent) => {
        console.log('システムテーマが変更されました:', event.matches ? 'dark' : 'light');
        
        // ThemeManagerのシステムテーマ変更処理は内部で自動的に処理されるため、
        // ここでは追加のログ出力のみ行う
        const currentSettings = this.themeManager.getThemeSettings();
        
        if (currentSettings.preference === 'system') {
          console.log('ユーザー設定が"system"のため、テーマを自動更新しました');
        } else {
          console.log('ユーザー設定が手動のため、テーマは変更されませんでした');
        }
      };
      
      // モダンブラウザ用
      if (darkModeQuery.addEventListener) {
        darkModeQuery.addEventListener('change', systemThemeChangeHandler);
      }
      // 古いブラウザ用フォールバック
      else if (darkModeQuery.addListener) {
        darkModeQuery.addListener(systemThemeChangeHandler);
      }
      
      // イベントリスナーを追跡（クリーンアップ用）
      this.eventListeners.push({
        element: darkModeQuery as any,
        event: 'change',
        handler: systemThemeChangeHandler as EventListener
      });
      
    } catch (error) {
      console.warn('システムテーマ監視の設定に失敗しました:', error);
    }
  }

  /**
   * エラーハンドリング
   */
  private handleError(error: Error): void {
    this.currentState = AppState.ERROR;
    
    // 音声処理ループを停止
    this.stopAudioProcessingPipeline();

    // エラータイプに応じた詳細なメッセージを表示
    let errorMessage: string;
    let helpMessage: string = '';
    
    switch (error.message) {
      case ErrorType.MIC_ACCESS_DENIED:
        errorMessage = 'マイクアクセスが拒否されました';
        helpMessage = 'ブラウザのアドレスバーのマイクアイコンをクリックして許可してください。または、ブラウザの設定でマイクアクセスを許可してください。';
        break;
        
      case ErrorType.MIC_NOT_AVAILABLE:
        errorMessage = 'マイクが利用できません';
        helpMessage = 'マイクが正しく接続されているか確認してください。他のアプリケーションがマイクを使用していないか確認してください。';
        break;
        
      case ErrorType.BROWSER_NOT_SUPPORTED:
        errorMessage = 'お使いのブラウザはサポートされていません';
        helpMessage = 'Chrome、Firefox、Safari、Microsoft Edgeの最新版をご利用ください。Internet Explorerはサポートされていません。';
        break;
        
      case ErrorType.AUDIO_CONTEXT_ERROR:
        errorMessage = '音声処理の初期化に失敗しました';
        helpMessage = 'ページを再読み込みしてもう一度お試しください。問題が続く場合は、ブラウザを再起動してください。';
        break;
        
      case ErrorType.LOW_VOLUME:
        errorMessage = '音量が小さすぎます';
        helpMessage = 'ギターをもう少し大きな音で弾いてください。マイクに近づけて演奏してみてください。';
        break;
        
      case ErrorType.AUDIO_PROCESSING_ERROR:
        errorMessage = '音声処理中にエラーが発生しました';
        helpMessage = 'ページを再読み込みしてもう一度お試しください。';
        break;
        
      case ErrorType.INITIALIZATION_ERROR:
        errorMessage = 'アプリケーションの初期化に失敗しました';
        helpMessage = 'ページを再読み込みしてください。問題が続く場合は、ブラウザのキャッシュをクリアしてください。';
        break;
        
      default:
        errorMessage = '予期しないエラーが発生しました';
        helpMessage = 'ページを再読み込みしてもう一度お試しください。問題が続く場合は、ブラウザを再起動してください。';
        break;
    }
    
    // エラーメッセージとヘルプメッセージを表示
    this.uiController.showError(errorMessage, helpMessage);
    this.updateUI();
    
    // エラーログを出力（デバッグ用）
    console.error(`Guitar Tuner Error [${error.message}]:`, error);
  }

  /**
   * リアルタイム音声処理パイプラインを開始
   * AudioManager → PitchDetector → TunerEngine → UIController の連携
   */
  private startAudioProcessingPipeline(): void {
    if (this.processingLoopId !== null) {
      return; // 既に実行中の場合は何もしない
    }

    const processAudio = (currentTime: number) => {
      // 停止された場合は処理を終了
      if (this.currentState !== AppState.READY && this.currentState !== AppState.LISTENING) {
        this.processingLoopId = null;
        return;
      }

      // 60FPS制限の実装
      if (currentTime - this.lastUpdateTime < this.updateInterval) {
        this.processingLoopId = requestAnimationFrame(processAudio);
        return;
      }

      this.lastUpdateTime = currentTime;

      try {
        // 1. AudioManagerから音声データを取得
        const audioData = this.audioManager.getAudioData();
        
        if (audioData.length === 0) {
          // 音声データがない場合は待機状態を表示
          if (this.currentState === AppState.LISTENING) {
            this.currentState = AppState.READY;
            this.updateUI();
            this.uiController.showWaitingState();
          }
        } else {
          // 音声が検出された場合
          if (this.currentState === AppState.READY) {
            this.currentState = AppState.LISTENING;
            this.updateUI();
          }

          // 音量チェック
          const rms = this.calculateRMS(audioData);
          if (rms < 0.005) { // 音量が小さすぎる場合
            this.uiController.showLowVolumeWarning();
            // 音量不足の場合は待機状態に戻す
            if (this.currentState === AppState.LISTENING) {
              this.currentState = AppState.READY;
              this.updateUI();
            }
          } else {
            // 2. PitchDetectorで音程を検出
            if (this.pitchDetector) {
              const pitchResult = this.pitchDetector.detectPitchWithConfidence(audioData);
              
              if (pitchResult) {
                const { frequency, confidence } = pitchResult;
                
                // 信頼度が低い場合は警告を表示
                if (confidence < 0.4) {
                  this.uiController.showLowConfidenceWarning();
                } else {
                  // 3. TunerEngineで音程を分析
                  const noteData = this.tunerEngine.analyzeNote(frequency, confidence);
                  
                  // パフォーマンス最適化: 安定した音程の場合は更新頻度を下げる
                  const shouldUpdate = this.shouldUpdateUI(noteData);
                  
                  if (shouldUpdate) {
                    // 4. UIControllerで結果を表示
                    this.uiController.updateDisplay(noteData);
                    
                    // チューニング完了時の特別な処理
                    if (noteData.isInTune && confidence > 0.7 && this.stableNoteCount > this.stableNoteThreshold) {
                      // 連続して正確な状態が続いた場合のみ完了表示
                      this.uiController.showTuningComplete(noteData.note);
                    }
                    
                    // 正常に処理できた場合はエラーカウンターをリセット
                    this.audioProcessingErrorCount = 0;
                  }
                }
              } else {
                // 音程が検出できない場合
                this.uiController.showWaitingState();
                // 音程検出はできなかったが、音声処理自体は正常なのでエラーカウンターをリセット
                this.audioProcessingErrorCount = 0;
              }
            }
          }
        }
      } catch (error) {
        console.error('音声処理エラー:', error);
        
        // 重大なエラーの場合は処理を停止
        if (error instanceof Error) {
          if (error.message.includes('AudioContext') || 
              error.message.includes('MediaStream') ||
              error.message.includes('getUserMedia')) {
            this.handleError(new Error(ErrorType.AUDIO_PROCESSING_ERROR));
            return;
          }
        }
        
        // 軽微なエラーの場合は処理を継続（ログのみ出力）
        // 連続してエラーが発生する場合のカウンター
        this.audioProcessingErrorCount = (this.audioProcessingErrorCount || 0) + 1;
        
        if (this.audioProcessingErrorCount > 10) {
          // 連続して10回エラーが発生した場合は停止
          this.handleError(new Error(ErrorType.AUDIO_PROCESSING_ERROR));
          return;
        }
      }

      // 次のフレームで再実行
      this.processingLoopId = requestAnimationFrame(processAudio);
    };

    // 音声処理パイプラインを開始
    this.processingLoopId = requestAnimationFrame(processAudio);
  }

  /**
   * 音声処理パイプラインを停止
   */
  private stopAudioProcessingPipeline(): void {
    if (this.processingLoopId !== null) {
      cancelAnimationFrame(this.processingLoopId);
      this.processingLoopId = null;
    }
    
    // パフォーマンス最適化の状態をリセット
    this.lastStableNote = '';
    this.stableNoteCount = 0;
    this.audioProcessingErrorCount = 0;
  }

  /**
   * UI更新が必要かどうかを判定（パフォーマンス最適化）
   * @param noteData 現在の音程データ
   * @returns UI更新が必要かどうか
   */
  private shouldUpdateUI(noteData: NoteData): boolean {
    const currentNote = `${noteData.note}_${Math.round(noteData.cents / 2) * 2}`; // 2セント単位で丸める
    
    if (this.lastStableNote === currentNote) {
      this.stableNoteCount++;
      
      // 安定した音程の場合は更新頻度を下げる（5回に1回更新）
      if (this.stableNoteCount > this.stableNoteThreshold) {
        return this.stableNoteCount % 5 === 0;
      }
    } else {
      this.lastStableNote = currentNote;
      this.stableNoteCount = 1;
    }
    
    return true; // 音程が変化している場合は常に更新
  }

  /**
   * RMS（Root Mean Square）を計算
   */
  private calculateRMS(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * レスポンシブデザインとデスクトップ最適化のためのイベントハンドラーを初期化
   */
  private initializeResponsiveHandlers(): void {
    // ウィンドウリサイズハンドラー
    let resizeTimeout: number;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        this.handleWindowResize();
      }, 150); // デバウンス処理
    };

    window.addEventListener('resize', handleResize);
    this.eventListeners.push({ element: window, event: 'resize', handler: handleResize });

    // 画面向き変更ハンドラー
    const orientationHandler = () => {
      // 向き変更後の処理を少し遅延させる
      setTimeout(() => {
        this.handleOrientationChange();
      }, 100);
    };
    
    window.addEventListener('orientationchange', orientationHandler);
    this.eventListeners.push({ element: window, event: 'orientationchange', handler: orientationHandler });

    // 初期レイアウト調整
    this.handleWindowResize();

    // デスクトップ向けキーボードショートカット
    if (this.isDesktop()) {
      this.initializeKeyboardShortcuts();
    }

    // タッチデバイス検出とUI調整
    this.detectTouchCapability();
  }

  /**
   * Page Visibility API による非アクティブ時の処理停止を初期化
   */
  private initializeVisibilityHandling(): void {
    // Page Visibility API のサポートチェック
    if (typeof document.hidden !== 'undefined') {
      const visibilityHandler = () => this.handleVisibilityChange();
      document.addEventListener('visibilitychange', visibilityHandler);
      this.eventListeners.push({ element: document, event: 'visibilitychange', handler: visibilityHandler });
    }

    // ウィンドウのフォーカス/ブラー イベントもハンドリング（フォールバック）
    const focusHandler = () => this.handleWindowFocus();
    const blurHandler = () => this.handleWindowBlur();
    
    window.addEventListener('focus', focusHandler);
    window.addEventListener('blur', blurHandler);
    
    this.eventListeners.push(
      { element: window, event: 'focus', handler: focusHandler },
      { element: window, event: 'blur', handler: blurHandler }
    );
  }

  /**
   * ページの可視性変更時の処理
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      // ページが非表示になった場合
      this.handlePageHidden();
    } else {
      // ページが表示された場合
      this.handlePageVisible();
    }
  }

  /**
   * ページが非表示になった時の処理
   */
  private handlePageHidden(): void {
    console.log('ページが非表示になりました - 音声処理を一時停止');
    
    // 音声処理を一時停止（メモリとCPU使用量を削減）
    if (this.currentState === AppState.LISTENING || this.currentState === AppState.READY) {
      this.stopAudioProcessingPipeline();
      this.audioManager.stopRecording();
    }
  }

  /**
   * ページが表示された時の処理
   */
  private handlePageVisible(): void {
    console.log('ページが表示されました - 音声処理を再開');
    
    // 音声処理を再開
    if (this.audioManager.initialized && 
        (this.currentState === AppState.LISTENING || this.currentState === AppState.READY)) {
      this.audioManager.startRecording();
      this.startAudioProcessingPipeline();
    }
  }

  /**
   * ウィンドウがフォーカスを得た時の処理
   */
  private handleWindowFocus(): void {
    // Page Visibility API が利用できない場合のフォールバック
    if (typeof document.hidden === 'undefined') {
      this.handlePageVisible();
    }
  }

  /**
   * ウィンドウがフォーカスを失った時の処理
   */
  private handleWindowBlur(): void {
    // Page Visibility API が利用できない場合のフォールバック
    if (typeof document.hidden === 'undefined') {
      this.handlePageHidden();
    }
  }

  /**
   * ウィンドウリサイズ時の処理
   */
  private handleWindowResize(): void {
    const app = document.querySelector<HTMLElement>('#app');
    if (!app) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // ビューポートサイズに基づいてクラスを追加/削除
    app.classList.remove('mobile', 'tablet', 'desktop', 'large-desktop');
    
    if (width < 768) {
      app.classList.add('mobile');
    } else if (width < 1024) {
      app.classList.add('tablet');
    } else if (width < 1440) {
      app.classList.add('desktop');
    } else {
      app.classList.add('large-desktop');
    }

    // 縦横比に基づく調整
    const aspectRatio = width / height;
    if (aspectRatio > 1.5) {
      app.classList.add('wide-screen');
    } else {
      app.classList.remove('wide-screen');
    }

    // メーターサイズの動的調整
    this.adjustMeterSize();
  }

  /**
   * 画面向き変更時の処理
   */
  private handleOrientationChange(): void {
    const app = document.querySelector<HTMLElement>('#app');
    if (!app) return;

    // 向きに基づくクラスの追加
    if (window.innerHeight > window.innerWidth) {
      app.classList.add('portrait');
      app.classList.remove('landscape');
    } else {
      app.classList.add('landscape');
      app.classList.remove('portrait');
    }

    // レイアウトの再調整
    this.handleWindowResize();
  }

  /**
   * メーターサイズの動的調整
   */
  private adjustMeterSize(): void {
    const meterContainer = document.querySelector<HTMLElement>('#meter-container');
    if (!meterContainer) return;

    const width = window.innerWidth;
    let meterWidth: number;

    if (width < 480) {
      meterWidth = Math.min(width * 0.8, 240);
    } else if (width < 768) {
      meterWidth = Math.min(width * 0.7, 280);
    } else if (width < 1024) {
      meterWidth = Math.min(width * 0.5, 350);
    } else if (width < 1440) {
      meterWidth = Math.min(width * 0.4, 400);
    } else {
      meterWidth = Math.min(width * 0.35, 600);
    }

    // CSS カスタムプロパティを使用してサイズを動的に設定
    meterContainer.style.setProperty('--dynamic-width', `${meterWidth}px`);
    meterContainer.style.setProperty('--dynamic-height', `${meterWidth * 0.2}px`);
  }

  /**
   * デスクトップかどうかを判定
   */
  private isDesktop(): boolean {
    return window.innerWidth >= 1024 && !('ontouchstart' in window);
  }

  /**
   * デスクトップ向けキーボードショートカット
   */
  private initializeKeyboardShortcuts(): void {
    const keydownHandler = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      // スペースキーで開始/停止
      if (keyboardEvent.code === 'Space' && !keyboardEvent.repeat) {
        keyboardEvent.preventDefault();
        
        if (this.currentState === AppState.IDLE) {
          this.handleStart();
        } else if (this.currentState === AppState.READY || this.currentState === AppState.LISTENING) {
          this.handleStop();
        }
      }

      // Escapeキーで停止
      if (keyboardEvent.code === 'Escape') {
        keyboardEvent.preventDefault();
        if (this.currentState !== AppState.IDLE) {
          this.handleStop();
        }
      }
    };
    
    document.addEventListener('keydown', keydownHandler);
    this.eventListeners.push({ element: document, event: 'keydown', handler: keydownHandler });

    // キーボードショートカットのヒントを表示
    this.showKeyboardHints();
  }

  /**
   * キーボードショートカットのヒントを表示
   */
  private showKeyboardHints(): void {
    const controls = document.querySelector<HTMLElement>('#controls');
    if (!controls) return;

    const hintsElement = document.createElement('div');
    hintsElement.id = 'keyboard-hints';
    hintsElement.innerHTML = `
      <small style="color: var(--text-color); opacity: 0.7; margin-top: 1rem; display: block; text-align: center;">
        キーボードショートカット: スペース = 開始/停止, Esc = 停止
      </small>
    `;
    
    controls.appendChild(hintsElement);
  }

  /**
   * タッチ機能の検出とUI調整
   */
  private detectTouchCapability(): void {
    const app = document.querySelector<HTMLElement>('#app');
    if (!app) return;

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      app.classList.add('touch-device');
      
      // タッチデバイス向けの追加設定
      this.optimizeForTouch();
    } else {
      app.classList.add('no-touch');
    }
  }

  /**
   * タッチデバイス向けの最適化
   */
  private optimizeForTouch(): void {
    // ダブルタップズームを防止
    let lastTouchEnd = 0;
    const touchEndHandler = (event: Event) => {
      const touchEvent = event as TouchEvent;
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        touchEvent.preventDefault();
      }
      lastTouchEnd = now;
    };
    
    document.addEventListener('touchend', touchEndHandler, false);
    this.eventListeners.push({ element: document, event: 'touchend', handler: touchEndHandler });

    // タッチ操作のフィードバック改善
    const buttons = document.querySelectorAll<HTMLButtonElement>('button');
    buttons.forEach(button => {
      button.addEventListener('touchstart', () => {
        button.style.transform = 'translateY(1px)';
      });
      
      button.addEventListener('touchend', () => {
        setTimeout(() => {
          button.style.transform = '';
        }, 100);
      });
    });
  }

  /**
   * アプリケーションのクリーンアップ（メモリリーク防止）
   */
  async cleanup(): Promise<void> {
    console.log('アプリケーションをクリーンアップ中...');
    
    // 音声処理パイプラインを停止
    this.stopAudioProcessingPipeline();
    
    // AudioManagerをクリーンアップ
    if (this.audioManager.initialized) {
      await this.audioManager.cleanup();
    }
    
    // ThemeManagerをクリーンアップ
    this.themeManager.destroy();
    
    // すべてのイベントリスナーを削除
    this.eventListeners.forEach(({ element, event, handler }) => {
      try {
        // MediaQueryList の場合は特別な処理が必要
        if (element && typeof (element as any).removeEventListener === 'function') {
          element.removeEventListener(event, handler);
        } else if (element && typeof (element as any).removeListener === 'function') {
          // 古いブラウザのMediaQueryList用フォールバック
          (element as any).removeListener(handler);
        }
      } catch (error) {
        console.warn('イベントリスナーの削除に失敗しました:', error);
      }
    });
    this.eventListeners = [];
    
    // 参照をクリア
    this.pitchDetector = null;
    
    console.log('クリーンアップ完了');
  }
}

// アプリケーションの初期化
let appInstance: GuitarTunerApp | null = null;

document.addEventListener('DOMContentLoaded', () => {
  appInstance = new GuitarTunerApp();
});

// ページアンロード時のクリーンアップ
window.addEventListener('beforeunload', async () => {
  if (appInstance) {
    await appInstance.cleanup();
  }
});
