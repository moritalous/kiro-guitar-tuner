/**
 * ThemeManager フォールバック機能とエラーハンドリングのテスト
 * ブラウザサポート検出、LocalStorage無効時の処理、CSS変数未対応ブラウザでの動作をテスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeManager } from './ThemeManager';

// DOM環境のモック
const mockDocument = {
  documentElement: {
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    hasAttribute: vi.fn(),
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn()
    },
    style: {
      setProperty: vi.fn(),
      getPropertyValue: vi.fn(),
      removeProperty: vi.fn(),
      colorScheme: ''
    }
  },
  createElement: vi.fn(() => ({
    style: {
      setProperty: vi.fn(),
      getPropertyValue: vi.fn()
    }
  })),
  querySelectorAll: vi.fn(() => [])
};

const mockWindow = {
  matchMedia: vi.fn(),
  localStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  },
  getComputedStyle: vi.fn(),
  CSS: {
    supports: vi.fn()
  }
};

describe('ThemeManager - エラーハンドリングとフォールバック機能', () => {
  let themeManager: ThemeManager;
  let originalWindow: any;
  let originalDocument: any;

  beforeEach(() => {
    // グローバルオブジェクトのモック
    originalWindow = global.window;
    originalDocument = global.document;
    
    // モック関数のリセット
    vi.clearAllMocks();
    
    // mockWindowの再初期化
    mockWindow.matchMedia = vi.fn();
    mockWindow.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    mockWindow.getComputedStyle = vi.fn();
    mockWindow.CSS = {
      supports: vi.fn()
    };
    
    // mockDocumentの再初期化
    mockDocument.documentElement = {
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      hasAttribute: vi.fn(),
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn()
      },
      style: {
        setProperty: vi.fn(),
        getPropertyValue: vi.fn(),
        removeProperty: vi.fn(),
        colorScheme: ''
      }
    };
    mockDocument.createElement = vi.fn(() => ({
      style: {
        setProperty: vi.fn(),
        getPropertyValue: vi.fn()
      }
    }));
    mockDocument.querySelectorAll = vi.fn(() => []);
    mockDocument.querySelector = vi.fn();
    
    // @ts-ignore
    global.window = mockWindow;
    // @ts-ignore
    global.document = mockDocument;
  });

  afterEach(() => {
    // グローバルオブジェクトの復元
    global.window = originalWindow;
    global.document = originalDocument;
    
    // ThemeManagerのクリーンアップ
    if (themeManager) {
      themeManager.destroy();
    }
  });

  describe('ブラウザサポート検出', () => {
    it('CSS変数サポートを正しく検出する', () => {
      // CSS.supportsが利用可能な場合
      mockWindow.CSS.supports.mockReturnValue(true);
      
      themeManager = new ThemeManager();
      const support = themeManager.getBrowserSupport();
      
      expect(support.cssVariables).toBe(true);
      expect(mockWindow.CSS.supports).toHaveBeenCalledWith('--test-var', 'red');
    });

    it('CSS.supports未対応時の代替検出を実行する', () => {
      // CSS.supportsが未対応の場合
      mockWindow.CSS = undefined;
      
      const mockElement = {
        style: {
          setProperty: vi.fn(),
          getPropertyValue: vi.fn().mockReturnValue('red')
        }
      };
      mockDocument.createElement.mockReturnValue(mockElement);
      
      themeManager = new ThemeManager();
      const support = themeManager.getBrowserSupport();
      
      expect(support.cssVariables).toBe(true);
      expect(mockElement.style.setProperty).toHaveBeenCalledWith('--test-var', 'red');
      expect(mockElement.style.getPropertyValue).toHaveBeenCalledWith('--test-var');
    });

    it('matchMedia APIサポートを正しく検出する', () => {
      mockWindow.matchMedia = vi.fn();
      
      themeManager = new ThemeManager();
      const support = themeManager.getBrowserSupport();
      
      expect(support.matchMedia).toBe(true);
    });

    it('matchMedia API未対応を正しく検出する', () => {
      mockWindow.matchMedia = undefined;
      
      themeManager = new ThemeManager();
      const support = themeManager.getBrowserSupport();
      
      expect(support.matchMedia).toBe(false);
    });

    it('localStorage サポートを正しく検出する', () => {
      mockWindow.localStorage.setItem.mockImplementation(() => {});
      mockWindow.localStorage.getItem.mockReturnValue('test');
      mockWindow.localStorage.removeItem.mockImplementation(() => {});
      
      themeManager = new ThemeManager();
      const support = themeManager.getBrowserSupport();
      
      expect(support.localStorage).toBe(true);
      expect(mockWindow.localStorage.setItem).toHaveBeenCalledWith('__theme_manager_test__', 'test');
      expect(mockWindow.localStorage.getItem).toHaveBeenCalledWith('__theme_manager_test__');
      expect(mockWindow.localStorage.removeItem).toHaveBeenCalledWith('__theme_manager_test__');
    });

    it('localStorage 無効時（プライベートモード）を正しく検出する', () => {
      mockWindow.localStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage disabled');
      });
      
      themeManager = new ThemeManager();
      const support = themeManager.getBrowserSupport();
      
      expect(support.localStorage).toBe(false);
    });

    it('prefers-color-scheme サポートを正しく検出する', () => {
      const mockMediaQuery = {
        media: '(prefers-color-scheme: dark)',
        matches: false
      };
      mockWindow.matchMedia.mockReturnValue(mockMediaQuery);
      
      themeManager = new ThemeManager();
      const support = themeManager.getBrowserSupport();
      
      expect(support.prefersColorScheme).toBe(true);
      expect(mockWindow.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    });

    it('modern event listeners サポートを正しく検出する', () => {
      const mockMediaQuery = {
        addEventListener: vi.fn(),
        media: '(min-width: 1px)'
      };
      mockWindow.matchMedia.mockReturnValue(mockMediaQuery);
      
      themeManager = new ThemeManager();
      const support = themeManager.getBrowserSupport();
      
      expect(support.modernEventListeners).toBe(true);
    });
  });

  describe('LocalStorage フォールバック処理', () => {
    beforeEach(() => {
      // CSS変数は対応、LocalStorageは無効の状態
      mockWindow.CSS.supports.mockReturnValue(true);
      mockWindow.localStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage disabled');
      });
      mockWindow.localStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage disabled');
      });
    });

    it('localStorage無効時にメモリストレージを使用する', () => {
      themeManager = new ThemeManager();
      
      // テーマを設定
      themeManager.setTheme('dark');
      
      // メモリストレージから読み込めることを確認
      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('dark');
    });

    it('localStorage容量不足時に古いデータをクリアして再試行する', () => {
      // CSS変数は対応、LocalStorageは対応の状態に設定
      mockWindow.CSS.supports.mockReturnValue(true);
      
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      // DOMExceptionのnameプロパティは読み取り専用なので、Object.definePropertyを使用
      Object.defineProperty(quotaError, 'name', {
        value: 'QuotaExceededError',
        writable: false,
        enumerable: true,
        configurable: true
      });
      
      // 初回のsetItemでエラー、2回目は成功
      mockWindow.localStorage.setItem
        .mockImplementationOnce(() => { throw quotaError; })
        .mockImplementationOnce(() => {}); // 再試行時は成功
      
      mockWindow.localStorage.removeItem.mockImplementation(() => {});
      
      themeManager = new ThemeManager();
      
      // setTheme を呼び出してlocalStorage容量不足エラーを発生させる
      themeManager.setTheme('dark');
      
      // 古いキーの削除が実行されることを確認
      expect(mockWindow.localStorage.removeItem).toHaveBeenCalledWith('theme-preference');
      expect(mockWindow.localStorage.removeItem).toHaveBeenCalledWith('guitar-tuner-theme-old');
      
      // 再試行でsetItemが呼ばれることを確認（初期化時 + setTheme時 + 再試行）
      expect(mockWindow.localStorage.setItem).toHaveBeenCalledTimes(3);
    });

    it('フォールバックストレージからの読み込みを実行する', () => {
      // CSS変数は対応、LocalStorageは対応の状態に設定
      mockWindow.CSS.supports.mockReturnValue(true);
      mockWindow.localStorage.setItem.mockImplementation(() => {});
      
      // getItemの呼び出し順序：
      // 1. ブラウザサポート検出時のテスト呼び出し
      // 2. loadSavedTheme時のメインキー呼び出し
      // 3. loadFromFallbackStorage時のフォールバックキー呼び出し
      mockWindow.localStorage.getItem
        .mockReturnValueOnce('test') // ブラウザサポート検出時
        .mockReturnValueOnce(null)   // メインキーは見つからない
        .mockReturnValueOnce('dark'); // フォールバックキーは見つかる
      
      themeManager = new ThemeManager();
      
      expect(themeManager.getThemePreference()).toBe('dark');
      expect(mockWindow.localStorage.getItem).toHaveBeenCalledWith('guitar-tuner-theme');
      expect(mockWindow.localStorage.getItem).toHaveBeenCalledWith('gt-theme-fallback');
    });
  });

  describe('CSS変数未対応ブラウザでのフォールバック', () => {
    beforeEach(() => {
      // CSS変数未対応の状態
      mockWindow.CSS.supports.mockReturnValue(false);
      mockWindow.matchMedia.mockReturnValue({
        matches: false,
        media: '(prefers-color-scheme: dark)'
      });
    });

    it('フォールバックモードが有効になる', () => {
      themeManager = new ThemeManager();
      
      expect(themeManager.isFallbackMode()).toBe(true);
      expect(mockDocument.documentElement.classList.add).toHaveBeenCalledWith('theme-fallback-mode');
    });

    it('フォールバック用のクラスが適用される', () => {
      themeManager = new ThemeManager();
      
      // ライトテーマの場合
      expect(mockDocument.documentElement.classList.add).toHaveBeenCalledWith('theme-fallback-light');
      
      // ダークテーマに切り替え
      themeManager.setTheme('dark');
      expect(mockDocument.documentElement.classList.add).toHaveBeenCalledWith('theme-fallback-dark');
      // remove は複数の引数で呼ばれるので、個別にチェック
      expect(mockDocument.documentElement.classList.remove).toHaveBeenCalledWith('theme-fallback-light', 'theme-fallback-dark');
    });

    it('フォールバック用のインラインスタイルが適用される', () => {
      themeManager = new ThemeManager();
      
      // ダークテーマに切り替え
      themeManager.setTheme('dark');
      
      // ルート要素にインラインスタイルが適用されることを確認
      expect(mockDocument.documentElement.style.backgroundColor).toBe('#0f172a');
      expect(mockDocument.documentElement.style.color).toBe('#f1f5f9');
    });

    it('要素別のフォールバックスタイルが適用される', () => {
      const mockButton = {
        tagName: 'BUTTON',
        style: {}
      };
      
      // querySelectorAllが各セレクターに対してmockButtonを返すように設定
      mockDocument.querySelectorAll.mockImplementation((selector) => {
        if (selector === 'button') {
          return [mockButton];
        }
        return [];
      });
      
      themeManager = new ThemeManager();
      themeManager.setTheme('dark');
      
      // ボタン要素にフォールバックスタイルが適用されることを確認
      expect(mockButton.style.backgroundColor).toBe('#3b82f6');
      expect(mockButton.style.color).toBe('#ffffff');
      expect(mockButton.style.border).toBe('1px solid #60a5fa');
    });
  });

  describe('システムテーマ検出のフォールバック', () => {
    it('matchMedia未対応時にデフォルトテーマを使用する', () => {
      mockWindow.matchMedia = undefined;
      
      themeManager = new ThemeManager();
      
      expect(themeManager.getSystemTheme()).toBe('light');
    });

    it('prefers-color-scheme未対応時にデフォルトテーマを使用する', () => {
      mockWindow.matchMedia.mockReturnValue({
        media: 'not all', // 無効なメディアクエリ
        matches: false
      });
      
      themeManager = new ThemeManager();
      
      expect(themeManager.getSystemTheme()).toBe('light');
    });

    it('システムテーマ検出エラー時にデフォルトテーマを使用する', () => {
      mockWindow.matchMedia.mockImplementation(() => {
        throw new Error('matchMedia error');
      });
      
      themeManager = new ThemeManager();
      
      expect(themeManager.getSystemTheme()).toBe('light');
    });
  });

  describe('緊急時のフォールバック処理', () => {
    it('重大なエラー時に最小限の機能で動作する', () => {
      // 初期化時にエラーを発生させる（applyTheme内でエラーを発生）
      mockDocument.documentElement.setAttribute.mockImplementation(() => {
        throw new Error('Critical error');
      });
      
      // CSS変数は対応しているが、DOM操作でエラーが発生する状況
      mockWindow.CSS.supports.mockReturnValue(true);
      
      themeManager = new ThemeManager();
      
      // 基本的な状態が設定されることを確認
      expect(themeManager.getCurrentTheme()).toBe('light');
      // 重大なエラー時は handleCriticalError が呼ばれ、themePreference も 'light' に設定される
      expect(themeManager.getThemePreference()).toBe('light');
    });

    it('DOM操作エラー時に緊急フォールバックが実行される', () => {
      mockDocument.documentElement.setAttribute.mockImplementation(() => {
        throw new Error('DOM error');
      });
      
      themeManager = new ThemeManager();
      themeManager.setTheme('dark');
      
      // 緊急フォールバックでインラインスタイルが設定されることを確認
      expect(mockDocument.documentElement.style.backgroundColor).toBe('#000000');
      expect(mockDocument.documentElement.style.color).toBe('#ffffff');
    });
  });

  describe('システム健全性チェック', () => {
    it('健全な状態を正しく報告する', () => {
      // 全機能対応の状態
      mockWindow.CSS.supports.mockReturnValue(true);
      mockWindow.matchMedia.mockReturnValue({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        addEventListener: vi.fn()
      });
      mockWindow.localStorage.getItem.mockReturnValue('test');
      mockDocument.documentElement.hasAttribute.mockReturnValue(true);
      
      themeManager = new ThemeManager();
      const health = themeManager.checkSystemHealth();
      
      expect(health.isHealthy).toBe(true);
      expect(health.issues).toHaveLength(0);
      expect(health.recommendations).toHaveLength(0);
    });

    it('問題のある状態を正しく報告する', () => {
      // 機能制限のある状態
      mockWindow.CSS.supports.mockReturnValue(false);
      mockWindow.localStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage disabled');
      });
      mockDocument.documentElement.hasAttribute.mockReturnValue(false);
      
      themeManager = new ThemeManager();
      const health = themeManager.checkSystemHealth();
      
      expect(health.isHealthy).toBe(false);
      expect(health.issues).toContain('CSS変数未対応');
      expect(health.issues).toContain('localStorage未対応またはプライベートモード');
      expect(health.issues).toContain('テーマ属性が設定されていません');
      expect(health.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('リソースクリーンアップ', () => {
    it('フォールバックモードのクリーンアップが実行される', () => {
      mockWindow.CSS.supports.mockReturnValue(false);
      
      themeManager = new ThemeManager();
      themeManager.destroy();
      
      // フォールバック用クラスの削除が実行されることを確認
      expect(mockDocument.documentElement.classList.remove).toHaveBeenCalledWith(
        'theme-fallback-mode',
        'theme-fallback-light',
        'theme-fallback-dark'
      );
    });

    it('メモリストレージがクリアされる', () => {
      mockWindow.localStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage disabled');
      });
      
      themeManager = new ThemeManager();
      themeManager.setTheme('dark');
      
      // メモリストレージにデータが保存されることを確認
      expect(themeManager.getCurrentTheme()).toBe('dark');
      
      themeManager.destroy();
      
      // 新しいインスタンスではメモリストレージがクリアされていることを確認
      const newThemeManager = new ThemeManager();
      expect(newThemeManager.getThemePreference()).toBe('system');
      newThemeManager.destroy();
    });

    it('プロパティが正しくリセットされる', () => {
      themeManager = new ThemeManager();
      themeManager.setTheme('dark');
      
      expect(themeManager.getCurrentTheme()).toBe('dark');
      
      themeManager.destroy();
      
      // プロパティがリセットされることを確認（内部状態のテスト）
      expect(themeManager.getBrowserSupport().cssVariables).toBe(false);
    });
  });

  describe('サーバーサイドレンダリング対応', () => {
    it('window未定義時に安全に動作する', () => {
      // @ts-ignore
      global.window = undefined;
      // @ts-ignore
      global.document = undefined;
      
      expect(() => {
        themeManager = new ThemeManager();
      }).not.toThrow();
      
      expect(themeManager.getCurrentTheme()).toBe('light');
      expect(themeManager.getBrowserSupport().cssVariables).toBe(false);
    });

    it('document未定義時に安全に動作する', () => {
      // @ts-ignore
      global.document = undefined;
      
      expect(() => {
        themeManager = new ThemeManager();
      }).not.toThrow();
      
      expect(themeManager.getCurrentTheme()).toBe('light');
    });
  });
});