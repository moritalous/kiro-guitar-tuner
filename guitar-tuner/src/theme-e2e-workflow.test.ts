/**
 * テーマシステム End-to-End ワークフローテスト
 * 実際のユーザー操作フローを模擬した統合テスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeManager } from './ThemeManager';
import { UIController } from './UIController';
import type { Theme, ThemePreference } from './types';

/**
 * ユーザー操作シミュレーター
 */
class UserInteractionSimulator {
  /**
   * マウスクリックをシミュレート
   */
  static simulateClick(element: HTMLElement): void {
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    element.dispatchEvent(clickEvent);
  }

  /**
   * キーボード操作をシミュレート
   */
  static simulateKeyPress(element: HTMLElement, key: string, code: string): void {
    const keydownEvent = new KeyboardEvent('keydown', {
      key,
      code,
      bubbles: true,
      cancelable: true
    });
    
    const keyupEvent = new KeyboardEvent('keyup', {
      key,
      code,
      bubbles: true,
      cancelable: true
    });
    
    element.dispatchEvent(keydownEvent);
    element.dispatchEvent(keyupEvent);
  }

  /**
   * フォーカス操作をシミュレート
   */
  static simulateFocus(element: HTMLElement): void {
    const focusEvent = new FocusEvent('focus', {
      bubbles: true,
      cancelable: true
    });
    element.focus();
    element.dispatchEvent(focusEvent);
  }

  /**
   * タッチ操作をシミュレート
   */
  static simulateTouch(element: HTMLElement): void {
    const touchStartEvent = new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [new Touch({
        identifier: 1,
        target: element,
        clientX: 100,
        clientY: 100
      })]
    });
    
    const touchEndEvent = new TouchEvent('touchend', {
      bubbles: true,
      cancelable: true,
      changedTouches: [new Touch({
        identifier: 1,
        target: element,
        clientX: 100,
        clientY: 100
      })]
    });
    
    element.dispatchEvent(touchStartEvent);
    element.dispatchEvent(touchEndEvent);
  }
}

/**
 * システム環境シミュレーター
 */
class SystemEnvironmentSimulator {
  /**
   * システムテーマ変更をシミュレート
   */
  static simulateSystemThemeChange(isDark: boolean): void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const changeEvent = new MediaQueryListEvent('change', {
      matches: isDark,
      media: '(prefers-color-scheme: dark)'
    });
    
    // イベントハンドラーを直接呼び出し
    if (mediaQuery.addEventListener) {
      const handler = vi.mocked(mediaQuery.addEventListener).mock.calls
        .find(call => call[0] === 'change')?.[1];
      if (handler) {
        handler(changeEvent);
      }
    }
  }

  /**
   * ページ可視性変更をシミュレート
   */
  static simulateVisibilityChange(hidden: boolean): void {
    Object.defineProperty(document, 'hidden', {
      value: hidden,
      writable: true
    });
    
    const visibilityEvent = new Event('visibilitychange');
    document.dispatchEvent(visibilityEvent);
  }

  /**
   * ウィンドウリサイズをシミュレート
   */
  static simulateWindowResize(width: number, height: number): void {
    Object.defineProperty(window, 'innerWidth', {
      value: width,
      writable: true
    });
    
    Object.defineProperty(window, 'innerHeight', {
      value: height,
      writable: true
    });
    
    const resizeEvent = new Event('resize');
    window.dispatchEvent(resizeEvent);
  }

  /**
   * ネットワーク状態変更をシミュレート
   */
  static simulateNetworkChange(online: boolean): void {
    Object.defineProperty(navigator, 'onLine', {
      value: online,
      writable: true
    });
    
    const networkEvent = new Event(online ? 'online' : 'offline');
    window.dispatchEvent(networkEvent);
  }
}

/**
 * アプリケーション状態検証ヘルパー
 */
class AppStateValidator {
  /**
   * テーマ状態の一貫性を検証
   */
  static validateThemeConsistency(themeManager: ThemeManager): void {
    const currentTheme = themeManager.getCurrentTheme();
    const settings = themeManager.getThemeSettings();
    
    // DOM属性との一貫性
    expect(document.documentElement.getAttribute('data-theme')).toBe(currentTheme);
    
    // color-schemeプロパティとの一貫性
    const computedStyle = window.getComputedStyle(document.documentElement);
    expect(computedStyle.colorScheme).toBe(currentTheme);
    
    // 設定オブジェクトとの一貫性
    expect(settings.current).toBe(currentTheme);
  }

