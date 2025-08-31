/**
 * テーマ管理システム
 * システムテーマ検出、手動切り替え、永続化を管理
 * ブラウザサポート検出とフォールバック機能を含む
 */

import type { Theme, ThemePreference } from './types';

/**
 * ブラウザサポート検出結果
 */
interface BrowserSupport {
  /** CSS Custom Properties (CSS Variables) サポート */
  cssVariables: boolean;
  /** matchMedia API サポート */
  matchMedia: boolean;
  /** localStorage サポート */
  localStorage: boolean;
  /** prefers-color-scheme サポート */
  prefersColorScheme: boolean;
  /** addEventListener サポート (MediaQueryList) */
  modernEventListeners: boolean;
}

/**
 * テーマ設定データ構造
 */
export interface ThemeSettings {
  /** ユーザーの設定 */
  preference: ThemePreference;
  /** 現在適用されているテーマ */
  current: Theme;
  /** システムのテーマ設定 */
  systemTheme: Theme;
}

/**
 * LocalStorage保存データ構造
 */
interface StoredThemeData {
  theme: ThemePreference;
  timestamp: number;
  version: string;
}

/**
 * テーマ管理クラス
 * システムテーマの検出、手動切り替え、永続化を管理
 * ブラウザサポート検出とフォールバック機能を含む
 */
export class ThemeManager {
  private static readonly STORAGE_KEY = 'guitar-tuner-theme';
  private static readonly VERSION = '1.0.0';
  private static readonly FALLBACK_STORAGE_KEY = 'gt-theme-fallback';
  
  private currentTheme: Theme = 'light';
  private themePreference: ThemePreference = 'system';
  private systemTheme: Theme = 'light';
  private mediaQuery: MediaQueryList | null = null;
  private buttonClickHandler: ((event: Event) => void) | null = null;
  private buttonKeydownHandler: ((event: Event) => void) | null = null;
  
  /** ブラウザサポート状況 */
  private browserSupport: BrowserSupport;
  
  /** フォールバックモード（CSS変数未対応時） */
  private fallbackMode: boolean = false;
  
  /** メモリ内テーマストレージ（localStorage無効時） */
  private memoryStorage: Map<string, string> = new Map();
  
  constructor() {
    // ブラウザサポート検出を最初に実行
    this.browserSupport = this.detectBrowserSupport();
    this.fallbackMode = !this.browserSupport.cssVariables;
    
    this.initialize();
  }
  
