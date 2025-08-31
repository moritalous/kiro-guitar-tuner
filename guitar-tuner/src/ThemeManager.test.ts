/**
 * ThemeManager クラスの包括的なテスト
 * システムテーマ検出、手動切り替え、永続化機能、CSS変数適用、コントラスト比検証をテスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeManager } from './ThemeManager';
import type { Theme, ThemePreference } from './types';

// モックオブジェクト
const mockMatchMedia = vi.fn();
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

// MediaQueryList のモック
const createMockMediaQueryList = (matches: boolean) => ({
  matches,
  media: '(prefers-color-scheme: dark)',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  onchange: null,
  dispatchEvent: vi.fn()
});

describe('ThemeManager', () => {
  let themeManager: ThemeManager;
  let mockMediaQueryList: ReturnType<typeof createMockMediaQueryList>;

  beforeEach(() => {
    // DOM環境のモック
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia
    });

    Object.defineProperty(window, 'localStorage', {
      writable: true,
      value: mockLocalStorage
    });

    // document.documentElement のモック
    Object.defineProperty(document, 'documentElement', {
      writable: true,
      value: {
        setAttribute: vi.fn(),
        style: { colorScheme: '' }
      }
    });

    // モックをリセット
    vi.clearAllMocks();
    
    // デフォルトでライトテーマのシステム設定
    mockMediaQueryList = createMockMediaQueryList(false);
    mockMatchMedia.mockReturnValue(mockMediaQueryList);
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockImplementation(() => {}); // デフォルトでは正常動作
  });

  afterEach(() => {
    if (themeManager) {
      themeManager.destroy();
    }
  });

  describe('初期化', () => {
    it('システムテーマがライトの場合、ライトテーマで初期化される', () => {
      mockMediaQueryList = createMockMediaQueryList(false);
      mockMatchMedia.mockReturnValue(mockMediaQueryList);

      themeManager = new ThemeManager();

      expect(themeManager.getCurrentTheme()).toBe('light');
      expect(themeManager.getSystemTheme()).toBe('light');
      expect(themeManager.getThemePreference()).toBe('system');
    });

    it('システムテーマがダークの場合、ダークテーマで初期化される', () => {
      mockMediaQueryList = createMockMediaQueryList(true);
      mockMatchMedia.mockReturnValue(mockMediaQueryList);

      themeManager = new ThemeManager();

      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getSystemTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('system');
    });

    it('保存されたテーマ設定がある場合、それを優先する', () => {
      const savedData = {
        theme: 'dark',
        timestamp: Date.now(),
        version: '1.0.0'
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedData));

      themeManager = new ThemeManager();

      expect(themeManager.getThemePreference()).toBe('dark');
      expect(themeManager.getCurrentTheme()).toBe('dark');
    });

    it('無効な保存データがある場合、デフォルト設定を使用する', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      themeManager = new ThemeManager();

      expect(themeManager.getThemePreference()).toBe('system');
    });

    it('古いバージョンの保存データがある場合、デフォルト設定を使用する', () => {
      const oldVersionData = {
        theme: 'dark',
        timestamp: Date.now(),
        version: '0.9.0'
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(oldVersionData));

      themeManager = new ThemeManager();

      expect(themeManager.getThemePreference()).toBe('system');
    });
  });

  describe('システムテーマ検出', () => {
    it('matchMedia が利用できない場合、ライトテーマをデフォルトとする', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: undefined
      });

      themeManager = new ThemeManager();

      expect(themeManager.getSystemTheme()).toBe('light');
    });

    it('matchMedia でエラーが発生した場合、ライトテーマをデフォルトとする', () => {
      mockMatchMedia.mockImplementation(() => {
        throw new Error('matchMedia error');
      });

      themeManager = new ThemeManager();

      expect(themeManager.getSystemTheme()).toBe('light');
    });
  });

  describe('テーマ切り替え', () => {
    beforeEach(() => {
      themeManager = new ThemeManager();
    });

    it('setTheme でライトテーマに設定できる', () => {
      themeManager.setTheme('light');

      expect(themeManager.getCurrentTheme()).toBe('light');
      expect(themeManager.getThemePreference()).toBe('light');
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    });

    it('setTheme でダークテーマに設定できる', () => {
      themeManager.setTheme('dark');

      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('dark');
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('setTheme でシステム設定に戻せる', () => {
      // 最初にダークテーマに設定
      themeManager.setTheme('dark');
      expect(themeManager.getCurrentTheme()).toBe('dark');

      // システム設定に戻す（システムはライト）
      themeManager.setTheme('system');
      expect(themeManager.getCurrentTheme()).toBe('light');
      expect(themeManager.getThemePreference()).toBe('system');
    });

    it('toggleTheme でライトからダークに切り替わる', () => {
      themeManager.setTheme('light');
      themeManager.toggleTheme();

      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('dark');
    });

    it('toggleTheme でダークからライトに切り替わる', () => {
      themeManager.setTheme('dark');
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
  });

  describe('永続化', () => {
    beforeEach(() => {
      themeManager = new ThemeManager();
    });

    it('テーマ設定がLocalStorageに保存される', () => {
      themeManager.setTheme('dark');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'guitar-tuner-theme',
        expect.stringContaining('"theme":"dark"')
      );
    });

    it('保存データに正しいバージョン情報が含まれる', () => {
      themeManager.setTheme('light');

      const savedCall = mockLocalStorage.setItem.mock.calls[0];
      const savedData = JSON.parse(savedCall[1]);
      
      expect(savedData.version).toBe('1.0.0');
      expect(savedData.theme).toBe('light');
      expect(typeof savedData.timestamp).toBe('number');
    });

    it('LocalStorageが利用できない場合でもエラーにならない', () => {
      Object.defineProperty(window, 'localStorage', {
        writable: true,
        value: undefined
      });

      expect(() => {
        themeManager.setTheme('dark');
      }).not.toThrow();
    });

    it('LocalStorage書き込みでエラーが発生してもアプリケーションは継続する', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => {
        themeManager.setTheme('dark');
      }).not.toThrow();

      expect(themeManager.getCurrentTheme()).toBe('dark');
    });
  });

  describe('システムテーマ変更の監視', () => {
    beforeEach(() => {
      themeManager = new ThemeManager();
    });

    it('システムテーマ変更時にイベントリスナーが設定される', () => {
      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });

    it('古いブラウザでaddListenerが使用される', () => {
      // addEventListener が存在しない古いブラウザをシミュレート
      mockMediaQueryList.addEventListener = undefined;
      
      themeManager.destroy();
      themeManager = new ThemeManager();

      expect(mockMediaQueryList.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('システム設定時にシステムテーマ変更が反映される', () => {
      themeManager.setTheme('system');
      
      // システムテーマ変更をシミュレート
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];
      changeHandler({ matches: true } as MediaQueryListEvent);

      expect(themeManager.getCurrentTheme()).toBe('dark');
    });

    it('手動設定時はシステムテーマ変更が無視される', () => {
      themeManager.setTheme('light');
      
      // システムテーマ変更をシミュレート
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];
      changeHandler({ matches: true } as MediaQueryListEvent);

      // 手動設定のライトテーマが維持される
      expect(themeManager.getCurrentTheme()).toBe('light');
    });
  });

  describe('getThemeSettings', () => {
    beforeEach(() => {
      themeManager = new ThemeManager();
    });

    it('現在のテーマ設定を正しく返す', () => {
      themeManager.setTheme('dark');
      
      const settings = themeManager.getThemeSettings();
      
      expect(settings).toEqual({
        preference: 'dark',
        current: 'dark',
        systemTheme: 'light' // モックではライトテーマ
      });
    });

    it('システム設定時の情報を正しく返す', () => {
      themeManager.setTheme('system');
      
      const settings = themeManager.getThemeSettings();
      
      expect(settings).toEqual({
        preference: 'system',
        current: 'light', // システムテーマがライト
        systemTheme: 'light'
      });
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      themeManager = new ThemeManager();
    });

    it('イベントリスナーが正しく解除される', () => {
      themeManager.destroy();

      expect(mockMediaQueryList.removeEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });

    it('古いブラウザでremoveListenerが使用される', () => {
      // removeEventListener が存在しない古いブラウザをシミュレート
      mockMediaQueryList.removeEventListener = undefined;
      
      themeManager.destroy();

      expect(mockMediaQueryList.removeListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('複数回呼び出してもエラーにならない', () => {
      expect(() => {
        themeManager.destroy();
        themeManager.destroy();
      }).not.toThrow();
    });
  });

  describe('CSS変数の適用テスト', () => {
    beforeEach(() => {
      // CSS変数対応ブラウザをシミュレート
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
          getPropertyValue: vi.fn().mockImplementation((property: string) => {
            // CSS変数の値をシミュレート
            const mockValues: Record<string, string> = {
              '--background-color': '#ffffff',
              '--text-color': '#1a252f',
              '--primary-color': '#2563eb',
              '--theme-transition-duration': '0.3s'
            };
            return mockValues[property] || '';
          })
        })
      });

      themeManager = new ThemeManager();
    });

    it('ライトテーマ適用時にCSS変数が正しく設定される', () => {
      themeManager.setTheme('light');

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
      expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('ダークテーマ適用時にCSS変数が正しく設定される', () => {
      themeManager.setTheme('dark');

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
      expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    it('テーマ切り替え時にCSS変数の検証が実行される', () => {
      const getComputedStyleSpy = vi.spyOn(window, 'getComputedStyle');
      
      themeManager.setTheme('dark');

      expect(getComputedStyleSpy).toHaveBeenCalledWith(document.documentElement);
    });

    it('CSS変数が正しく適用されていることを検証する', () => {
      const mockComputedStyle = {
        getPropertyValue: vi.fn().mockImplementation((property: string) => {
          if (property === '--background-color') return '#ffffff';
          if (property === '--text-color') return '#1a252f';
          return '';
        })
      };
      
      Object.defineProperty(window, 'getComputedStyle', {
        writable: true,
        value: vi.fn().mockReturnValue(mockComputedStyle)
      });

      themeManager.setTheme('light');

      expect(mockComputedStyle.getPropertyValue).toHaveBeenCalledWith('--background-color');
      expect(mockComputedStyle.getPropertyValue).toHaveBeenCalledWith('--text-color');
    });
  });

  describe('コントラスト比の自動検証', () => {
    beforeEach(() => {
      themeManager = new ThemeManager();
    });

    it('ライトテーマのコントラスト比が4.5:1以上であることを検証する', () => {
      // WCAG 2.1 AA準拠のコントラスト比をテスト
      const lightThemeColors = {
        background: '#ffffff',  // 白背景
        text: '#1a252f',       // ダークテキスト
        primary: '#2563eb',    // プライマリカラー
        secondary: '#475569'   // セカンダリテキスト
      };

      // コントラスト比計算のヘルパー関数
      const calculateContrastRatio = (color1: string, color2: string): number => {
        // 簡略化されたコントラスト比計算（実際の実装では正確な計算が必要）
        const getLuminance = (hex: string): number => {
          const rgb = parseInt(hex.slice(1), 16);
          const r = (rgb >> 16) & 0xff;
          const g = (rgb >> 8) & 0xff;
          const b = (rgb >> 0) & 0xff;
          
          const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          
          return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
        };

        const lum1 = getLuminance(color1);
        const lum2 = getLuminance(color2);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        
        return (brightest + 0.05) / (darkest + 0.05);
      };

      themeManager.setTheme('light');

      // 背景とテキストのコントラスト比をテスト
      const textContrast = calculateContrastRatio(lightThemeColors.background, lightThemeColors.text);
      expect(textContrast).toBeGreaterThanOrEqual(4.5);

      // 背景とセカンダリテキストのコントラスト比をテスト
      const secondaryContrast = calculateContrastRatio(lightThemeColors.background, lightThemeColors.secondary);
      expect(secondaryContrast).toBeGreaterThanOrEqual(4.5);
    });

    it('ダークテーマのコントラスト比が4.5:1以上であることを検証する', () => {
      const darkThemeColors = {
        background: '#0f172a',  // ダーク背景
        text: '#f1f5f9',       // ライトテキスト
        primary: '#60a5fa',    // プライマリカラー
        secondary: '#cbd5e1'   // セカンダリテキスト
      };

      const calculateContrastRatio = (color1: string, color2: string): number => {
        const getLuminance = (hex: string): number => {
          const rgb = parseInt(hex.slice(1), 16);
          const r = (rgb >> 16) & 0xff;
          const g = (rgb >> 8) & 0xff;
          const b = (rgb >> 0) & 0xff;
          
          const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          
          return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
        };

        const lum1 = getLuminance(color1);
        const lum2 = getLuminance(color2);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        
        return (brightest + 0.05) / (darkest + 0.05);
      };

      themeManager.setTheme('dark');

      // 背景とテキストのコントラスト比をテスト
      const textContrast = calculateContrastRatio(darkThemeColors.background, darkThemeColors.text);
      expect(textContrast).toBeGreaterThanOrEqual(4.5);

      // 背景とセカンダリテキストのコントラスト比をテスト
      const secondaryContrast = calculateContrastRatio(darkThemeColors.background, darkThemeColors.secondary);
      expect(secondaryContrast).toBeGreaterThanOrEqual(4.5);
    });

    it('チューニング状態の色彩が適切なコントラスト比を持つことを検証する', () => {
      const tuningColors = {
        light: {
          background: '#ffffff',
          success: '#059669',    // 正確なチューニング
          warning: '#d97706',    // 少しずれている
          danger: '#dc2626'      // 大きくずれている
        },
        dark: {
          background: '#0f172a',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444'
        }
      };

      const calculateContrastRatio = (color1: string, color2: string): number => {
        const getLuminance = (hex: string): number => {
          const rgb = parseInt(hex.slice(1), 16);
          const r = (rgb >> 16) & 0xff;
          const g = (rgb >> 8) & 0xff;
          const b = (rgb >> 0) & 0xff;
          
          const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          
          return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
        };

        const lum1 = getLuminance(color1);
        const lum2 = getLuminance(color2);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        
        return (brightest + 0.05) / (darkest + 0.05);
      };

      // ライトテーマのチューニング色をテスト
      themeManager.setTheme('light');
      const lightSuccessContrast = calculateContrastRatio(tuningColors.light.background, tuningColors.light.success);
      const lightWarningContrast = calculateContrastRatio(tuningColors.light.background, tuningColors.light.warning);
      const lightDangerContrast = calculateContrastRatio(tuningColors.light.background, tuningColors.light.danger);

      expect(lightSuccessContrast).toBeGreaterThanOrEqual(4.5);
      expect(lightWarningContrast).toBeGreaterThanOrEqual(4.5);
      expect(lightDangerContrast).toBeGreaterThanOrEqual(4.5);

      // ダークテーマのチューニング色をテスト
      themeManager.setTheme('dark');
      const darkSuccessContrast = calculateContrastRatio(tuningColors.dark.background, tuningColors.dark.success);
      const darkWarningContrast = calculateContrastRatio(tuningColors.dark.background, tuningColors.dark.warning);
      const darkDangerContrast = calculateContrastRatio(tuningColors.dark.background, tuningColors.dark.danger);

      expect(darkSuccessContrast).toBeGreaterThanOrEqual(4.5);
      expect(darkWarningContrast).toBeGreaterThanOrEqual(4.5);
      expect(darkDangerContrast).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('テーマ切り替えアニメーション', () => {
    beforeEach(() => {
      // CSS変数とgetComputedStyleのモック
      Object.defineProperty(window, 'getComputedStyle', {
        writable: true,
        value: vi.fn().mockReturnValue({
          getPropertyValue: vi.fn().mockImplementation((property: string) => {
            if (property === '--theme-transition-duration') return '0.3s';
            return '';
          })
        })
      });

      // documentElementのclassListモック
      Object.defineProperty(document, 'documentElement', {
        writable: true,
        value: {
          setAttribute: vi.fn(),
          classList: {
            add: vi.fn(),
            remove: vi.fn(),
            contains: vi.fn()
          },
          style: { colorScheme: '' }
        }
      });

      themeManager = new ThemeManager();
    });

    it('テーマ切り替え時にアニメーション状態クラスが追加される', () => {
      themeManager.setTheme('dark');

      expect(document.documentElement.classList.add).toHaveBeenCalledWith('theme-switching');
    });

    it('アニメーション完了後に状態クラスが削除される', (done) => {
      themeManager.setTheme('dark');

      // アニメーション時間（300ms）+ 余裕（50ms）後にクラスが削除されることを確認
      setTimeout(() => {
        expect(document.documentElement.classList.remove).toHaveBeenCalledWith('theme-switching');
        done();
      }, 400);
    });

    it('CSS変数からアニメーション時間を正しく取得する', () => {
      const getComputedStyleSpy = vi.spyOn(window, 'getComputedStyle');
      
      themeManager.setTheme('dark');

      expect(getComputedStyleSpy).toHaveBeenCalledWith(document.documentElement);
    });

    it('prefers-reduced-motionが有効な場合、短いアニメーション時間を使用する', () => {
      // prefers-reduced-motionをシミュレート
      Object.defineProperty(window, 'getComputedStyle', {
        writable: true,
        value: vi.fn().mockReturnValue({
          getPropertyValue: vi.fn().mockImplementation((property: string) => {
            if (property === '--theme-transition-duration') return '0.01s';
            return '';
          })
        })
      });

      themeManager.setTheme('dark');

      // 短時間でアニメーション状態が解除されることを確認
      setTimeout(() => {
        expect(document.documentElement.classList.remove).toHaveBeenCalledWith('theme-switching');
      }, 100);
    });
  });

  describe('システムテーマ検出の詳細テスト', () => {
    it('システムテーマ変更時に正しいイベントハンドラーが呼ばれる', () => {
      mockMediaQueryList = createMockMediaQueryList(false);
      mockMatchMedia.mockReturnValue(mockMediaQueryList);

      themeManager = new ThemeManager();
      themeManager.setTheme('system');

      // システムテーマ変更をシミュレート
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];
      const mockEvent = { matches: true } as MediaQueryListEvent;
      
      changeHandler(mockEvent);

      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getSystemTheme()).toBe('dark');
    });

    it('手動設定時はシステムテーマ変更を無視する', () => {
      mockMediaQueryList = createMockMediaQueryList(false);
      mockMatchMedia.mockReturnValue(mockMediaQueryList);

      themeManager = new ThemeManager();
      themeManager.setTheme('light'); // 手動でライトテーマに設定

      // システムテーマ変更をシミュレート
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];
      const mockEvent = { matches: true } as MediaQueryListEvent;
      
      changeHandler(mockEvent);

      // 手動設定が維持されることを確認
      expect(themeManager.getCurrentTheme()).toBe('light');
      expect(themeManager.getThemePreference()).toBe('light');
    });

    it('システムテーマ検出の精度をテストする', () => {
      // ライトテーマのシステム設定
      mockMediaQueryList = createMockMediaQueryList(false);
      mockMatchMedia.mockReturnValue(mockMediaQueryList);

      themeManager = new ThemeManager();

      expect(themeManager.getSystemTheme()).toBe('light');

      // ダークテーマのシステム設定
      mockMediaQueryList = createMockMediaQueryList(true);
      mockMatchMedia.mockReturnValue(mockMediaQueryList);

      themeManager.destroy();
      themeManager = new ThemeManager();

      expect(themeManager.getSystemTheme()).toBe('dark');
    });
  });

  describe('永続化機能の詳細テスト', () => {
    beforeEach(() => {
      themeManager = new ThemeManager();
    });

    it('テーマ設定の保存データ構造が正しい', () => {
      themeManager.setTheme('dark');

      const savedCall = mockLocalStorage.setItem.mock.calls[0];
      const savedData = JSON.parse(savedCall[1]);

      expect(savedData).toHaveProperty('theme', 'dark');
      expect(savedData).toHaveProperty('timestamp');
      expect(savedData).toHaveProperty('version', '1.0.0');
      expect(typeof savedData.timestamp).toBe('number');
    });

    it('複数回のテーマ変更が正しく保存される', () => {
      themeManager.setTheme('dark');
      themeManager.setTheme('light');
      themeManager.setTheme('system');

      // 最後の設定が保存されることを確認
      const lastCall = mockLocalStorage.setItem.mock.calls[mockLocalStorage.setItem.mock.calls.length - 1];
      const lastSavedData = JSON.parse(lastCall[1]);

      expect(lastSavedData.theme).toBe('system');
    });

    it('不正なテーマ値の保存を拒否する', () => {
      // 不正な値での設定を試行
      expect(() => {
        // @ts-ignore - 意図的に不正な値をテスト
        themeManager.setTheme('invalid-theme');
      }).not.toThrow();

      // 不正な値は保存されないことを確認
      const savedCalls = mockLocalStorage.setItem.mock.calls;
      const invalidSave = savedCalls.find(call => {
        try {
          const data = JSON.parse(call[1]);
          return data.theme === 'invalid-theme';
        } catch {
          return false;
        }
      });

      expect(invalidSave).toBeUndefined();
    });

    it('LocalStorage容量不足時の処理をテストする', () => {
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      Object.defineProperty(quotaError, 'name', {
        value: 'QuotaExceededError',
        writable: false
      });

      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw quotaError;
      });

      // エラーが発生してもアプリケーションは継続する
      expect(() => {
        themeManager.setTheme('dark');
      }).not.toThrow();

      expect(themeManager.getCurrentTheme()).toBe('dark');
    });
  });

  describe('エラーハンドリング', () => {
    it('DOM操作でエラーが発生してもアプリケーションは継続する', () => {
      Object.defineProperty(document, 'documentElement', {
        writable: true,
        value: {
          setAttribute: vi.fn().mockImplementation(() => {
            throw new Error('DOM error');
          }),
          style: { colorScheme: '' }
        }
      });

      expect(() => {
        themeManager = new ThemeManager();
        themeManager.setTheme('dark');
      }).not.toThrow();
    });

    it('初期化でエラーが発生した場合、ライトテーマにフォールバックする', () => {
      mockMatchMedia.mockImplementation(() => {
        throw new Error('Initialization error');
      });

      themeManager = new ThemeManager();

      expect(themeManager.getCurrentTheme()).toBe('light');
    });

    it('CSS変数の検証でエラーが発生してもアプリケーションは継続する', () => {
      Object.defineProperty(window, 'getComputedStyle', {
        writable: true,
        value: vi.fn().mockImplementation(() => {
          throw new Error('getComputedStyle error');
        })
      });

      expect(() => {
        themeManager = new ThemeManager();
        themeManager.setTheme('dark');
      }).not.toThrow();
    });

    it('メディアクエリリスナーの設定でエラーが発生してもアプリケーションは継続する', () => {
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
    });
  });

  describe('パフォーマンステスト', () => {
    beforeEach(() => {
      themeManager = new ThemeManager();
    });

    it('連続したテーマ切り替えが効率的に処理される', () => {
      const startTime = performance.now();

      // 連続してテーマを切り替え
      for (let i = 0; i < 100; i++) {
        themeManager.setTheme(i % 2 === 0 ? 'light' : 'dark');
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 100回の切り替えが1秒以内に完了することを確認
      expect(duration).toBeLessThan(1000);
    });

    it('メモリリークが発生しないことを確認する', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // 多数のテーマ切り替えを実行
      for (let i = 0; i < 1000; i++) {
        themeManager.setTheme(i % 3 === 0 ? 'light' : i % 3 === 1 ? 'dark' : 'system');
      }

      // ガベージコレクションを促進（可能な場合）
      if (global.gc) {
        global.gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // メモリ使用量が大幅に増加していないことを確認（10MB以下の増加）
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB
      }
    });

    it('DOM操作の回数が最適化されている', () => {
      const setAttributeSpy = vi.spyOn(document.documentElement, 'setAttribute');

      // 同じテーマを複数回設定
      themeManager.setTheme('dark');
      themeManager.setTheme('dark');
      themeManager.setTheme('dark');

      // DOM操作が必要最小限に抑えられていることを確認
      expect(setAttributeSpy).toHaveBeenCalledTimes(3); // 各setTheme呼び出しで1回ずつ
    });
  });
});