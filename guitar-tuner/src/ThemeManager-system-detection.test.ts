/**
 * ThemeManager システムテーマ検出と手動切り替えの専用テスト
 * prefers-color-scheme検出、システムテーマ変更監視、手動切り替えの詳細テスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeManager } from './ThemeManager';
import type { Theme, ThemePreference } from './types';

// MediaQueryListのモック作成ヘルパー
const createMockMediaQueryList = (matches: boolean, hasModernEventListeners: boolean = true) => ({
  matches,
  media: '(prefers-color-scheme: dark)',
  addEventListener: hasModernEventListeners ? vi.fn() : undefined,
  removeEventListener: hasModernEventListeners ? vi.fn() : undefined,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  onchange: null,
  dispatchEvent: vi.fn()
});

describe('ThemeManager - システムテーマ検出と手動切り替え', () => {
  let themeManager: ThemeManager;
  let mockMatchMedia: any;
  let mockLocalStorage: any;
  let mockMediaQueryList: any;

  beforeEach(() => {
    // LocalStorageのモック
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };

    // DOM環境のモック
    Object.defineProperty(document, 'documentElement', {
      writable: true,
      value: {
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        style: { colorScheme: '' },
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn()
        }
      }
    });

    Object.defineProperty(window, 'localStorage', {
      writable: true,
      value: mockLocalStorage
    });

    // CSS.supportsのモック
    Object.defineProperty(window, 'CSS', {
      writable: true,
      value: {
        supports: vi.fn().mockReturnValue(true)
      }
    });

    // getComputedStyleのモック
    Object.defineProperty(window, 'getComputedStyle', {
      writable: true,
      value: vi.fn().mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue('0.3s')
      })
    });

    // matchMediaのモック
    mockMatchMedia = vi.fn();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia
    });

    // モックをリセット
    vi.clearAllMocks();
    
    // デフォルトでライトテーマのシステム設定
    mockMediaQueryList = createMockMediaQueryList(false);
    mockMatchMedia.mockReturnValue(mockMediaQueryList);
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockImplementation(() => {});
  });

  afterEach(() => {
    if (themeManager) {
      themeManager.destroy();
    }
  });

  describe('システムテーマ検出の精度テスト', () => {
    it('システムがライトテーマの場合、正確に検出する', () => {
      mockMediaQueryList = createMockMediaQueryList(false);
      mockMatchMedia.mockReturnValue(mockMediaQueryList);

      themeManager = new ThemeManager();

      expect(themeManager.getSystemTheme()).toBe('light');
      expect(themeManager.getCurrentTheme()).toBe('light');
      expect(themeManager.getThemePreference()).toBe('system');
    });

    it('システムがダークテーマの場合、正確に検出する', () => {
      mockMediaQueryList = createMockMediaQueryList(true);
      mockMatchMedia.mockReturnValue(mockMediaQueryList);

      themeManager = new ThemeManager();

      expect(themeManager.getSystemTheme()).toBe('dark');
      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('system');
    });

    it('matchMedia APIが利用できない場合、デフォルトでライトテーマを使用する', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: undefined
      });

      themeManager = new ThemeManager();

      expect(themeManager.getSystemTheme()).toBe('light');
      expect(themeManager.getCurrentTheme()).toBe('light');
    });

    it('prefers-color-schemeが対応していない場合、デフォルトでライトテーマを使用する', () => {
      mockMediaQueryList = {
        ...createMockMediaQueryList(false),
        media: 'not all' // 無効なメディアクエリ
      };
      mockMatchMedia.mockReturnValue(mockMediaQueryList);

      themeManager = new ThemeManager();

      expect(themeManager.getSystemTheme()).toBe('light');
    });

    it('システムテーマ検出でエラーが発生した場合、デフォルトでライトテーマを使用する', () => {
      mockMatchMedia.mockImplementation(() => {
        throw new Error('matchMedia error');
      });

      themeManager = new ThemeManager();

      expect(themeManager.getSystemTheme()).toBe('light');
      expect(themeManager.getCurrentTheme()).toBe('light');
    });
  });

  describe('システムテーマ変更の監視', () => {
    beforeEach(() => {
      mockMediaQueryList = createMockMediaQueryList(false);
      mockMatchMedia.mockReturnValue(mockMediaQueryList);
      themeManager = new ThemeManager();
    });

    it('システムテーマ変更時にイベントリスナーが正しく設定される', () => {
      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });

    it('システム設定時にシステムテーマ変更が正しく反映される', () => {
      themeManager.setTheme('system');
      expect(themeManager.getCurrentTheme()).toBe('light'); // 初期状態

      // システムテーマ変更をシミュレート（ライト → ダーク）
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];
      changeHandler({ matches: true } as MediaQueryListEvent);

      expect(themeManager.getSystemTheme()).toBe('dark');
      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('system');
    });

    it('手動設定時はシステムテーマ変更を無視する', () => {
      themeManager.setTheme('light'); // 手動でライトテーマに設定
      expect(themeManager.getCurrentTheme()).toBe('light');

      // システムテーマ変更をシミュレート
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];
      changeHandler({ matches: true } as MediaQueryListEvent);

      // 手動設定が維持されることを確認
      expect(themeManager.getCurrentTheme()).toBe('light');
      expect(themeManager.getThemePreference()).toBe('light');
    });

    it('システムテーマが複数回変更された場合、正しく追従する', () => {
      themeManager.setTheme('system');
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];

      // ライト → ダーク
      changeHandler({ matches: true } as MediaQueryListEvent);
      expect(themeManager.getCurrentTheme()).toBe('dark');

      // ダーク → ライト
      changeHandler({ matches: false } as MediaQueryListEvent);
      expect(themeManager.getCurrentTheme()).toBe('light');

      // ライト → ダーク → ライト
      changeHandler({ matches: true } as MediaQueryListEvent);
      expect(themeManager.getCurrentTheme()).toBe('dark');
      changeHandler({ matches: false } as MediaQueryListEvent);
      expect(themeManager.getCurrentTheme()).toBe('light');
    });

    it('古いブラウザでaddListenerが使用される', () => {
      themeManager.destroy();

      // addEventListener が存在しない古いブラウザをシミュレート
      mockMediaQueryList = createMockMediaQueryList(false, false);
      mockMatchMedia.mockReturnValue(mockMediaQueryList);

      themeManager = new ThemeManager();

      expect(mockMediaQueryList.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('イベントリスナーの設定でエラーが発生してもアプリケーションは継続する', () => {
      themeManager.destroy();

      mockMediaQueryList = {
        ...createMockMediaQueryList(false),
        addEventListener: vi.fn().mockImplementation(() => {
          throw new Error('addEventListener error');
        })
      };
      mockMatchMedia.mockReturnValue(mockMediaQueryList);

      expect(() => {
        themeManager = new ThemeManager();
      }).not.toThrow();

      expect(themeManager.getCurrentTheme()).toBe('light');
    });
  });

  describe('手動テーマ切り替えの詳細テスト', () => {
    beforeEach(() => {
      mockMediaQueryList = createMockMediaQueryList(false); // システムはライト
      mockMatchMedia.mockReturnValue(mockMediaQueryList);
      themeManager = new ThemeManager();
    });

    it('setTheme でライトテーマに正確に設定される', () => {
      themeManager.setTheme('light');

      expect(themeManager.getCurrentTheme()).toBe('light');
      expect(themeManager.getThemePreference()).toBe('light');
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
      expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('setTheme でダークテーマに正確に設定される', () => {
      themeManager.setTheme('dark');

      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('dark');
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
      expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    it('setTheme でシステム設定に正確に戻される', () => {
      // 最初にダークテーマに手動設定
      themeManager.setTheme('dark');
      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('dark');

      // システム設定に戻す（システムはライト）
      themeManager.setTheme('system');
      expect(themeManager.getCurrentTheme()).toBe('light');
      expect(themeManager.getThemePreference()).toBe('system');
    });

    it('toggleTheme でライトからダークに正確に切り替わる', () => {
      themeManager.setTheme('light');
      expect(themeManager.getCurrentTheme()).toBe('light');

      themeManager.toggleTheme();
      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('dark');
    });

    it('toggleTheme でダークからライトに正確に切り替わる', () => {
      themeManager.setTheme('dark');
      expect(themeManager.getCurrentTheme()).toBe('dark');

      themeManager.toggleTheme();
      expect(themeManager.getCurrentTheme()).toBe('light');
      expect(themeManager.getThemePreference()).toBe('light');
    });

    it('システム設定時のtoggleTheme で現在のシステムテーマの反対に設定される', () => {
      // システムがライトテーマの状態でtoggle
      themeManager.setTheme('system');
      expect(themeManager.getCurrentTheme()).toBe('light');
      
      themeManager.toggleTheme();
      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('dark');
    });

    it('システムがダークテーマの状態でのtoggleTheme', () => {
      // システムをダークテーマに変更
      themeManager.destroy();
      mockMediaQueryList = createMockMediaQueryList(true); // システムはダーク
      mockMatchMedia.mockReturnValue(mockMediaQueryList);
      themeManager = new ThemeManager();

      themeManager.setTheme('system');
      expect(themeManager.getCurrentTheme()).toBe('dark');
      
      themeManager.toggleTheme();
      expect(themeManager.getCurrentTheme()).toBe('light');
      expect(themeManager.getThemePreference()).toBe('light');
    });

    it('無効なテーマ値での設定を適切に処理する', () => {
      const initialTheme = themeManager.getCurrentTheme();
      const initialPreference = themeManager.getThemePreference();

      // 無効な値での設定を試行
      expect(() => {
        // @ts-ignore - 意図的に無効な値をテスト
        themeManager.setTheme('invalid-theme');
      }).not.toThrow();

      // 設定が変更されていないことを確認
      expect(themeManager.getCurrentTheme()).toBe(initialTheme);
      expect(themeManager.getThemePreference()).toBe(initialPreference);
    });
  });

  describe('テーマ設定の状態管理', () => {
    beforeEach(() => {
      mockMediaQueryList = createMockMediaQueryList(false);
      mockMatchMedia.mockReturnValue(mockMediaQueryList);
      themeManager = new ThemeManager();
    });

    it('getThemeSettings で正確な設定情報を返す', () => {
      themeManager.setTheme('dark');
      
      const settings = themeManager.getThemeSettings();
      
      expect(settings).toEqual({
        preference: 'dark',
        current: 'dark',
        systemTheme: 'light'
      });
    });

    it('システム設定時の情報を正確に返す', () => {
      themeManager.setTheme('system');
      
      const settings = themeManager.getThemeSettings();
      
      expect(settings).toEqual({
        preference: 'system',
        current: 'light', // システムテーマがライト
        systemTheme: 'light'
      });
    });

    it('システムテーマ変更後の情報を正確に返す', () => {
      themeManager.setTheme('system');
      
      // システムテーマ変更をシミュレート
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];
      changeHandler({ matches: true } as MediaQueryListEvent);
      
      const settings = themeManager.getThemeSettings();
      
      expect(settings).toEqual({
        preference: 'system',
        current: 'dark', // システムテーマがダークに変更
        systemTheme: 'dark'
      });
    });
  });

  describe('複雑なシナリオのテスト', () => {
    beforeEach(() => {
      mockMediaQueryList = createMockMediaQueryList(false);
      mockMatchMedia.mockReturnValue(mockMediaQueryList);
      themeManager = new ThemeManager();
    });

    it('手動設定 → システム設定 → システムテーマ変更の流れ', () => {
      // 1. 手動でダークテーマに設定
      themeManager.setTheme('dark');
      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('dark');

      // 2. システム設定に変更
      themeManager.setTheme('system');
      expect(themeManager.getCurrentTheme()).toBe('light'); // システムはライト
      expect(themeManager.getThemePreference()).toBe('system');

      // 3. システムテーマが変更される
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];
      changeHandler({ matches: true } as MediaQueryListEvent);
      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('system');
    });

    it('システム設定 → 手動設定 → システムテーマ変更（無視される）の流れ', () => {
      // 1. システム設定
      themeManager.setTheme('system');
      expect(themeManager.getCurrentTheme()).toBe('light');

      // 2. 手動でダークテーマに設定
      themeManager.setTheme('dark');
      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('dark');

      // 3. システムテーマが変更される（無視される）
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];
      changeHandler({ matches: true } as MediaQueryListEvent);
      expect(themeManager.getCurrentTheme()).toBe('dark'); // 手動設定が維持
      expect(themeManager.getThemePreference()).toBe('dark');
    });

    it('toggleTheme の連続実行', () => {
      themeManager.setTheme('light');
      
      // 複数回のtoggle
      themeManager.toggleTheme(); // light → dark
      expect(themeManager.getCurrentTheme()).toBe('dark');
      
      themeManager.toggleTheme(); // dark → light
      expect(themeManager.getCurrentTheme()).toBe('light');
      
      themeManager.toggleTheme(); // light → dark
      expect(themeManager.getCurrentTheme()).toBe('dark');
      
      themeManager.toggleTheme(); // dark → light
      expect(themeManager.getCurrentTheme()).toBe('light');
    });

    it('システムテーマの高速変更に対する追従性', () => {
      themeManager.setTheme('system');
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];

      // 高速でシステムテーマを変更
      for (let i = 0; i < 10; i++) {
        const isDark = i % 2 === 1;
        changeHandler({ matches: isDark } as MediaQueryListEvent);
        expect(themeManager.getCurrentTheme()).toBe(isDark ? 'dark' : 'light');
      }
    });
  });

  describe('エラー処理とフォールバック', () => {
    it('MediaQueryListEventの不正なデータを適切に処理する', () => {
      mockMediaQueryList = createMockMediaQueryList(false);
      mockMatchMedia.mockReturnValue(mockMediaQueryList);
      themeManager = new ThemeManager();
      themeManager.setTheme('system');

      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];

      // 不正なイベントデータ
      expect(() => {
        changeHandler(null as any);
      }).not.toThrow();

      expect(() => {
        changeHandler({} as any);
      }).not.toThrow();

      expect(() => {
        changeHandler({ matches: 'invalid' } as any);
      }).not.toThrow();
    });

    it('DOM操作エラー時でもテーマ状態は正しく管理される', () => {
      Object.defineProperty(document, 'documentElement', {
        writable: true,
        value: {
          setAttribute: vi.fn().mockImplementation(() => {
            throw new Error('DOM error');
          }),
          style: { colorScheme: '' },
          classList: {
            add: vi.fn(),
            remove: vi.fn(),
            contains: vi.fn()
          }
        }
      });

      expect(() => {
        themeManager.setTheme('dark');
      }).not.toThrow();

      // 内部状態は正しく更新される
      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('dark');
    });
  });
});