  /**
   * ブラウザサポート状況を検出
   * 各機能の対応状況を確認し、フォールバック戦略を決定
   */
  private detectBrowserSupport(): BrowserSupport {
    const support: BrowserSupport = {
      cssVariables: false,
      matchMedia: false,
      localStorage: false,
      prefersColorScheme: false,
      modernEventListeners: false
    };

    try {
      // 実行環境チェック（サーバーサイドレンダリング対応）
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        console.info('サーバーサイド環境を検出しました。クライアントサイド機能は無効化されます。');
        return support;
      }

      // CSS Custom Properties (CSS Variables) サポート検出
      try {
        if (window.CSS && window.CSS.supports) {
          support.cssVariables = window.CSS.supports('--test-var', 'red');
        } else {
          // CSS.supports未対応の場合の代替検出方法
          const testElement = document.createElement('div');
          testElement.style.setProperty('--test-var', 'red');
          support.cssVariables = testElement.style.getPropertyValue('--test-var') === 'red';
        }
      } catch (error) {
        console.warn('CSS変数サポート検出に失敗:', error);
        support.cssVariables = false;
      }

      // matchMedia API サポート検出
      support.matchMedia = typeof window.matchMedia === 'function';

      // localStorage サポート検出
      try {
        if (typeof window.localStorage === 'object' && window.localStorage !== null) {
          // 実際に読み書きテストを実行（プライベートモードでの無効化を検出）
          const testKey = '__theme_manager_test__';
          window.localStorage.setItem(testKey, 'test');
          const testValue = window.localStorage.getItem(testKey);
          window.localStorage.removeItem(testKey);
          support.localStorage = testValue === 'test';
        }
      } catch (error) {
        console.warn('localStorage サポート検出に失敗:', error);
        support.localStorage = false;
      }

      // prefers-color-scheme サポート検出
      if (support.matchMedia) {
        try {
          const testQuery = window.matchMedia('(prefers-color-scheme: dark)');
          support.prefersColorScheme = testQuery.media === '(prefers-color-scheme: dark)';
        } catch (error) {
          console.warn('prefers-color-scheme サポート検出に失敗:', error);
          support.prefersColorScheme = false;
        }
      }

      // Modern event listeners サポート検出 (MediaQueryList.addEventListener)
      if (support.matchMedia) {
        try {
          const testQuery = window.matchMedia('(min-width: 1px)');
          support.modernEventListeners = typeof testQuery.addEventListener === 'function';
        } catch (error) {
          console.warn('Modern event listeners サポート検出に失敗:', error);
          support.modernEventListeners = false;
        }
      }

      // サポート状況をログ出力（開発時のデバッグ用）
      console.info('ブラウザサポート検出結果:', support);

      return support;

    } catch (error) {
      console.error('ブラウザサポート検出中に予期しないエラーが発生しました:', error);
      return support; // 全て false のデフォルト値を返す
    }
  }

  /**
   * テーマシステムの初期化
   * システムテーマの検出と保存されたテーマ設定の復元を行う
   * ブラウザサポート状況に応じてフォールバック処理を実行
   */
  public initialize(): void {
    try {
      // フォールバックモードの場合は警告を表示
      if (this.fallbackMode) {
        console.warn('CSS変数未対応ブラウザを検出しました。基本的なテーマ機能のみ利用可能です。');
      }

      try {
        // システムテーマの検出（サポート状況に応じてフォールバック）
        this.systemTheme = this.detectSystemTheme();
        
        // 保存されたテーマ設定の読み込み（ストレージサポート状況に応じてフォールバック）
        const savedTheme = this.loadSavedTheme();
        
        if (savedTheme) {
          this.themePreference = savedTheme;
        }
        
        // 初期テーマの適用
        this.updateCurrentTheme();
        this.applyTheme(this.currentTheme);
        
        // システムテーマ変更の監視を開始（サポート状況に応じて）
        this.setupSystemThemeListener();

        // フォールバックモードの場合は追加の初期化処理
        if (this.fallbackMode) {
          this.initializeFallbackMode();
        }
      } catch (initError) {
        console.error('初期化処理中にエラーが発生しました:', initError);
        this.handleCriticalError(initError);
      }
      
    } catch (error) {
      console.error('テーマシステムの初期化に失敗しました:', error);
      // 最終フォールバック: デフォルトのライトテーマを適用
      this.handleCriticalError(error);
    }
  }
  
  /**
   * フォールバックモードの初期化
   * CSS変数未対応ブラウザでの基本的なテーマ機能を設定
   */
  private initializeFallbackMode(): void {
    try {
      console.info('フォールバックモードを初期化しています...');
      
      // フォールバック用のCSSクラスを追加
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.classList.add('theme-fallback-mode');
        
        // 現在のテーマに応じたクラスを追加
        if (this.currentTheme === 'dark') {
          document.documentElement.classList.add('theme-fallback-dark');
          document.documentElement.classList.remove('theme-fallback-light');
        } else {
          document.documentElement.classList.add('theme-fallback-light');
          document.documentElement.classList.remove('theme-fallback-dark');
        }
      }
      
      console.info('フォールバックモードの初期化が完了しました');
      
    } catch (error) {
      console.error('フォールバックモードの初期化に失敗しました:', error);
    }
  }

  /**
   * 重大なエラーが発生した場合の処理
   * 最小限の機能でテーマシステムを動作させる
   */
  private handleCriticalError(error: unknown): void {
    console.error('テーマシステムで重大なエラーが発生しました。最小限の機能で動作します:', error);
    
    try {
      // 最も基本的な状態に設定
      this.currentTheme = 'light';
      this.themePreference = 'light'; // 重大なエラー時は手動でライトテーマに固定
      this.systemTheme = 'light';
      this.fallbackMode = true;
      
      // DOM操作が可能な場合のみ実行
      if (typeof document !== 'undefined' && document.documentElement) {
        // 安全なフォールバック適用
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.classList.add('theme-fallback-mode', 'theme-fallback-light');
        
        // color-schemeも設定（可能な場合）
        try {
          document.documentElement.style.colorScheme = 'light';
        } catch (styleError) {
          console.warn('color-schemeの設定に失敗しました:', styleError);
        }
      }
      
    } catch (fallbackError) {
      console.error('フォールバック処理も失敗しました:', fallbackError);
      // これ以上何もできない状態
    }
  }

  /**
   * システムテーマの検出
   * prefers-color-scheme メディアクエリを使用
   * ブラウザサポート状況に応じてフォールバック処理を実行
   */
  private detectSystemTheme(): Theme {
    // 実行環境チェック
    if (typeof window === 'undefined') {
      console.info('サーバーサイド環境のため、デフォルトのライトテーマを使用します');
      return 'light';
    }

    // matchMedia API サポートチェック
    if (!this.browserSupport.matchMedia) {
      console.warn('matchMedia API未対応のため、デフォルトのライトテーマを使用します');
      return 'light';
    }

    // prefers-color-scheme サポートチェック
    if (!this.browserSupport.prefersColorScheme) {
      console.warn('prefers-color-scheme未対応のため、デフォルトのライトテーマを使用します');
      return 'light';
    }
    
    try {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const detectedTheme = darkModeQuery.matches ? 'dark' : 'light';
      console.info(`システムテーマを検出しました: ${detectedTheme}`);
      return detectedTheme;
      
    } catch (error) {
      console.warn('システムテーマの検出に失敗しました:', error);
      return 'light';
    }
  }
  
  /**
   * 保存されたテーマ設定の読み込み
   * localStorage無効時はメモリストレージまたはフォールバック処理を使用
   */
  private loadSavedTheme(): ThemePreference | null {
    // 実行環境チェック
    if (typeof window === 'undefined') {
      console.info('サーバーサイド環境のため、保存されたテーマ設定は読み込めません');
      return null;
    }

    // localStorage サポートチェック
    if (this.browserSupport.localStorage) {
      return this.loadFromLocalStorage();
    } else {
      console.warn('localStorage未対応のため、メモリストレージから読み込みます');
      return this.loadFromMemoryStorage();
    }
  }

  /**
   * LocalStorageからテーマ設定を読み込み
   */
  private loadFromLocalStorage(): ThemePreference | null {
    try {
      const stored = localStorage.getItem(ThemeManager.STORAGE_KEY);
      if (!stored) {
        // 主要キーが見つからない場合、フォールバックキーを試行
        return this.loadFromFallbackStorage();
      }
      
      const data: StoredThemeData = JSON.parse(stored);
      
      // データ構造の検証
      if (!data || typeof data !== 'object') {
        console.warn('無効なテーマ設定データ構造です');
        return this.loadFromFallbackStorage();
      }
      
      // バージョンチェック（将来の拡張性のため）
      if (data.version !== ThemeManager.VERSION) {
        console.info(`テーマ設定のバージョンが異なります (保存: ${data.version}, 現在: ${ThemeManager.VERSION})。マイグレーションを試行します。`);
        return this.migrateThemeData(data);
      }
      
      // 有効な値かチェック
      if (!this.isValidThemePreference(data.theme)) {
        console.warn('無効なテーマ設定が保存されています:', data.theme);
        return this.loadFromFallbackStorage();
      }
      
      console.info(`保存されたテーマ設定を読み込みました: ${data.theme}`);
      return data.theme;
      
    } catch (error) {
      console.warn('LocalStorageからのテーマ設定読み込みに失敗しました:', error);
      return this.loadFromFallbackStorage();
    }
  }

  /**
   * フォールバックストレージからテーマ設定を読み込み
   */
  private loadFromFallbackStorage(): ThemePreference | null {
    try {
      const fallbackValue = localStorage.getItem(ThemeManager.FALLBACK_STORAGE_KEY);
      if (fallbackValue && this.isValidThemePreference(fallbackValue as ThemePreference)) {
        console.info(`フォールバックストレージからテーマ設定を読み込みました: ${fallbackValue}`);
        return fallbackValue as ThemePreference;
      }
    } catch (error) {
      console.warn('フォールバックストレージからの読み込みに失敗しました:', error);
    }
    return null;
  }

  /**
   * メモリストレージからテーマ設定を読み込み
   */
  private loadFromMemoryStorage(): ThemePreference | null {
    try {
      const stored = this.memoryStorage.get(ThemeManager.STORAGE_KEY);
      if (stored && this.isValidThemePreference(stored as ThemePreference)) {
        console.info(`メモリストレージからテーマ設定を読み込みました: ${stored}`);
        return stored as ThemePreference;
      }
    } catch (error) {
      console.warn('メモリストレージからの読み込みに失敗しました:', error);
    }
    return null;
  }

  /**
   * テーマ設定データのマイグレーション
   */
  private migrateThemeData(data: any): ThemePreference | null {
    try {
      // 古いバージョンのデータ構造に対応
      if (typeof data === 'string' && this.isValidThemePreference(data as ThemePreference)) {
        console.info('古い形式のテーマ設定をマイグレーションしました');
        return data as ThemePreference;
      }
      
      if (data && typeof data.theme === 'string' && this.isValidThemePreference(data.theme)) {
        console.info('テーマ設定データをマイグレーションしました');
        return data.theme;
      }
      
      console.warn('マイグレーション不可能なデータ構造です');
      return null;
      
    } catch (error) {
      console.warn('テーマ設定のマイグレーションに失敗しました:', error);
      return null;
    }
  }

  /**
   * テーマ設定値の妥当性チェック
   */
  private isValidThemePreference(value: any): value is ThemePreference {
    return typeof value === 'string' && ['light', 'dark', 'system'].includes(value);
  }
  
  /**
   * テーマ設定を保存
   * localStorage無効時はメモリストレージを使用
   */
  private saveTheme(preference: ThemePreference): void {
    // 実行環境チェック
    if (typeof window === 'undefined') {
      console.info('サーバーサイド環境のため、テーマ設定は保存されません');
      return;
    }

    // 入力値の検証
    if (!this.isValidThemePreference(preference)) {
      console.error('無効なテーマ設定値です:', preference);
      return;
    }

    // localStorage サポートチェック
    if (this.browserSupport.localStorage) {
      this.saveToLocalStorage(preference);
    } else {
      console.warn('localStorage未対応のため、メモリストレージに保存します');
      this.saveToMemoryStorage(preference);
    }
  }

  /**
   * LocalStorageにテーマ設定を保存
   */
  private saveToLocalStorage(preference: ThemePreference): void {
    try {
      const data: StoredThemeData = {
        theme: preference,
        timestamp: Date.now(),
        version: ThemeManager.VERSION
      };
      
      // メイン保存
      localStorage.setItem(ThemeManager.STORAGE_KEY, JSON.stringify(data));
      
      // フォールバック保存（シンプルな形式）
      try {
        localStorage.setItem(ThemeManager.FALLBACK_STORAGE_KEY, preference);
      } catch (fallbackError) {
        console.warn('フォールバックストレージへの保存に失敗しました:', fallbackError);
      }
      
      console.info(`テーマ設定を保存しました: ${preference}`);
      
    } catch (error) {
      console.warn('LocalStorageへのテーマ設定保存に失敗しました:', error);
      
      // LocalStorageが満杯の場合の対処
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('LocalStorageの容量が不足しています。古いデータをクリアして再試行します。');
        this.clearOldThemeData();
        
        // 再試行
        try {
          const data: StoredThemeData = {
            theme: preference,
            timestamp: Date.now(),
            version: ThemeManager.VERSION
          };
          localStorage.setItem(ThemeManager.STORAGE_KEY, JSON.stringify(data));
          console.info('容量クリア後にテーマ設定を保存しました');
        } catch (retryError) {
          console.error('再試行も失敗しました。メモリストレージを使用します:', retryError);
          this.saveToMemoryStorage(preference);
        }
      } else {
        // その他のエラーの場合はメモリストレージにフォールバック
        this.saveToMemoryStorage(preference);
      }
    }
  }

  /**
   * メモリストレージにテーマ設定を保存
   */
  private saveToMemoryStorage(preference: ThemePreference): void {
    try {
      this.memoryStorage.set(ThemeManager.STORAGE_KEY, preference);
      console.info(`メモリストレージにテーマ設定を保存しました: ${preference}`);
    } catch (error) {
      console.error('メモリストレージへの保存も失敗しました:', error);
    }
  }

  /**
   * 古いテーマデータをクリア（容量不足対策）
   */
  private clearOldThemeData(): void {
    try {
      // 古いバージョンのキーをクリア
      const oldKeys = [
        'theme-preference',
        'guitar-tuner-theme-old',
        'app-theme',
        'user-theme-preference'
      ];
      
      oldKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.warn(`古いキー ${key} の削除に失敗しました:`, error);
        }
      });
      
      console.info('古いテーマデータをクリアしました');
      
    } catch (error) {
      console.warn('古いテーマデータのクリアに失敗しました:', error);
    }
  }
  
  /**
   * システムテーマ変更の監視を設定
   * ブラウザサポート状況に応じてフォールバック処理を実行
   */
  private setupSystemThemeListener(): void {
    // 実行環境チェック
    if (typeof window === 'undefined') {
      console.info('サーバーサイド環境のため、システムテーマ監視は無効化されます');
      return;
    }

    // 必要な機能のサポートチェック
    if (!this.browserSupport.matchMedia) {
      console.warn('matchMedia API未対応のため、システムテーマ変更の監視は無効化されます');
      return;
    }

    if (!this.browserSupport.prefersColorScheme) {
      console.warn('prefers-color-scheme未対応のため、システムテーマ変更の監視は無効化されます');
      return;
    }
    
    try {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      if (!this.mediaQuery) {
        console.warn('MediaQueryListの作成に失敗しました');
        return;
      }
      
      // イベントリスナーの設定（ブラウザサポートに応じて）
      if (this.browserSupport.modernEventListeners && this.mediaQuery.addEventListener) {
        // モダンブラウザ用
        this.mediaQuery.addEventListener('change', this.onSystemThemeChange.bind(this));
        console.info('モダンなイベントリスナーでシステムテーマ監視を開始しました');
      } else if (this.mediaQuery.addListener) {
        // 古いブラウザ用フォールバック
        this.mediaQuery.addListener(this.onSystemThemeChange.bind(this));
        console.info('レガシーイベントリスナーでシステムテーマ監視を開始しました');
      } else {
        console.warn('イベントリスナーの設定に失敗しました。システムテーマ変更の自動検出は無効化されます');
        
        // ポーリングによるフォールバック（最後の手段）
        this.setupPollingFallback();
      }
      
    } catch (error) {
      console.warn('システムテーマ変更の監視設定に失敗しました:', error);
      
      // ポーリングによるフォールバック
      this.setupPollingFallback();
    }
  }

  /**
   * ポーリングによるシステムテーマ変更検出（最終フォールバック）
   */
  private setupPollingFallback(): void {
    // ユーザー設定が'system'の場合のみポーリングを実行
    if (this.themePreference !== 'system') {
      return;
    }

    console.info('ポーリングによるシステムテーマ監視を開始します（5秒間隔）');
    
    const pollInterval = setInterval(() => {
      try {
        // ユーザー設定が変更された場合はポーリングを停止
        if (this.themePreference !== 'system') {
          clearInterval(pollInterval);
          console.info('ユーザー設定変更によりポーリングを停止しました');
          return;
        }

        const currentSystemTheme = this.detectSystemTheme();
        if (currentSystemTheme !== this.systemTheme) {
          console.info(`ポーリングでシステムテーマ変更を検出: ${this.systemTheme} → ${currentSystemTheme}`);
          this.systemTheme = currentSystemTheme;
          this.updateCurrentTheme();
          this.applyTheme(this.currentTheme);
        }
        
      } catch (error) {
        console.warn('ポーリング中にエラーが発生しました:', error);
        clearInterval(pollInterval);
      }
    }, 5000); // 5秒間隔

    // 10分後にポーリングを自動停止（リソース節約）
    setTimeout(() => {
      clearInterval(pollInterval);
      console.info('ポーリングを自動停止しました（10分経過）');
    }, 600000);
  }
  
  /**
   * システムテーマ変更時のイベントハンドラー
   */
  private onSystemThemeChange(event: MediaQueryListEvent): void {
    this.systemTheme = event.matches ? 'dark' : 'light';
    
    // ユーザー設定が'system'の場合のみ更新
    if (this.themePreference === 'system') {
      this.updateCurrentTheme();
      this.applyTheme(this.currentTheme);
    }
  }
  
  /**
   * 現在のテーマを更新
   * ユーザー設定とシステムテーマに基づいて決定
   */
  private updateCurrentTheme(): void {
    if (this.themePreference === 'system') {
      this.currentTheme = this.systemTheme;
    } else {
      this.currentTheme = this.themePreference;
    }
  }
  
  /**
   * テーマをDOMに適用
   * スムーズなアニメーション付きでテーマを切り替える
   * フォールバックモード対応
   */
  private applyTheme(theme: Theme): void {
    if (typeof document === 'undefined') {
      console.info('サーバーサイド環境のため、テーマ適用をスキップします');
      return;
    }
    
    try {
      // テーマ切り替え中の状態を設定（アニメーション制御用）
      this.setThemeSwitchingState(true);
      
      if (this.fallbackMode) {
        // フォールバックモード: CSS変数未対応ブラウザ用の処理
        this.applyFallbackTheme(theme);
      } else {
        // 通常モード: CSS変数を使用した処理
        this.applyModernTheme(theme);
      }
      
      // テーマ切り替えボタンのUIを更新
      this.updateThemeToggleButton();
      
      // アニメーション完了後にテーマ切り替え状態を解除
      this.scheduleThemeSwitchingStateReset();
      
      console.info(`テーマを適用しました: ${theme} (${this.fallbackMode ? 'フォールバック' : '通常'}モード)`);
      
    } catch (error) {
      console.warn('テーマの適用に失敗しました:', error);
      
      // エラー時のフォールバック処理
      this.applyEmergencyFallback(theme);
      
      // エラー時も状態をリセット
      this.setThemeSwitchingState(false);
    }
  }

  /**
   * モダンブラウザ用のテーマ適用
   */
  private applyModernTheme(theme: Theme): void {
    try {
      const rootElement = document.documentElement;
      
      // data-theme属性を設定
      rootElement.setAttribute('data-theme', theme);
      
      // color-schemeプロパティも設定（ブラウザのネイティブ要素にも影響）
      rootElement.style.colorScheme = theme;
      
      // CSS変数が正しく適用されているかチェック
      this.validateThemeApplication(theme);
      
    } catch (error) {
      console.warn('モダンテーマ適用に失敗しました:', error);
      throw error; // 上位でフォールバック処理を実行
    }
  }

  /**
   * フォールバックモード用のテーマ適用
   */
  private applyFallbackTheme(theme: Theme): void {
    try {
      const rootElement = document.documentElement;
      
      // フォールバック用のクラスを設定
      rootElement.classList.remove('theme-fallback-light', 'theme-fallback-dark');
      rootElement.classList.add(`theme-fallback-${theme}`);
      
      // data-theme属性も設定（CSS変数対応ブラウザとの互換性のため）
      rootElement.setAttribute('data-theme', theme);
      
      // 可能な場合はcolor-schemeも設定
      try {
        rootElement.style.colorScheme = theme;
      } catch (styleError) {
        console.warn('color-schemeの設定に失敗しました（フォールバックモード）:', styleError);
      }
      
      // フォールバック用のインラインスタイルを適用
      this.applyFallbackStyles(theme);
      
    } catch (error) {
      console.warn('フォールバックテーマ適用に失敗しました:', error);
      throw error;
    }
  }

  /**
   * フォールバック用のインラインスタイル適用
   */
  private applyFallbackStyles(theme: Theme): void {
    try {
      const rootElement = document.documentElement;
      
      if (theme === 'dark') {
        // ダークテーマの基本色を直接適用
        rootElement.style.backgroundColor = '#0f172a';
        rootElement.style.color = '#f1f5f9';
      } else {
        // ライトテーマの基本色を直接適用
        rootElement.style.backgroundColor = '#ffffff';
        rootElement.style.color = '#1a252f';
      }
      
      // 重要な要素に直接スタイルを適用
      this.applyFallbackElementStyles(theme);
      
    } catch (error) {
      console.warn('フォールバックスタイルの適用に失敗しました:', error);
    }
  }

  /**
   * フォールバック用の要素別スタイル適用
   */
  private applyFallbackElementStyles(theme: Theme): void {
    try {
      // 主要な要素にフォールバックスタイルを適用
      const selectors = [
        '#app',
        '.tuner-container',
        '.meter-container',
        '.controls',
        'button'
      ];
      
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(element => {
            if (element instanceof HTMLElement) {
              this.applyElementFallbackStyle(element, theme);
            }
          });
        } catch (selectorError) {
          console.warn(`セレクター ${selector} の処理に失敗しました:`, selectorError);
        }
      });
      
    } catch (error) {
      console.warn('要素別フォールバックスタイルの適用に失敗しました:', error);
    }
  }

  /**
   * 個別要素へのフォールバックスタイル適用
   */
  private applyElementFallbackStyle(element: HTMLElement, theme: Theme): void {
    try {
      if (theme === 'dark') {
        // ダークテーマ用のスタイル
        if (element.tagName === 'BUTTON') {
          element.style.backgroundColor = '#3b82f6';
          element.style.color = '#ffffff';
          element.style.border = '1px solid #60a5fa';
        } else {
          element.style.backgroundColor = '#1e293b';
          element.style.color = '#f1f5f9';
          element.style.borderColor = '#475569';
        }
      } else {
        // ライトテーマ用のスタイル
        if (element.tagName === 'BUTTON') {
          element.style.backgroundColor = '#2563eb';
          element.style.color = '#ffffff';
          element.style.border = '1px solid #2563eb';
        } else {
          element.style.backgroundColor = '#f8fafc';
          element.style.color = '#1a252f';
          element.style.borderColor = '#cbd5e1';
        }
      }
    } catch (error) {
      console.warn('個別要素のフォールバックスタイル適用に失敗しました:', error);
    }
  }

  /**
   * 緊急時のフォールバック処理
   */
  private applyEmergencyFallback(theme: Theme): void {
    try {
      console.warn('緊急フォールバック処理を実行します');
      
      const rootElement = document.documentElement;
      
      // 最小限のスタイル適用
      if (theme === 'dark') {
        rootElement.style.backgroundColor = '#000000';
        rootElement.style.color = '#ffffff';
      } else {
        rootElement.style.backgroundColor = '#ffffff';
        rootElement.style.color = '#000000';
      }
      
      // data-theme属性だけは設定を試行
      try {
        rootElement.setAttribute('data-theme', theme);
      } catch (attrError) {
        console.warn('data-theme属性の設定も失敗しました:', attrError);
      }
      
    } catch (error) {
      console.error('緊急フォールバック処理も失敗しました:', error);
    }
  }

  /**
   * テーマ適用の検証
   */
  private validateThemeApplication(_theme: Theme): void {
    try {
      if (!this.browserSupport.cssVariables) {
        return; // CSS変数未対応の場合は検証をスキップ
      }

      const rootElement = document.documentElement;
      const computedStyle = window.getComputedStyle(rootElement);
      
      // 主要なCSS変数が正しく設定されているかチェック
      const backgroundColor = computedStyle.getPropertyValue('--background-color').trim();
      const textColor = computedStyle.getPropertyValue('--text-color').trim();
      
      if (!backgroundColor || !textColor) {
        console.warn('CSS変数が正しく適用されていない可能性があります');
      } else {
        console.info('テーマ適用の検証が完了しました');
      }
      
    } catch (error) {
      console.warn('テーマ適用の検証に失敗しました:', error);
    }
  }
  
  /**
   * テーマ切り替え中の状態を設定
   * CSSアニメーションの制御に使用
   */
  private setThemeSwitchingState(isSwitching: boolean): void {
    if (typeof document === 'undefined') {
      return;
    }
    
    try {
      const rootElement = document.documentElement;
      
      // テスト環境でclassListが利用できない場合のフォールバック
      if (!rootElement || !rootElement.classList) {
        return;
      }
      
      if (isSwitching) {
        rootElement.classList.add('theme-switching');
      } else {
        rootElement.classList.remove('theme-switching');
      }
    } catch (error) {
      console.warn('テーマ切り替え状態の設定に失敗しました:', error);
    }
  }
  
  /**
   * テーマ切り替えアニメーション完了後に状態をリセット
   */
  private scheduleThemeSwitchingStateReset(): void {
    // CSS変数から遷移時間を取得（フォールバック: 300ms）
    const transitionDuration = this.getThemeTransitionDuration();
    
    // アニメーション完了後に状態をリセット
    setTimeout(() => {
      this.setThemeSwitchingState(false);
    }, transitionDuration + 50); // 少し余裕を持たせる
  }
  
  /**
   * CSS変数からテーマ遷移時間を取得
   */
  private getThemeTransitionDuration(): number {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return 300; // デフォルト値
    }
    
    try {
      // テスト環境での互換性チェック
      if (!document.documentElement || !window.getComputedStyle) {
        return 300;
      }
      
      const computedStyle = window.getComputedStyle(document.documentElement);
      
      // getComputedStyleが正常に動作しない場合のフォールバック
      if (!computedStyle || typeof computedStyle.getPropertyValue !== 'function') {
        return 300;
      }
      
      const durationStr = computedStyle.getPropertyValue('--theme-transition-duration').trim();
      
      if (!durationStr) {
        return 300;
      }
      
      // 's'または'ms'の単位を処理
      if (durationStr.endsWith('ms')) {
        return parseFloat(durationStr.replace('ms', ''));
      } else if (durationStr.endsWith('s')) {
        return parseFloat(durationStr.replace('s', '')) * 1000;
      }
      
      return 300; // パースできない場合のフォールバック
      
    } catch (error) {
      console.warn('テーマ遷移時間の取得に失敗しました:', error);
      return 300;
    }
  }
  
  /**
   * テーマ切り替えボタンのUIを更新
   */
  private updateThemeToggleButton(): void {
    if (typeof document === 'undefined') {
      return;
    }
    
    try {
      const themeToggleButton = document.querySelector<HTMLButtonElement>('#theme-toggle');
      const themeIcon = document.querySelector<HTMLSpanElement>('.theme-icon');
      const srOnlyText = document.querySelector<HTMLSpanElement>('.sr-only');
      
      if (!themeToggleButton || !themeIcon || !srOnlyText) {
        return;
      }
      
      // アイコンとテキストを現在のテーマに基づいて更新
      if (this.currentTheme === 'dark') {
        themeIcon.textContent = '☀️';
        themeToggleButton.setAttribute('aria-pressed', 'true');
        themeToggleButton.setAttribute('title', 'ライトモードに切り替え');
        srOnlyText.textContent = '現在: ダークモード';
      } else {
        themeIcon.textContent = '🌙';
        themeToggleButton.setAttribute('aria-pressed', 'false');
        themeToggleButton.setAttribute('title', 'ダークモードに切り替え');
        srOnlyText.textContent = '現在: ライトモード';
      }
      
    } catch (error) {
      console.warn('テーマ切り替えボタンの更新に失敗しました:', error);
    }
  }
  
  /**
   * テーマ切り替えボタンのイベントリスナーを設定
   */
  public setupThemeToggleButton(): void {
    if (typeof document === 'undefined') {
      return;
    }
    
    try {
      const themeToggleButton = document.querySelector<HTMLButtonElement>('#theme-toggle');
      
      if (!themeToggleButton) {
        console.warn('テーマ切り替えボタンが見つかりません');
        return;
      }
      
      // 既存のイベントリスナーを削除
      this.removeButtonEventListeners();
      
      // クリックイベントリスナーを追加
      this.buttonClickHandler = (event: Event) => {
        event.preventDefault();
        this.toggleTheme();
      };
      
      themeToggleButton.addEventListener('click', this.buttonClickHandler);
      
      // キーボードナビゲーション対応
      this.buttonKeydownHandler = (event: Event) => {
        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
          event.preventDefault();
          this.toggleTheme();
        }
      };
      
      themeToggleButton.addEventListener('keydown', this.buttonKeydownHandler);
      
      // 初期状態のボタンUIを設定
      this.updateThemeToggleButton();
      
    } catch (error) {
      console.warn('テーマ切り替えボタンの設定に失敗しました:', error);
    }
  }
  
  /**
   * テーマ切り替えボタンのイベントリスナーを削除
   */
  private removeButtonEventListeners(): void {
    if (typeof document === 'undefined') {
      return;
    }
    
    try {
      const themeToggleButton = document.querySelector<HTMLButtonElement>('#theme-toggle');
      
      if (themeToggleButton && this.buttonClickHandler) {
        themeToggleButton.removeEventListener('click', this.buttonClickHandler);
      }
      
      if (themeToggleButton && this.buttonKeydownHandler) {
        themeToggleButton.removeEventListener('keydown', this.buttonKeydownHandler);
      }
      
      this.buttonClickHandler = null;
      this.buttonKeydownHandler = null;
      
    } catch (error) {
      console.warn('テーマ切り替えボタンのイベントリスナー削除に失敗しました:', error);
    }
  }
  
  /**
   * テーマを手動で設定
   */
  public setTheme(theme: ThemePreference): void {
    this.themePreference = theme;
    this.updateCurrentTheme();
    this.applyTheme(this.currentTheme);
    this.saveTheme(theme);
  }
  
  /**
   * テーマを切り替え（ライト ⇔ ダーク）
   * システム設定の場合は現在のシステムテーマの反対に設定
   */
  public toggleTheme(): void {
    const newTheme: Theme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }
  
  /**
   * 現在適用されているテーマを取得
   */
  public getCurrentTheme(): Theme {
    return this.currentTheme;
  }
  
  /**
   * ユーザーのテーマ設定を取得
   */
  public getThemePreference(): ThemePreference {
    return this.themePreference;
  }
  
  /**
   * システムテーマを取得
   */
  public getSystemTheme(): Theme {
    return this.systemTheme;
  }
  
  /**
   * 現在のテーマ設定を取得
   */
  public getThemeSettings(): ThemeSettings {
    return {
      preference: this.themePreference,
      current: this.currentTheme,
      systemTheme: this.systemTheme
    };
  }

  /**
   * ブラウザサポート状況を取得
   */
  public getBrowserSupport(): BrowserSupport {
    return { ...this.browserSupport };
  }

  /**
   * フォールバックモード状況を取得
   */
  public isFallbackMode(): boolean {
    return this.fallbackMode;
  }

  /**
   * テーマシステムの健全性チェック
   */
  public checkSystemHealth(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // ブラウザサポートチェック
      if (!this.browserSupport.cssVariables) {
        issues.push('CSS変数未対応');
        recommendations.push('モダンブラウザへのアップグレードを推奨');
      }

      if (!this.browserSupport.localStorage) {
        issues.push('localStorage未対応またはプライベートモード');
        recommendations.push('通常のブラウジングモードでの使用を推奨');
      }

      if (!this.browserSupport.prefersColorScheme) {
        issues.push('システムテーマ検出未対応');
        recommendations.push('手動でのテーマ切り替えをご利用ください');
      }

      // DOM状態チェック
      if (typeof document !== 'undefined') {
        const rootElement = document.documentElement;
        if (!rootElement.hasAttribute('data-theme')) {
          issues.push('テーマ属性が設定されていません');
          recommendations.push('テーマシステムの再初期化が必要です');
        }
      }

      // メモリリークチェック
      if (this.memoryStorage.size > 10) {
        issues.push('メモリストレージが肥大化しています');
        recommendations.push('アプリケーションの再起動を推奨');
      }

      const isHealthy = issues.length === 0;

      return {
        isHealthy,
        issues,
        recommendations
      };

    } catch (error) {
      console.error('システム健全性チェック中にエラーが発生しました:', error);
      return {
        isHealthy: false,
        issues: ['健全性チェック実行エラー'],
        recommendations: ['テーマシステムの再初期化を試してください']
      };
    }
  }
  
  /**
   * リソースのクリーンアップ
   * コンポーネントの破棄時に呼び出す
   * メモリリークを防ぐため、すべてのリソースを適切に解放
   */
  public destroy(): void {
    try {
      console.info('テーマシステムのクリーンアップを開始します');

      // テーマ切り替えボタンのイベントリスナーを削除
      this.removeButtonEventListeners();
      
      // システムテーマ監視の解除
      this.cleanupSystemThemeListener();
      
      // メモリストレージのクリア
      this.memoryStorage.clear();
      
      // フォールバックモードのクリーンアップ
      if (this.fallbackMode) {
        this.cleanupFallbackMode();
      }
      
      // プロパティのリセット
      this.resetProperties();
      
      console.info('テーマシステムのクリーンアップが完了しました');
      
    } catch (error) {
      console.error('テーマシステムのクリーンアップ中にエラーが発生しました:', error);
    }
  }

  /**
   * システムテーマ監視のクリーンアップ
   */
  private cleanupSystemThemeListener(): void {
    if (!this.mediaQuery) {
      return;
    }

    try {
      // イベントリスナーの削除（ブラウザサポートに応じて）
      if (this.browserSupport.modernEventListeners && this.mediaQuery.removeEventListener) {
        this.mediaQuery.removeEventListener('change', this.onSystemThemeChange.bind(this));
      } else if (this.mediaQuery.removeListener) {
        this.mediaQuery.removeListener(this.onSystemThemeChange.bind(this));
      }
      
      console.info('システムテーマ監視を解除しました');
      
    } catch (error) {
      console.warn('システムテーマ監視の解除に失敗しました:', error);
    } finally {
      this.mediaQuery = null;
    }
  }

  /**
   * フォールバックモードのクリーンアップ
   */
  private cleanupFallbackMode(): void {
    try {
      if (typeof document !== 'undefined' && document.documentElement) {
        const rootElement = document.documentElement;
        
        // フォールバック用のクラスを削除
        rootElement.classList.remove(
          'theme-fallback-mode',
          'theme-fallback-light',
          'theme-fallback-dark'
        );
        
        // インラインスタイルをクリア（フォールバックで設定されたもの）
        const stylesToClear = [
          'backgroundColor',
          'color',
          'borderColor'
        ];
        
        stylesToClear.forEach(property => {
          try {
            rootElement.style.removeProperty(property);
          } catch (styleError) {
            console.warn(`スタイルプロパティ ${property} の削除に失敗しました:`, styleError);
          }
        });
        
        console.info('フォールバックモードのクリーンアップが完了しました');
      }
      
    } catch (error) {
      console.warn('フォールバックモードのクリーンアップに失敗しました:', error);
    }
  }

  /**
   * プロパティのリセット
   */
  private resetProperties(): void {
    try {
      this.currentTheme = 'light';
      this.themePreference = 'system';
      this.systemTheme = 'light';
      this.fallbackMode = false;
      this.buttonClickHandler = null;
      this.buttonKeydownHandler = null;
      
      // ブラウザサポート情報もリセット
      this.browserSupport = {
        cssVariables: false,
        matchMedia: false,
        localStorage: false,
        prefersColorScheme: false,
        modernEventListeners: false
      };
      
    } catch (error) {
      console.warn('プロパティのリセットに失敗しました:', error);
    }
  }
}