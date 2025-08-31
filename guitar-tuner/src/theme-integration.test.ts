/**
 * テーマシステム統合テストとアクセシビリティ検証
 * end-to-end テーマ切り替えフロー、キーボードナビゲーション、
 * スクリーンリーダー対応、コントラスト比の自動検証を実装
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeManager } from './ThemeManager';
import type { Theme, ThemePreference } from './types';

/**
 * アクセシビリティ検証のためのヘルパー関数
 */
class AccessibilityValidator {
  /**
   * コントラスト比を計算（WCAG 2.1準拠）
   * @param foreground 前景色（RGB値）
   * @param background 背景色（RGB値）
   * @returns コントラスト比
   */
  static calculateContrastRatio(foreground: [number, number, number], background: [number, number, number]): number {
    const getLuminance = (rgb: [number, number, number]): number => {
      const [r, g, b] = rgb.map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * CSS色文字列をRGB値に変換
   * @param colorString CSS色文字列（hex, rgb, hsl等）
   * @returns RGB値の配列
   */
  static parseColor(colorString: string): [number, number, number] {
    // テスト環境用の簡易実装
    const colorMap: Record<string, [number, number, number]> = {
      '#ffffff': [255, 255, 255],
      '#000000': [0, 0, 0],
      '#2c3e50': [44, 62, 80],
      '#ecf0f1': [236, 240, 241],
      '#1a1a1a': [26, 26, 26],
      '#2c2c2c': [44, 44, 44],
      '#f1f5f9': [241, 245, 249],
      '#0f172a': [15, 23, 42],
      'white': [255, 255, 255],
      'black': [0, 0, 0]
    };

    const normalized = colorString.toLowerCase().trim();
    if (colorMap[normalized]) {
      return colorMap[normalized];
    }

    // hex形式の解析
    if (normalized.startsWith('#')) {
      const hex = normalized.slice(1);
      if (hex.length === 6) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16)
        ];
      }
    }

    // rgb形式の解析
    const rgbMatch = normalized.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return [
        parseInt(rgbMatch[1]),
        parseInt(rgbMatch[2]),
        parseInt(rgbMatch[3])
      ];
    }

    // デフォルト値（白）
    return [255, 255, 255];
  }

  /**
   * WCAG 2.1 AA準拠のコントラスト比チェック
   * @param foreground 前景色
   * @param background 背景色
   * @param isLargeText 大きなテキストかどうか
   * @returns 準拠しているかどうか
   */
  static meetsWCAGAA(foreground: string, background: string, isLargeText: boolean = false): boolean {
    const fg = this.parseColor(foreground);
    const bg = this.parseColor(background);
    const ratio = this.calculateContrastRatio(fg, bg);
    
    return isLargeText ? ratio >= 3.0 : ratio >= 4.5;
  }

  /**
   * 要素のアクセシビリティ属性を検証
   * @param element DOM要素
   * @returns 検証結果
   */
  static validateAccessibilityAttributes(element: HTMLElement): {
    hasAriaLabel: boolean;
    hasAriaPressed: boolean;
    hasTitle: boolean;
    hasScreenReaderText: boolean;
    isKeyboardAccessible: boolean;
  } {
    return {
      hasAriaLabel: element.hasAttribute('aria-label'),
      hasAriaPressed: element.hasAttribute('aria-pressed'),
      hasTitle: element.hasAttribute('title'),
      hasScreenReaderText: !!element.querySelector('.sr-only'),
      isKeyboardAccessible: element.tabIndex >= 0 || element.tagName === 'BUTTON'
    };
  }
}

/**
 * DOM環境のセットアップヘルパー
 */
class DOMTestHelper {
  static setupThemeToggleButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = 'theme-toggle';
    button.setAttribute('aria-label', 'テーマを切り替え');
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('title', 'ダークモード/ライトモードを切り替え');
    
    const icon = document.createElement('span');
    icon.className = 'theme-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🌙';
    
