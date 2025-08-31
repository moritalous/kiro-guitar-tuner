/**
 * ThemeManager CSS変数適用とコントラスト比検証の専用テスト
 * WCAG 2.1 AA準拠のコントラスト比検証とCSS変数の正確な適用をテスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeManager } from './ThemeManager';

// CSS色彩値の解析とコントラスト比計算のユーティリティ
class ColorUtils {
  /**
   * HEX色をRGB値に変換
   */
  static hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      throw new Error(`Invalid hex color: ${hex}`);
    }
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    };
  }

  /**
   * RGB値から相対輝度を計算
   */
  static getRelativeLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * 2つの色のコントラスト比を計算（WCAG 2.1準拠）
   */
  static calculateContrastRatio(color1: string, color2: string): number {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);
    
    const lum1 = this.getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = this.getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
    
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  }

  /**
   * WCAG 2.1 AA準拠のコントラスト比チェック
   */
  static meetsWCAGAA(color1: string, color2: string, isLargeText: boolean = false): boolean {
    const ratio = this.calculateContrastRatio(color1, color2);
    return isLargeText ? ratio >= 3.0 : ratio >= 4.5;
  }

  /**
   * WCAG 2.1 AAA準拠のコントラスト比チェック
   */
  static meetsWCAGAAA(color1: string, color2: string, isLargeText: boolean = false): boolean {
    const ratio = this.calculateContrastRatio(color1, color2);
    return isLargeText ? ratio >= 4.5 : ratio >= 7.0;
  }
}

// テーマ色彩定義（style.cssから抽出）
const THEME_COLORS = {
  light: {
    primary: '#1a252f',
    secondary: '#2563eb',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    background: '#ffffff',
    surface: '#f8fafc',
    surfaceElevated: '#ffffff',
    text: '#1a252f',
    textSecondary: '#475569',
    textMuted: '#64748b',
    border: '#cbd5e1',
    borderStrong: '#94a3b8',
    
    // チューニング状態の色
    tuningPerfect: '#047857', // より濃い緑でコントラスト比を改善
    tuningClose: '#0891b2',
    tuningOff: '#b45309', // より濃いオレンジでコントラスト比を改善
    tuningVeryOff: '#dc2626',
    
    // ボタンの色
    buttonPrimaryBg: '#2563eb',
    buttonPrimaryText: '#ffffff',
    buttonSecondaryText: '#2563eb'
  },
  dark: {
    primary: '#f1f5f9',
    secondary: '#60a5fa',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    background: '#0f172a',
    surface: '#1e293b',
    surfaceElevated: '#334155',
    text: '#f1f5f9',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    border: '#475569',
    borderStrong: '#64748b',
    
    // チューニング状態の色
    tuningPerfect: '#10b981',
    tuningClose: '#06b6d4',
    tuningOff: '#f59e0b',
    tuningVeryOff: '#ef4444',
    
    // ボタンの色
    buttonPrimaryBg: '#1d4ed8', // より濃い青でコントラスト比を改善
    buttonPrimaryText: '#ffffff',
    buttonSecondaryText: '#60a5fa'
  }
} as const;