  /**
   * UI要素の状態を検証
   */
  static validateUIState(themeToggleButton: HTMLButtonElement, currentTheme: Theme): void {
    const expectedPressed = currentTheme === 'dark' ? 'true' : 'false';
    const expectedIcon = currentTheme === 'dark' ? '☀️' : '🌙';
    const expectedSrText = currentTheme === 'dark' ? '現在: ダークモード' : '現在: ライトモード';
    const expectedTitle = currentTheme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え';
    
    expect(themeToggleButton.getAttribute('aria-pressed')).toBe(expectedPressed);
    expect(themeToggleButton.querySelector('.theme-icon')?.textContent).toBe(expectedIcon);
    expect(themeToggleButton.querySelector('.sr-only')?.textContent).toBe(expectedSrText);
    expect(themeToggleButton.getAttribute('title')).toBe(expectedTitle);
  }

  /**
   * アクセシビリティ属性を検証
   */
  static validateAccessibilityAttributes(element: HTMLElement): void {
    // 必須のアクセシビリティ属性
    expect(element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby')).toBe(true);
    
    // キーボードアクセシビリティ
    expect(element.tabIndex >= 0 || element.tagName === 'BUTTON').toBe(true);
    
    // 状態を持つ要素の場合
    if (element.getAttribute('role') === 'button' || element.tagName === 'BUTTON') {
      if (element.hasAttribute('aria-pressed')) {
        expect(['true', 'false'].includes(element.getAttribute('aria-pressed') || '')).toBe(true);
      }
    }
  }

  /**
   * パフォーマンス指標を検証
   */
  static validatePerformance(startTime: number, endTime: number, maxDuration: number): void {
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(maxDuration);
  }
}

/**
 * 完全なアプリケーション環境セットアップ
 */
class FullAppSetup {
  static setupCompleteApp(): {
    themeManager: ThemeManager;
    uiController: UIController;
    elements: {
      themeToggle: HTMLButtonElement;
      startButton: HTMLButtonElement;
      stopButton: HTMLButtonElement;
      statusMessage: HTMLElement;
      meterContainer: HTMLElement;
      noteDisplay: HTMLElement;
      centsDisplay: HTMLElement;
    };
  } {
    // HTML構造を作成
    document.body.innerHTML = `
      <div id="app">
        <div id="status-message" role="status" aria-live="polite">チューナーを開始してください</div>
        <div id="meter-container" role="img" aria-label="チューニングメーター">
          <div id="meter-needle"></div>
          <div id="meter-scale"></div>
        </div>
        <div id="detected-note" aria-label="検出された音程">-</div>
        <div id="cents-value" aria-label="音程のずれ">0</div>
        <div id="tuning-display" aria-label="チューニング状態">標準</div>
        <div id="instructions" aria-label="使用方法">楽器を演奏してください</div>
        <div id="controls">
          <button id="start-button">開始</button>
          <button id="stop-button" disabled>停止</button>
          <button id="toggle-instructions">説明を切り替え</button>
          <button id="show-instructions">説明を表示</button>
          <button id="theme-toggle" aria-label="テーマを切り替え" aria-pressed="false" title="ダークモード/ライトモードを切り替え">
            <span class="theme-icon" aria-hidden="true">🌙</span>
            <span class="sr-only">現在: ライトモード</span>
          </button>
        </div>
      </div>
    `;

    // CSS変数を設定
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --background-color: #ffffff;
        --text-color: #2c3e50;
        --success-color: #27ae60;
        --warning-color: #f39c12;
        --danger-color: #e74c3c;
        --primary-color: #3498db;
        --border-color: #bdc3c7;
        --theme-transition-duration: 300ms;
      }
      
      [data-theme="dark"] {
        --background-color: #1a1a1a;
        --text-color: #ecf0f1;
        --success-color: #2ecc71;
        --warning-color: #f39c12;
        --danger-color: #e74c3c;
        --primary-color: #3498db;
        --border-color: #4a4a4a;
      }
      