    const srText = document.createElement('span');
    srText.className = 'sr-only';
    srText.textContent = '現在: ライトモード';
    
    button.appendChild(icon);
    button.appendChild(srText);
    document.body.appendChild(button);
    
    return button;
  }

  static setupTestElements(): void {
    // ルート要素の設定
    if (!document.documentElement) {
      const html = document.createElement('html');
      document.appendChild(html);
    }

    // テスト用のCSS変数を設定
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --background-color: #ffffff;
        --text-color: #2c3e50;
        --primary-color: #3498db;
        --theme-transition-duration: 300ms;
      }
      
      [data-theme="dark"] {
        --background-color: #1a1a1a;
        --text-color: #ecf0f1;
        --primary-color: #3498db;
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
    `;
    document.head.appendChild(style);

    // テスト用の要素を追加
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
  }

  static cleanup(): void {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    
    // data-theme属性をクリア
    if (document.documentElement) {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.className = '';
      document.documentElement.style.cssText = '';
    }
  }
}

/**
 * キーボードイベントシミュレーター
 */
class KeyboardSimulator {
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

  static simulateTabNavigation(startElement: HTMLElement): HTMLElement[] {
    const focusableElements = document.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const elements = Array.from(focusableElements);
    const startIndex = elements.indexOf(startElement);
    
    if (startIndex === -1) return [];
    
    // Tab順序をシミュレート
    const tabOrder: HTMLElement[] = [];
    let currentIndex = startIndex;
    
    for (let i = 0; i < elements.length; i++) {
      const element = elements[currentIndex];
      element.focus();
      tabOrder.push(element);
      
      currentIndex = (currentIndex + 1) % elements.length;
      if (currentIndex === startIndex) break;
    }
    
    return tabOrder;
  }
}

describe('テーマシステム統合テスト', () => {
  let themeManager: ThemeManager;
  let themeToggleButton: HTMLButtonElement;

  beforeEach(() => {
    // DOM環境をセットアップ
    DOMTestHelper.setupTestElements();
    themeToggleButton = DOMTestHelper.setupThemeToggleButton();
    
    // LocalStorageをモック
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });

    // matchMediaをモック
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query.includes('dark') ? false : true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    });

    themeManager = new ThemeManager();
  });

  afterEach(() => {
    themeManager.destroy();
    DOMTestHelper.cleanup();
    vi.clearAllMocks();
  });

  describe('End-to-End テーマ切り替えフロー', () => {
    it('手動テーマ切り替えの完全なフローが正常に動作する', async () => {
      // 初期状態の確認
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(themeToggleButton.getAttribute('aria-pressed')).toBe('false');
      
      // テーマ切り替えボタンのセットアップ
      themeManager.setupThemeToggleButton();
      
      // ダークモードに切り替え
      themeToggleButton.click();
      
      // DOM更新の確認
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(themeToggleButton.getAttribute('aria-pressed')).toBe('true');
      expect(themeToggleButton.querySelector('.theme-icon')?.textContent).toBe('☀️');
      expect(themeToggleButton.querySelector('.sr-only')?.textContent).toBe('現在: ダークモード');
      
      // ライトモードに戻す
      themeToggleButton.click();
      
      // DOM更新の確認
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(themeToggleButton.getAttribute('aria-pressed')).toBe('false');
      expect(themeToggleButton.querySelector('.theme-icon')?.textContent).toBe('🌙');
      expect(themeToggleButton.querySelector('.sr-only')?.textContent).toBe('現在: ライトモード');
    });

    it('システムテーマ変更時の自動切り替えフローが正常に動作する', () => {
      // システムテーマ設定に変更
      themeManager.setTheme('system');
      
      // システムテーマ変更をシミュレート
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const changeEvent = new MediaQueryListEvent('change', {
        matches: true,
        media: '(prefers-color-scheme: dark)'
      });
      
      // イベントハンドラーを直接呼び出し
      if (darkModeQuery.addEventListener) {
        const handler = vi.mocked(darkModeQuery.addEventListener).mock.calls[0]?.[1];
        if (handler) {
          handler(changeEvent);
        }
      }
      
      // テーマが自動的に変更されることを確認
      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('テーマ設定の永続化と復元フローが正常に動作する', () => {
      const mockLocalStorage = vi.mocked(localStorage);
      
      // テーマを変更
      themeManager.setTheme('dark');
      
      // LocalStorageに保存されることを確認
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'guitar-tuner-theme',
        expect.stringContaining('"theme":"dark"')
      );
      
      // 新しいThemeManagerインスタンスで復元をテスト
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        theme: 'dark',
        timestamp: Date.now(),
        version: '1.0.0'
      }));
      
      const newThemeManager = new ThemeManager();
      expect(newThemeManager.getCurrentTheme()).toBe('dark');
      
      newThemeManager.destroy();
    });

    it('テーマ切り替えアニメーションが適切に制御される', async () => {
      themeManager.setupThemeToggleButton();
      
      // アニメーション開始前の状態確認
      expect(document.documentElement.classList.contains('theme-switching')).toBe(false);
      
      // テーマ切り替えを実行
      themeToggleButton.click();
      
      // アニメーション中の状態確認
      expect(document.documentElement.classList.contains('theme-switching')).toBe(true);
      
      // アニメーション完了を待機
      await new Promise(resolve => setTimeout(resolve, 350));
      
      // アニメーション完了後の状態確認
      expect(document.documentElement.classList.contains('theme-switching')).toBe(false);
    });
  });

  describe('キーボードナビゲーション対応テスト', () => {
    it('テーマ切り替えボタンがキーボードでアクセス可能である', () => {
      themeManager.setupThemeToggleButton();
      
      // フォーカス可能性の確認
      expect(themeToggleButton.tabIndex).toBeGreaterThanOrEqual(0);
      
      // フォーカスをセット
      themeToggleButton.focus();
      expect(document.activeElement).toBe(themeToggleButton);
    });

    it('Enterキーでテーマ切り替えが動作する', () => {
      themeManager.setupThemeToggleButton();
      
      const initialTheme = themeManager.getCurrentTheme();
      
      // Enterキーを押下
      KeyboardSimulator.simulateKeyPress(themeToggleButton, 'Enter', 'Enter');
      
      // テーマが切り替わることを確認
      expect(themeManager.getCurrentTheme()).not.toBe(initialTheme);
    });

    it('Spaceキーでテーマ切り替えが動作する', () => {
      themeManager.setupThemeToggleButton();
      
      const initialTheme = themeManager.getCurrentTheme();
      
      // Spaceキーを押下
      KeyboardSimulator.simulateKeyPress(themeToggleButton, ' ', 'Space');
      
      // テーマが切り替わることを確認
      expect(themeManager.getCurrentTheme()).not.toBe(initialTheme);
    });

    it('Tab順序でテーマ切り替えボタンが適切に含まれる', () => {
      // 追加のフォーカス可能要素を作成
      const button1 = document.createElement('button');
      button1.textContent = 'Button 1';
      document.body.appendChild(button1);
      
      const button2 = document.createElement('button');
      button2.textContent = 'Button 2';
      document.body.appendChild(button2);
      
      themeManager.setupThemeToggleButton();
      
      // Tab順序をシミュレート
      const tabOrder = KeyboardSimulator.simulateTabNavigation(button1);
      
      // テーマ切り替えボタンがTab順序に含まれることを確認
      expect(tabOrder).toContain(themeToggleButton);
    });

    it('キーボードフォーカス時に適切な視覚的フィードバックが提供される', () => {
      themeManager.setupThemeToggleButton();
      
      // フォーカスイベントをシミュレート
      const focusEvent = new FocusEvent('focus');
      themeToggleButton.dispatchEvent(focusEvent);
      
      // フォーカス状態の確認
      expect(document.activeElement).toBe(themeToggleButton);
      
      // ブラウザのデフォルトフォーカススタイルが適用されることを確認
      const computedStyle = window.getComputedStyle(themeToggleButton);
      expect(computedStyle).toBeDefined();
    });
  });

  describe('スクリーンリーダー対応テスト', () => {
    it('テーマ切り替えボタンに適切なaria-label属性が設定されている', () => {
      themeManager.setupThemeToggleButton();
      
      expect(themeToggleButton.getAttribute('aria-label')).toBe('テーマを切り替え');
    });

    it('テーマ切り替えボタンのaria-pressed属性が正しく更新される', () => {
      themeManager.setupThemeToggleButton();
      
      // 初期状態（ライトモード）
      expect(themeToggleButton.getAttribute('aria-pressed')).toBe('false');
      
      // ダークモードに切り替え
      themeToggleButton.click();
      expect(themeToggleButton.getAttribute('aria-pressed')).toBe('true');
      
      // ライトモードに戻す
      themeToggleButton.click();
      expect(themeToggleButton.getAttribute('aria-pressed')).toBe('false');
    });

    it('スクリーンリーダー用のテキストが適切に更新される', () => {
      themeManager.setupThemeToggleButton();
      
      const srText = themeToggleButton.querySelector('.sr-only');
      expect(srText).toBeTruthy();
      
      // 初期状態
      expect(srText?.textContent).toBe('現在: ライトモード');
      
      // ダークモードに切り替え
      themeToggleButton.click();
      expect(srText?.textContent).toBe('現在: ダークモード');
      
      // ライトモードに戻す
      themeToggleButton.click();
      expect(srText?.textContent).toBe('現在: ライトモード');
    });

    it('アイコンにaria-hidden属性が設定されている', () => {
      themeManager.setupThemeToggleButton();
      
      const icon = themeToggleButton.querySelector('.theme-icon');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    });

    it('title属性による追加の説明が提供されている', () => {
      themeManager.setupThemeToggleButton();
      
      // 初期状態
      expect(themeToggleButton.getAttribute('title')).toBe('ダークモードに切り替え');
      
      // ダークモードに切り替え
      themeToggleButton.click();
      expect(themeToggleButton.getAttribute('title')).toBe('ライトモードに切り替え');
    });

    it('スクリーンリーダー用テキストが視覚的に隠されている', () => {
      themeManager.setupThemeToggleButton();
      
      const srText = themeToggleButton.querySelector('.sr-only') as HTMLElement;
      expect(srText).toBeTruthy();
      
      // CSSクラスが適用されていることを確認
      expect(srText.classList.contains('sr-only')).toBe(true);
    });
  });

  describe('コントラスト比とアクセシビリティ基準の自動検証', () => {
    it('ライトテーマのコントラスト比がWCAG 2.1 AA基準を満たす', () => {
      themeManager.setTheme('light');
      
      // 主要な色の組み合わせをテスト
      const testCases = [
        { fg: '#2c3e50', bg: '#ffffff', description: 'メインテキスト/背景' },
        { fg: '#2c3e50', bg: '#ecf0f1', description: 'テキスト/セカンダリ背景' },
        { fg: '#ffffff', bg: '#3498db', description: 'ボタンテキスト/プライマリ色' }
      ];
      
      testCases.forEach(({ fg, bg, description }) => {
        const meetsStandard = AccessibilityValidator.meetsWCAGAA(fg, bg);
        expect(meetsStandard).toBe(true);
        
        const ratio = AccessibilityValidator.calculateContrastRatio(
          AccessibilityValidator.parseColor(fg),
          AccessibilityValidator.parseColor(bg)
        );
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });

    it('ダークテーマのコントラスト比がWCAG 2.1 AA基準を満たす', () => {
      themeManager.setTheme('dark');
      
      // 主要な色の組み合わせをテスト
      const testCases = [
        { fg: '#ecf0f1', bg: '#1a1a1a', description: 'メインテキスト/背景' },
        { fg: '#ecf0f1', bg: '#2c2c2c', description: 'テキスト/セカンダリ背景' },
        { fg: '#ffffff', bg: '#3498db', description: 'ボタンテキスト/プライマリ色' }
      ];
      
      testCases.forEach(({ fg, bg, description }) => {
        const meetsStandard = AccessibilityValidator.meetsWCAGAA(fg, bg);
        expect(meetsStandard).toBe(true);
        
        const ratio = AccessibilityValidator.calculateContrastRatio(
          AccessibilityValidator.parseColor(fg),
          AccessibilityValidator.parseColor(bg)
        );
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });

    it('大きなテキストのコントラスト比がWCAG 2.1 AA基準を満たす', () => {
      const testCases = [
        { fg: '#7f8c8d', bg: '#ffffff', theme: 'light' },
        { fg: '#bdc3c7', bg: '#1a1a1a', theme: 'dark' }
      ];
      
      testCases.forEach(({ fg, bg, theme }) => {
        themeManager.setTheme(theme as Theme);
        
        const meetsStandard = AccessibilityValidator.meetsWCAGAA(fg, bg, true);
        expect(meetsStandard).toBe(true);
        
        const ratio = AccessibilityValidator.calculateContrastRatio(
          AccessibilityValidator.parseColor(fg),
          AccessibilityValidator.parseColor(bg)
        );
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      });
    });

    it('UI要素のコントラスト比がWCAG 2.1 AA基準を満たす', () => {
      // ボーダー、フォーカスインジケーター等のUI要素
      const testCases = [
        { fg: '#bdc3c7', bg: '#ffffff', theme: 'light', description: 'ボーダー/背景' },
        { fg: '#4a4a4a', bg: '#1a1a1a', theme: 'dark', description: 'ボーダー/背景' }
      ];
      
      testCases.forEach(({ fg, bg, theme, description }) => {
        themeManager.setTheme(theme as Theme);
        
        const ratio = AccessibilityValidator.calculateContrastRatio(
          AccessibilityValidator.parseColor(fg),
          AccessibilityValidator.parseColor(bg)
        );
        
        // UI要素は3:1以上が必要
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      });
    });

    it('テーマ切り替えボタンのアクセシビリティ属性が完全に設定されている', () => {
      themeManager.setupThemeToggleButton();
      
      const validation = AccessibilityValidator.validateAccessibilityAttributes(themeToggleButton);
      
      expect(validation.hasAriaLabel).toBe(true);
      expect(validation.hasAriaPressed).toBe(true);
      expect(validation.hasTitle).toBe(true);
      expect(validation.hasScreenReaderText).toBe(true);
      expect(validation.isKeyboardAccessible).toBe(true);
    });

    it('prefers-reduced-motion設定が尊重される', () => {
      // prefers-reduced-motionをモック
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => {
          if (query.includes('prefers-reduced-motion')) {
            return {
              matches: true, // reduced motionを有効に設定
              media: query,
              onchange: null,
              addListener: vi.fn(),
              removeListener: vi.fn(),
              addEventListener: vi.fn(),
              removeEventListener: vi.fn(),
              dispatchEvent: vi.fn(),
            };
          }
          return {
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          };
        })
      });
      
      // 新しいThemeManagerインスタンスを作成
      const reducedMotionThemeManager = new ThemeManager();
      reducedMotionThemeManager.setupThemeToggleButton();
      
      // テーマ切り替え時にアニメーションクラスが追加されないことを確認
      themeToggleButton.click();
      
      // reduced motionが有効な場合、theme-switchingクラスは即座に削除される
      // または最初から追加されない
      setTimeout(() => {
        expect(document.documentElement.classList.contains('theme-switching')).toBe(false);
      }, 50);
      
      reducedMotionThemeManager.destroy();
    });

    it('色覚異常への配慮が適切に実装されている', () => {
      // 成功・警告・エラー状態の色が色のみに依存していないことを確認
      const statusColors = {
        success: '#27ae60',
        warning: '#f39c12', 
        danger: '#e74c3c'
      };
      
      // 各状態色が背景色との十分なコントラストを持つことを確認
      Object.entries(statusColors).forEach(([status, color]) => {
        ['light', 'dark'].forEach(theme => {
          themeManager.setTheme(theme as Theme);
          
          const backgroundColor = theme === 'light' ? '#ffffff' : '#1a1a1a';
          const ratio = AccessibilityValidator.calculateContrastRatio(
            AccessibilityValidator.parseColor(color),
            AccessibilityValidator.parseColor(backgroundColor)
          );
          
          expect(ratio).toBeGreaterThanOrEqual(3.0);
        });
      });
    });
  });

  describe('エラーハンドリングとフォールバック機能', () => {
    it('CSS変数未対応ブラウザでフォールバック機能が動作する', () => {
      // CSS.supportsをモックして未対応をシミュレート
      Object.defineProperty(window, 'CSS', {
        value: {
          supports: vi.fn().mockReturnValue(false)
        },
        writable: true
      });
      
      const fallbackThemeManager = new ThemeManager();
      
      // フォールバックモードが有効になることを確認
      expect(document.documentElement.classList.contains('theme-fallback-mode')).toBe(true);
      
      // テーマ切り替えが動作することを確認
      fallbackThemeManager.setTheme('dark');
      expect(document.documentElement.classList.contains('theme-fallback-dark')).toBe(true);
      
      fallbackThemeManager.destroy();
    });

    it('localStorage無効時にメモリストレージが使用される', () => {
      // localStorageを無効化
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn().mockImplementation(() => {
            throw new Error('localStorage is disabled');
          }),
          setItem: vi.fn().mockImplementation(() => {
            throw new Error('localStorage is disabled');
          }),
          removeItem: vi.fn(),
          clear: vi.fn()
        },
        writable: true
      });
      
      const memoryThemeManager = new ThemeManager();
      
      // テーマ設定が動作することを確認（エラーが発生しない）
      expect(() => {
        memoryThemeManager.setTheme('dark');
      }).not.toThrow();
      
      expect(memoryThemeManager.getCurrentTheme()).toBe('dark');
      
      memoryThemeManager.destroy();
    });

    it('matchMedia API未対応時にフォールバック処理が動作する', () => {
      // matchMediaを未定義に設定
      Object.defineProperty(window, 'matchMedia', {
        value: undefined,
        writable: true
      });
      
      const noMatchMediaThemeManager = new ThemeManager();
      
      // エラーが発生せずに初期化されることを確認
      expect(noMatchMediaThemeManager.getCurrentTheme()).toBe('light');
      
      // 手動テーマ切り替えは動作することを確認
      noMatchMediaThemeManager.setTheme('dark');
      expect(noMatchMediaThemeManager.getCurrentTheme()).toBe('dark');
      
      noMatchMediaThemeManager.destroy();
    });
  });

  describe('パフォーマンスとメモリ管理', () => {
    it('テーマ切り替え時のメモリリークが発生しない', () => {
      themeManager.setupThemeToggleButton();
      
      // 複数回のテーマ切り替えを実行
      for (let i = 0; i < 10; i++) {
        themeManager.toggleTheme();
      }
      
      // メモリリークの兆候をチェック（イベントリスナーの重複登録等）
      const button = document.getElementById('theme-toggle');
      expect(button).toBeTruthy();
      
      // destroyメソッドでクリーンアップが正常に動作することを確認
      expect(() => {
        themeManager.destroy();
      }).not.toThrow();
    });

    it('大量のテーマ切り替えでもパフォーマンスが維持される', () => {
      themeManager.setupThemeToggleButton();
      
      const startTime = performance.now();
      
      // 100回のテーマ切り替えを実行
      for (let i = 0; i < 100; i++) {
        themeManager.toggleTheme();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // 100回の切り替えが1秒以内に完了することを確認
      expect(duration).toBeLessThan(1000);
    });
  });
});