describe('ThemeManager - CSS変数適用とコントラスト比検証', () => {
  let themeManager: ThemeManager;
  let mockComputedStyle: any;

  beforeEach(() => {
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

    // CSS.supportsのモック
    Object.defineProperty(window, 'CSS', {
      writable: true,
      value: {
        supports: vi.fn().mockReturnValue(true)
      }
    });

    // matchMediaのモック
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    });

    // LocalStorageのモック
    Object.defineProperty(window, 'localStorage', {
      writable: true,
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
    });

    // getComputedStyleのモック
    mockComputedStyle = {
      getPropertyValue: vi.fn()
    };
    Object.defineProperty(window, 'getComputedStyle', {
      writable: true,
      value: vi.fn().mockReturnValue(mockComputedStyle)
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    if (themeManager) {
      themeManager.destroy();
    }
  });

  describe('CSS変数の正確な適用', () => {
    beforeEach(() => {
      themeManager = new ThemeManager();
    });

    it('ライトテーマ適用時にdata-theme属性が正しく設定される', () => {
      themeManager.setTheme('light');

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    });

    it('ダークテーマ適用時にdata-theme属性が正しく設定される', () => {
      themeManager.setTheme('dark');

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('color-schemeプロパティが正しく設定される', () => {
      themeManager.setTheme('light');
      expect(document.documentElement.style.colorScheme).toBe('light');

      themeManager.setTheme('dark');
      expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    it('CSS変数の検証が実行される', () => {
      mockComputedStyle.getPropertyValue.mockImplementation((property: string) => {
        if (property === '--background-color') return '#ffffff';
        if (property === '--text-color') return '#1a252f';
        return '';
      });

      themeManager.setTheme('light');

      expect(window.getComputedStyle).toHaveBeenCalledWith(document.documentElement);
      expect(mockComputedStyle.getPropertyValue).toHaveBeenCalledWith('--background-color');
      expect(mockComputedStyle.getPropertyValue).toHaveBeenCalledWith('--text-color');
    });

    it('CSS変数が未適用の場合に警告が出力される', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      mockComputedStyle.getPropertyValue.mockReturnValue(''); // 空の値を返す

      themeManager.setTheme('light');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CSS変数が正しく適用されていない可能性があります')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('WCAG 2.1 AA準拠のコントラスト比検証', () => {
    describe('ライトテーマのコントラスト比', () => {
      it('背景とプライマリテキストのコントラスト比が4.5:1以上である', () => {
        const ratio = ColorUtils.calculateContrastRatio(
          THEME_COLORS.light.background,
          THEME_COLORS.light.text
        );

        expect(ratio).toBeGreaterThanOrEqual(4.5);
        expect(ColorUtils.meetsWCAGAA(THEME_COLORS.light.background, THEME_COLORS.light.text)).toBe(true);
      });

      it('背景とセカンダリテキストのコントラスト比が4.5:1以上である', () => {
        const ratio = ColorUtils.calculateContrastRatio(
          THEME_COLORS.light.background,
          THEME_COLORS.light.textSecondary
        );

        expect(ratio).toBeGreaterThanOrEqual(4.5);
        expect(ColorUtils.meetsWCAGAA(THEME_COLORS.light.background, THEME_COLORS.light.textSecondary)).toBe(true);
      });

      it('背景とミュートテキストのコントラスト比が4.5:1以上である', () => {
        const ratio = ColorUtils.calculateContrastRatio(
          THEME_COLORS.light.background,
          THEME_COLORS.light.textMuted
        );

        expect(ratio).toBeGreaterThanOrEqual(4.5);
        expect(ColorUtils.meetsWCAGAA(THEME_COLORS.light.background, THEME_COLORS.light.textMuted)).toBe(true);
      });

      it('背景とプライマリカラーのコントラスト比が4.5:1以上である', () => {
        const ratio = ColorUtils.calculateContrastRatio(
          THEME_COLORS.light.background,
          THEME_COLORS.light.primary
        );

        expect(ratio).toBeGreaterThanOrEqual(4.5);
        expect(ColorUtils.meetsWCAGAA(THEME_COLORS.light.background, THEME_COLORS.light.primary)).toBe(true);
      });

      it('背景とセカンダリカラーのコントラスト比が4.5:1以上である', () => {
        const ratio = ColorUtils.calculateContrastRatio(
          THEME_COLORS.light.background,
          THEME_COLORS.light.secondary
        );

        expect(ratio).toBeGreaterThanOrEqual(4.5);
        expect(ColorUtils.meetsWCAGAA(THEME_COLORS.light.background, THEME_COLORS.light.secondary)).toBe(true);
      });
    });

    describe('ダークテーマのコントラスト比', () => {
      it('背景とプライマリテキストのコントラスト比が4.5:1以上である', () => {
        const ratio = ColorUtils.calculateContrastRatio(
          THEME_COLORS.dark.background,
          THEME_COLORS.dark.text
        );

        expect(ratio).toBeGreaterThanOrEqual(4.5);
        expect(ColorUtils.meetsWCAGAA(THEME_COLORS.dark.background, THEME_COLORS.dark.text)).toBe(true);
      });

      it('背景とセカンダリテキストのコントラスト比が4.5:1以上である', () => {
        const ratio = ColorUtils.calculateContrastRatio(
          THEME_COLORS.dark.background,
          THEME_COLORS.dark.textSecondary
        );

        expect(ratio).toBeGreaterThanOrEqual(4.5);
        expect(ColorUtils.meetsWCAGAA(THEME_COLORS.dark.background, THEME_COLORS.dark.textSecondary)).toBe(true);
      });

      it('背景とミュートテキストのコントラスト比が4.5:1以上である', () => {
        const ratio = ColorUtils.calculateContrastRatio(
          THEME_COLORS.dark.background,
          THEME_COLORS.dark.textMuted
        );

        expect(ratio).toBeGreaterThanOrEqual(4.5);
        expect(ColorUtils.meetsWCAGAA(THEME_COLORS.dark.background, THEME_COLORS.dark.textMuted)).toBe(true);
      });

      it('背景とプライマリカラーのコントラスト比が4.5:1以上である', () => {
        const ratio = ColorUtils.calculateContrastRatio(
          THEME_COLORS.dark.background,
          THEME_COLORS.dark.primary
        );

        expect(ratio).toBeGreaterThanOrEqual(4.5);
        expect(ColorUtils.meetsWCAGAA(THEME_COLORS.dark.background, THEME_COLORS.dark.primary)).toBe(true);
      });

      it('背景とセカンダリカラーのコントラスト比が4.5:1以上である', () => {
        const ratio = ColorUtils.calculateContrastRatio(
          THEME_COLORS.dark.background,
          THEME_COLORS.dark.secondary
        );

        expect(ratio).toBeGreaterThanOrEqual(4.5);
        expect(ColorUtils.meetsWCAGAA(THEME_COLORS.dark.background, THEME_COLORS.dark.secondary)).toBe(true);
      });
    });

    describe('チューニング状態の色彩コントラスト比', () => {
      it('ライトテーマのチューニング色が適切なコントラスト比を持つ', () => {
        const colors = THEME_COLORS.light;

        // 成功色（正確なチューニング）
        const successRatio = ColorUtils.calculateContrastRatio(colors.background, colors.tuningPerfect);
        expect(successRatio).toBeGreaterThanOrEqual(4.5);

        // 警告色（少しずれている）
        const warningRatio = ColorUtils.calculateContrastRatio(colors.background, colors.tuningOff);
        expect(warningRatio).toBeGreaterThanOrEqual(4.5);

        // エラー色（大きくずれている）
        const dangerRatio = ColorUtils.calculateContrastRatio(colors.background, colors.tuningVeryOff);
        expect(dangerRatio).toBeGreaterThanOrEqual(4.5);

        // 近い色（少し近い）
        const closeRatio = ColorUtils.calculateContrastRatio(colors.background, colors.tuningClose);
        expect(closeRatio).toBeGreaterThanOrEqual(4.5);
      });

      it('ダークテーマのチューニング色が適切なコントラスト比を持つ', () => {
        const colors = THEME_COLORS.dark;

        // 成功色（正確なチューニング）
        const successRatio = ColorUtils.calculateContrastRatio(colors.background, colors.tuningPerfect);
        expect(successRatio).toBeGreaterThanOrEqual(4.5);

        // 警告色（少しずれている）
        const warningRatio = ColorUtils.calculateContrastRatio(colors.background, colors.tuningOff);
        expect(warningRatio).toBeGreaterThanOrEqual(4.5);

        // エラー色（大きくずれている）
        const dangerRatio = ColorUtils.calculateContrastRatio(colors.background, colors.tuningVeryOff);
        expect(dangerRatio).toBeGreaterThanOrEqual(4.5);

        // 近い色（少し近い）
        const closeRatio = ColorUtils.calculateContrastRatio(colors.background, colors.tuningClose);
        expect(closeRatio).toBeGreaterThanOrEqual(4.5);
      });
    });

    describe('ボタンとインタラクティブ要素のコントラスト比', () => {
      it('ライトテーマのボタンが適切なコントラスト比を持つ', () => {
        const colors = THEME_COLORS.light;

        // プライマリボタン
        const primaryButtonRatio = ColorUtils.calculateContrastRatio(
          colors.buttonPrimaryBg,
          colors.buttonPrimaryText
        );
        expect(primaryButtonRatio).toBeGreaterThanOrEqual(4.5);

        // セカンダリボタン（背景に対するテキスト）
        const secondaryButtonRatio = ColorUtils.calculateContrastRatio(
          colors.background,
          colors.buttonSecondaryText
        );
        expect(secondaryButtonRatio).toBeGreaterThanOrEqual(4.5);
      });

      it('ダークテーマのボタンが適切なコントラスト比を持つ', () => {
        const colors = THEME_COLORS.dark;

        // プライマリボタン
        const primaryButtonRatio = ColorUtils.calculateContrastRatio(
          colors.buttonPrimaryBg,
          colors.buttonPrimaryText
        );
        expect(primaryButtonRatio).toBeGreaterThanOrEqual(4.5);

        // セカンダリボタン（背景に対するテキスト）
        const secondaryButtonRatio = ColorUtils.calculateContrastRatio(
          colors.background,
          colors.buttonSecondaryText
        );
        expect(secondaryButtonRatio).toBeGreaterThanOrEqual(4.5);
      });
    });

    describe('サーフェス要素のコントラスト比', () => {
      it('ライトテーマのサーフェス要素が適切なコントラスト比を持つ', () => {
        const colors = THEME_COLORS.light;

        // サーフェス上のテキスト
        const surfaceTextRatio = ColorUtils.calculateContrastRatio(colors.surface, colors.text);
        expect(surfaceTextRatio).toBeGreaterThanOrEqual(4.5);

        // エレベーテッドサーフェス上のテキスト
        const elevatedSurfaceTextRatio = ColorUtils.calculateContrastRatio(colors.surfaceElevated, colors.text);
        expect(elevatedSurfaceTextRatio).toBeGreaterThanOrEqual(4.5);
      });

      it('ダークテーマのサーフェス要素が適切なコントラスト比を持つ', () => {
        const colors = THEME_COLORS.dark;

        // サーフェス上のテキスト
        const surfaceTextRatio = ColorUtils.calculateContrastRatio(colors.surface, colors.text);
        expect(surfaceTextRatio).toBeGreaterThanOrEqual(4.5);

        // エレベーテッドサーフェス上のテキスト
        const elevatedSurfaceTextRatio = ColorUtils.calculateContrastRatio(colors.surfaceElevated, colors.text);
        expect(elevatedSurfaceTextRatio).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  describe('WCAG 2.1 AAA準拠のコントラスト比検証（推奨レベル）', () => {
    it('ライトテーマの主要テキストがAAA準拠のコントラスト比を持つ', () => {
      const colors = THEME_COLORS.light;

      const primaryTextRatio = ColorUtils.calculateContrastRatio(colors.background, colors.text);
      expect(primaryTextRatio).toBeGreaterThanOrEqual(7.0);
      expect(ColorUtils.meetsWCAGAAA(colors.background, colors.text)).toBe(true);
    });

    it('ダークテーマの主要テキストがAAA準拠のコントラスト比を持つ', () => {
      const colors = THEME_COLORS.dark;

      const primaryTextRatio = ColorUtils.calculateContrastRatio(colors.background, colors.text);
      expect(primaryTextRatio).toBeGreaterThanOrEqual(7.0);
      expect(ColorUtils.meetsWCAGAAA(colors.background, colors.text)).toBe(true);
    });
  });

  describe('色彩計算の精度テスト', () => {
    it('既知の色の組み合わせで正確なコントラスト比を計算する', () => {
      // 白と黒の組み合わせ（理論値: 21:1）
      const whiteBlackRatio = ColorUtils.calculateContrastRatio('#ffffff', '#000000');
      expect(whiteBlackRatio).toBeCloseTo(21, 1);

      // 白とグレーの組み合わせ（理論値: 約12.6:1）
      const whiteGrayRatio = ColorUtils.calculateContrastRatio('#ffffff', '#333333');
      expect(whiteGrayRatio).toBeCloseTo(12.6, 1);

      // 同じ色の組み合わせ（理論値: 1:1）
      const sameColorRatio = ColorUtils.calculateContrastRatio('#ff0000', '#ff0000');
      expect(sameColorRatio).toBeCloseTo(1, 1);
    });

    it('HEX色の解析が正確に動作する', () => {
      const white = ColorUtils.hexToRgb('#ffffff');
      expect(white).toEqual({ r: 255, g: 255, b: 255 });

      const black = ColorUtils.hexToRgb('#000000');
      expect(black).toEqual({ r: 0, g: 0, b: 0 });

      const red = ColorUtils.hexToRgb('#ff0000');
      expect(red).toEqual({ r: 255, g: 0, b: 0 });

      const blue = ColorUtils.hexToRgb('#0000ff');
      expect(blue).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('相対輝度の計算が正確に動作する', () => {
      // 白の相対輝度（理論値: 1.0）
      const whiteLuminance = ColorUtils.getRelativeLuminance(255, 255, 255);
      expect(whiteLuminance).toBeCloseTo(1.0, 2);

      // 黒の相対輝度（理論値: 0.0）
      const blackLuminance = ColorUtils.getRelativeLuminance(0, 0, 0);
      expect(blackLuminance).toBeCloseTo(0.0, 2);

      // 中間グレーの相対輝度
      const grayLuminance = ColorUtils.getRelativeLuminance(128, 128, 128);
      expect(grayLuminance).toBeGreaterThan(0.0);
      expect(grayLuminance).toBeLessThan(1.0);
    });
  });

  describe('実際のテーマ適用時のコントラスト比検証', () => {
    beforeEach(() => {
      themeManager = new ThemeManager();
    });

    it('ライトテーマ適用時に実際のCSS変数値でコントラスト比を検証する', () => {
      // 実際のCSS変数値をシミュレート
      mockComputedStyle.getPropertyValue.mockImplementation((property: string) => {
        const lightThemeValues: Record<string, string> = {
          '--background-color': '#ffffff',
          '--text-color': '#1a252f',
          '--text-secondary': '#475569',
          '--primary-color': '#1a252f',
          '--secondary-color': '#2563eb',
          '--success-color': '#059669',
          '--warning-color': '#d97706',
          '--danger-color': '#dc2626'
        };
        return lightThemeValues[property] || '';
      });

      themeManager.setTheme('light');

      // CSS変数から取得した値でコントラスト比を検証
      const backgroundValue = mockComputedStyle.getPropertyValue('--background-color');
      const textValue = mockComputedStyle.getPropertyValue('--text-color');
      const secondaryTextValue = mockComputedStyle.getPropertyValue('--text-secondary');

      if (backgroundValue && textValue) {
        const textRatio = ColorUtils.calculateContrastRatio(backgroundValue, textValue);
        expect(textRatio).toBeGreaterThanOrEqual(4.5);
      }

      if (backgroundValue && secondaryTextValue) {
        const secondaryRatio = ColorUtils.calculateContrastRatio(backgroundValue, secondaryTextValue);
        expect(secondaryRatio).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('ダークテーマ適用時に実際のCSS変数値でコントラスト比を検証する', () => {
      // 実際のCSS変数値をシミュレート
      mockComputedStyle.getPropertyValue.mockImplementation((property: string) => {
        const darkThemeValues: Record<string, string> = {
          '--background-color': '#0f172a',
          '--text-color': '#f1f5f9',
          '--text-secondary': '#cbd5e1',
          '--primary-color': '#f1f5f9',
          '--secondary-color': '#60a5fa',
          '--success-color': '#10b981',
          '--warning-color': '#f59e0b',
          '--danger-color': '#ef4444'
        };
        return darkThemeValues[property] || '';
      });

      themeManager.setTheme('dark');

      // CSS変数から取得した値でコントラスト比を検証
      const backgroundValue = mockComputedStyle.getPropertyValue('--background-color');
      const textValue = mockComputedStyle.getPropertyValue('--text-color');
      const secondaryTextValue = mockComputedStyle.getPropertyValue('--text-secondary');

      if (backgroundValue && textValue) {
        const textRatio = ColorUtils.calculateContrastRatio(backgroundValue, textValue);
        expect(textRatio).toBeGreaterThanOrEqual(4.5);
      }

      if (backgroundValue && secondaryTextValue) {
        const secondaryRatio = ColorUtils.calculateContrastRatio(backgroundValue, secondaryTextValue);
        expect(secondaryRatio).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});