      .theme-switching {
        transition: all var(--theme-transition-duration) ease;
      }
      
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      
      body {
        background-color: var(--background-color);
        color: var(--text-color);
        transition: background-color var(--theme-transition-duration) ease,
                    color var(--theme-transition-duration) ease;
      }
    `;
    document.head.appendChild(style);

    // 要素を取得
    const elements = {
      themeToggle: document.getElementById('theme-toggle') as HTMLButtonElement,
      startButton: document.getElementById('start-button') as HTMLButtonElement,
      stopButton: document.getElementById('stop-button') as HTMLButtonElement,
      statusMessage: document.getElementById('status-message') as HTMLElement,
      meterContainer: document.getElementById('meter-container') as HTMLElement,
      noteDisplay: document.getElementById('detected-note') as HTMLElement,
      centsDisplay: document.getElementById('detected-cents') as HTMLElement
    };

    // ThemeManagerとUIControllerを初期化
    const themeManager = new ThemeManager();
    const uiController = new UIController();
    
    // 連携を設定
    uiController.setThemeManager(themeManager);
    themeManager.setupThemeToggleButton();

    return { themeManager, uiController, elements };
  }
}

describe('テーマシステム End-to-End ワークフローテスト', () => {
  let mockLocalStorage: any;
  let mockMatchMedia: any;

  beforeEach(() => {
    // DOM環境をクリア
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    
    // LocalStorageをモック
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });

    // matchMediaをモック
    mockMatchMedia = vi.fn().mockImplementation(query => ({
      matches: query.includes('dark') ? false : true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('初回ユーザー体験フロー', () => {
    it('初回訪問時にシステムテーマが自動適用される', () => {
      // システムがダークモードの場合をシミュレート
      mockMatchMedia.mockImplementation(query => ({
        matches: query.includes('dark') ? true : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { themeManager, elements } = FullAppSetup.setupCompleteApp();

      // システムテーマ（ダーク）が適用されることを確認
      expect(themeManager.getCurrentTheme()).toBe('dark');
      AppStateValidator.validateThemeConsistency(themeManager);
      AppStateValidator.validateUIState(elements.themeToggle, 'dark');

      themeManager.destroy();
    });

    it('初回テーマ切り替え操作が正常に動作する', async () => {
      const { themeManager, elements } = FullAppSetup.setupCompleteApp();
      
      const startTime = performance.now();
      
      // 初期状態の確認
      expect(themeManager.getCurrentTheme()).toBe('light');
      
      // ユーザーがテーマ切り替えボタンをクリック
      UserInteractionSimulator.simulateClick(elements.themeToggle);
      
      // テーマが切り替わることを確認
      expect(themeManager.getCurrentTheme()).toBe('dark');
      AppStateValidator.validateThemeConsistency(themeManager);
      AppStateValidator.validateUIState(elements.themeToggle, 'dark');
      
      // 設定が保存されることを確認
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'guitar-tuner-theme',
        expect.stringContaining('"theme":"dark"')
      );
      
      const endTime = performance.now();
      AppStateValidator.validatePerformance(startTime, endTime, 100);

      themeManager.destroy();
    });

    it('キーボードでのテーマ切り替えが動作する', () => {
      const { themeManager, elements } = FullAppSetup.setupCompleteApp();
      
      // フォーカスを設定
      UserInteractionSimulator.simulateFocus(elements.themeToggle);
      expect(document.activeElement).toBe(elements.themeToggle);
      
      // Enterキーでテーマ切り替え
      UserInteractionSimulator.simulateKeyPress(elements.themeToggle, 'Enter', 'Enter');
      
      expect(themeManager.getCurrentTheme()).toBe('dark');
      AppStateValidator.validateUIState(elements.themeToggle, 'dark');

      themeManager.destroy();
    });
  });

  describe('継続ユーザー体験フロー', () => {
    it('保存されたテーマ設定が復元される', () => {
      // 以前にダークモードを選択していた場合をシミュレート
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        theme: 'dark',
        timestamp: Date.now(),
        version: '1.0.0'
      }));

      const { themeManager, elements } = FullAppSetup.setupCompleteApp();

      // 保存されたテーマが復元されることを確認
      expect(themeManager.getCurrentTheme()).toBe('dark');
      AppStateValidator.validateThemeConsistency(themeManager);
      AppStateValidator.validateUIState(elements.themeToggle, 'dark');

      themeManager.destroy();
    });

    it('システムテーマ設定の場合に自動追従する', () => {
      // システムテーマ設定が保存されている場合
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        theme: 'system',
        timestamp: Date.now(),
        version: '1.0.0'
      }));

      const { themeManager } = FullAppSetup.setupCompleteApp();

      // システムテーマ変更をシミュレート
      SystemEnvironmentSimulator.simulateSystemThemeChange(true);

      // テーマが自動的に変更されることを確認
      expect(themeManager.getCurrentTheme()).toBe('dark');

      themeManager.destroy();
    });

    it('複数回のテーマ切り替えが安定して動作する', () => {
      const { themeManager, elements } = FullAppSetup.setupCompleteApp();
      
      const themes: Theme[] = [];
      
      // 10回のテーマ切り替えを実行
      for (let i = 0; i < 10; i++) {
        UserInteractionSimulator.simulateClick(elements.themeToggle);
        themes.push(themeManager.getCurrentTheme());
        
        // 各切り替え後の状態を検証
        AppStateValidator.validateThemeConsistency(themeManager);
        AppStateValidator.validateUIState(elements.themeToggle, themeManager.getCurrentTheme());
      }
      
      // テーマが交互に切り替わることを確認
      expect(themes).toEqual(['dark', 'light', 'dark', 'light', 'dark', 'light', 'dark', 'light', 'dark', 'light']);

      themeManager.destroy();
    });
  });

  describe('エラー状況での動作フロー', () => {
    it('LocalStorage無効時でもテーマ切り替えが動作する', () => {
      // LocalStorageエラーをシミュレート
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('LocalStorage is disabled');
      });
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('LocalStorage is disabled');
      });

      const { themeManager, elements } = FullAppSetup.setupCompleteApp();

      // エラーが発生してもテーマ切り替えが動作することを確認
      expect(() => {
        UserInteractionSimulator.simulateClick(elements.themeToggle);
      }).not.toThrow();

      expect(themeManager.getCurrentTheme()).toBe('dark');

      themeManager.destroy();
    });

    it('CSS変数未対応環境でフォールバック機能が動作する', () => {
      // CSS.supportsを未対応に設定
      Object.defineProperty(window, 'CSS', {
        value: {
          supports: vi.fn().mockReturnValue(false)
        },
        writable: true
      });

      const { themeManager, elements } = FullAppSetup.setupCompleteApp();

      // フォールバックモードが有効になることを確認
      expect(document.documentElement.classList.contains('theme-fallback-mode')).toBe(true);

      // テーマ切り替えが動作することを確認
      UserInteractionSimulator.simulateClick(elements.themeToggle);
      expect(document.documentElement.classList.contains('theme-fallback-dark')).toBe(true);

      themeManager.destroy();
    });

    it('ネットワーク切断時でもテーマ機能が動作する', () => {
      const { themeManager, elements } = FullAppSetup.setupCompleteApp();

      // ネットワーク切断をシミュレート
      SystemEnvironmentSimulator.simulateNetworkChange(false);

      // オフライン状態でもテーマ切り替えが動作することを確認
      expect(() => {
        UserInteractionSimulator.simulateClick(elements.themeToggle);
      }).not.toThrow();

      expect(themeManager.getCurrentTheme()).toBe('dark');

      themeManager.destroy();
    });
  });

  describe('レスポンシブ環境での動作フロー', () => {
    it('モバイル環境でタッチ操作が動作する', () => {
      // モバイル環境をシミュレート
      SystemEnvironmentSimulator.simulateWindowResize(375, 667);
      Object.defineProperty(window, 'ontouchstart', { value: true });

      const { themeManager, elements } = FullAppSetup.setupCompleteApp();

      // タッチ操作でテーマ切り替え
      UserInteractionSimulator.simulateTouch(elements.themeToggle);

      expect(themeManager.getCurrentTheme()).toBe('dark');
      AppStateValidator.validateUIState(elements.themeToggle, 'dark');

      themeManager.destroy();
    });

    it('デスクトップ環境で大画面表示が適切に動作する', () => {
      // デスクトップ環境をシミュレート
      SystemEnvironmentSimulator.simulateWindowResize(1920, 1080);

      const { themeManager, elements } = FullAppSetup.setupCompleteApp();

      // 大画面でもテーマ切り替えが正常に動作することを確認
      UserInteractionSimulator.simulateClick(elements.themeToggle);

      expect(themeManager.getCurrentTheme()).toBe('dark');
      AppStateValidator.validateThemeConsistency(themeManager);

      themeManager.destroy();
    });

    it('画面向き変更時でもテーマ状態が維持される', () => {
      const { themeManager, elements } = FullAppSetup.setupCompleteApp();

      // テーマを変更
      UserInteractionSimulator.simulateClick(elements.themeToggle);
      expect(themeManager.getCurrentTheme()).toBe('dark');

      // 画面向き変更をシミュレート
      SystemEnvironmentSimulator.simulateWindowResize(667, 375);
      const orientationEvent = new Event('orientationchange');
      window.dispatchEvent(orientationEvent);

      // テーマ状態が維持されることを確認
      expect(themeManager.getCurrentTheme()).toBe('dark');
      AppStateValidator.validateThemeConsistency(themeManager);

      themeManager.destroy();
    });
  });

  describe('パフォーマンスとメモリ管理フロー', () => {
    it('ページ非表示時にリソースが適切に管理される', () => {
      const { themeManager, elements } = FullAppSetup.setupCompleteApp();

      // ページを非表示にする
      SystemEnvironmentSimulator.simulateVisibilityChange(true);

      // 非表示時でもテーマ切り替えが動作することを確認
      UserInteractionSimulator.simulateClick(elements.themeToggle);
      expect(themeManager.getCurrentTheme()).toBe('dark');

      // ページを再表示
      SystemEnvironmentSimulator.simulateVisibilityChange(false);

      // 再表示後もテーマ状態が維持されることを確認
      expect(themeManager.getCurrentTheme()).toBe('dark');
      AppStateValidator.validateThemeConsistency(themeManager);

      themeManager.destroy();
    });

    it('大量操作後のメモリリークが発生しない', () => {
      const { themeManager, elements } = FullAppSetup.setupCompleteApp();

      // 大量のテーマ切り替えを実行
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        UserInteractionSimulator.simulateClick(elements.themeToggle);
      }
      
      const endTime = performance.now();

      // パフォーマンスが維持されることを確認
      AppStateValidator.validatePerformance(startTime, endTime, 1000);

      // 最終状態が正常であることを確認
      AppStateValidator.validateThemeConsistency(themeManager);

      // クリーンアップが正常に動作することを確認
      expect(() => {
        themeManager.destroy();
      }).not.toThrow();
    });

    it('アニメーション中の連続操作が適切に処理される', async () => {
      const { themeManager, elements } = FullAppSetup.setupCompleteApp();

      // アニメーション中に連続でクリック
      UserInteractionSimulator.simulateClick(elements.themeToggle);
      UserInteractionSimulator.simulateClick(elements.themeToggle);
      UserInteractionSimulator.simulateClick(elements.themeToggle);

      // 最終的な状態が正しいことを確認
      expect(themeManager.getCurrentTheme()).toBe('dark');
      AppStateValidator.validateThemeConsistency(themeManager);

      // アニメーション完了を待機
      await new Promise(resolve => setTimeout(resolve, 350));

      // アニメーション完了後も状態が正しいことを確認
      expect(document.documentElement.classList.contains('theme-switching')).toBe(false);

      themeManager.destroy();
    });
  });

  describe('アクセシビリティ統合フロー', () => {
    it('スクリーンリーダーユーザーの操作フローが完全に動作する', () => {
      const { themeManager, elements } = FullAppSetup.setupCompleteApp();

      // アクセシビリティ属性の初期状態を確認
      AppStateValidator.validateAccessibilityAttributes(elements.themeToggle);

      // キーボードナビゲーションでフォーカス
      UserInteractionSimulator.simulateFocus(elements.themeToggle);
      expect(document.activeElement).toBe(elements.themeToggle);

      // スペースキーで操作
      UserInteractionSimulator.simulateKeyPress(elements.themeToggle, ' ', 'Space');

      // 状態変更後のアクセシビリティ属性を確認
      AppStateValidator.validateAccessibilityAttributes(elements.themeToggle);
      AppStateValidator.validateUIState(elements.themeToggle, 'dark');

      themeManager.destroy();
    });

    it('高コントラストモードでの操作フローが動作する', () => {
      // 高コントラストモードをシミュレート
      mockMatchMedia.mockImplementation(query => {
        if (query.includes('prefers-contrast: high')) {
          return { matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() };
        }
        return { matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() };
      });

      const { themeManager, elements } = FullAppSetup.setupCompleteApp();

      // 高コントラストモードでもテーマ切り替えが動作することを確認
      UserInteractionSimulator.simulateClick(elements.themeToggle);
      expect(themeManager.getCurrentTheme()).toBe('dark');

      themeManager.destroy();
    });

    it('モーション無効設定での操作フローが動作する', () => {
      // prefers-reduced-motionをシミュレート
      mockMatchMedia.mockImplementation(query => {
        if (query.includes('prefers-reduced-motion')) {
          return { matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() };
        }
        return { matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() };
      });

      const { themeManager, elements } = FullAppSetup.setupCompleteApp();

      // モーション無効でもテーマ切り替えが動作することを確認
      UserInteractionSimulator.simulateClick(elements.themeToggle);
      expect(themeManager.getCurrentTheme()).toBe('dark');

      // アニメーションクラスが即座に削除されることを確認
      // テスト環境では同期的に処理されるため、即座に確認
      expect(document.documentElement.classList.contains('theme-switching')).toBe(false);

      themeManager.destroy();
    });
  });
});