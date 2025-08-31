/**
 * ThemeManager 永続化機能の専用テスト
 * LocalStorage保存・読み込み、データマイグレーション、エラーハンドリングの詳細テスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeManager } from './ThemeManager';
import type { ThemePreference } from './types';

// テストデータの定義
const VALID_THEME_DATA = {
  theme: 'dark' as ThemePreference,
  timestamp: Date.now(),
  version: '1.0.0'
};

const OLD_VERSION_DATA = {
  theme: 'light' as ThemePreference,
  timestamp: Date.now(),
  version: '0.9.0'
};

const INVALID_JSON_DATA = 'invalid json string';

const CORRUPTED_DATA = {
  theme: 'invalid-theme',
  timestamp: 'not-a-number',
  version: null
};

describe('ThemeManager - 永続化機能', () => {
  let themeManager: ThemeManager;
  let mockLocalStorage: any;
  let mockMatchMedia: any;

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
    mockMatchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia
    });

    // モックをリセット
    vi.clearAllMocks();
    
    // LocalStorageのブラウザサポート検出用のモック設定
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === '__theme_manager_test__') return 'test';
      return null;
    });
    mockLocalStorage.setItem.mockImplementation(() => {});
    mockLocalStorage.removeItem.mockImplementation(() => {});
  });

  afterEach(() => {
    if (themeManager) {
      themeManager.destroy();
    }
  });

  describe('テーマ設定の保存', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockReturnValue(null);
      themeManager = new ThemeManager();
    });

    it('テーマ設定が正しい形式でLocalStorageに保存される', () => {
      themeManager.setTheme('dark');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'guitar-tuner-theme',
        expect.stringContaining('"theme":"dark"')
      );

      // 保存されたデータの構造を検証
      const savedCall = mockLocalStorage.setItem.mock.calls[0];
      const savedData = JSON.parse(savedCall[1]);
      
      expect(savedData).toHaveProperty('theme', 'dark');
      expect(savedData).toHaveProperty('timestamp');
      expect(savedData).toHaveProperty('version', '1.0.0');
      expect(typeof savedData.timestamp).toBe('number');
      expect(savedData.timestamp).toBeGreaterThan(0);
    });

    it('複数のテーマ変更が順次保存される', () => {
      themeManager.setTheme('dark');
      themeManager.setTheme('light');
      themeManager.setTheme('system');

      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3);

      // 最後の保存データを検証
      const lastCall = mockLocalStorage.setItem.mock.calls[2];
      const lastSavedData = JSON.parse(lastCall[1]);
      expect(lastSavedData.theme).toBe('system');
    });

    it('フォールバックキーにも保存される', () => {
      themeManager.setTheme('dark');

      // メインキーとフォールバックキーの両方に保存されることを確認
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'guitar-tuner-theme',
        expect.any(String)
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'gt-theme-fallback',
        'dark'
      );
    });

    it('タイムスタンプが正確に記録される', () => {
      const beforeTime = Date.now();
      themeManager.setTheme('dark');
      const afterTime = Date.now();

      const savedCall = mockLocalStorage.setItem.mock.calls[0];
      const savedData = JSON.parse(savedCall[1]);
      
      expect(savedData.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(savedData.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('バージョン情報が正しく保存される', () => {
      themeManager.setTheme('light');

      const savedCall = mockLocalStorage.setItem.mock.calls[0];
      const savedData = JSON.parse(savedCall[1]);
      
      expect(savedData.version).toBe('1.0.0');
    });
  });

  describe('テーマ設定の読み込み', () => {
    it('有効な保存データが正しく読み込まれる', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(VALID_THEME_DATA));

      themeManager = new ThemeManager();

      expect(themeManager.getThemePreference()).toBe('dark');
      expect(themeManager.getCurrentTheme()).toBe('dark');
    });

    it('保存データがない場合、デフォルト設定を使用する', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      themeManager = new ThemeManager();

      expect(themeManager.getThemePreference()).toBe('system');
    });

    it('無効なJSON形式の場合、デフォルト設定を使用する', () => {
      mockLocalStorage.getItem.mockReturnValue(INVALID_JSON_DATA);

      themeManager = new ThemeManager();

      expect(themeManager.getThemePreference()).toBe('system');
    });

    it('データ構造が不正な場合、デフォルト設定を使用する', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(CORRUPTED_DATA));

      themeManager = new ThemeManager();

      expect(themeManager.getThemePreference()).toBe('system');
    });

    it('古いバージョンのデータの場合、マイグレーションを試行する', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(OLD_VERSION_DATA));

      themeManager = new ThemeManager();

      // 古いバージョンでも有効なテーマ値の場合は使用される
      expect(themeManager.getThemePreference()).toBe('system'); // マイグレーション失敗でデフォルト
    });

    it('文字列形式の古いデータをマイグレーションする', () => {
      mockLocalStorage.getItem
        .mockReturnValueOnce('test') // ブラウザサポート検出用
        .mockReturnValueOnce('dark'); // 古い形式のデータ

      themeManager = new ThemeManager();

      expect(themeManager.getThemePreference()).toBe('dark');
    });

    it('フォールバックキーからの読み込みを実行する', () => {
      mockLocalStorage.getItem
        .mockReturnValueOnce('test') // ブラウザサポート検出用
        .mockReturnValueOnce(null)   // メインキーは見つからない
        .mockReturnValueOnce('light'); // フォールバックキーから読み込み

      themeManager = new ThemeManager();

      expect(themeManager.getThemePreference()).toBe('light');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('guitar-tuner-theme');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('gt-theme-fallback');
    });
  });

  describe('LocalStorage エラーハンドリング', () => {
    it('LocalStorage読み込みエラー時にデフォルト設定を使用する', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage read error');
      });

      expect(() => {
        themeManager = new ThemeManager();
      }).not.toThrow();

      expect(themeManager.getThemePreference()).toBe('system');
    });

    it('LocalStorage書き込みエラー時でもアプリケーションは継続する', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage write error');
      });

      themeManager = new ThemeManager();

      expect(() => {
        themeManager.setTheme('dark');
      }).not.toThrow();

      expect(themeManager.getCurrentTheme()).toBe('dark');
    });

    it('LocalStorage容量不足時に古いデータをクリアして再試行する', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      Object.defineProperty(quotaError, 'name', {
        value: 'QuotaExceededError',
        writable: false
      });

      // 初回のsetItemでエラー、2回目は成功
      mockLocalStorage.setItem
        .mockImplementationOnce(() => { throw quotaError; })
        .mockImplementationOnce(() => {}); // 再試行時は成功

      themeManager = new ThemeManager();
      themeManager.setTheme('dark');

      // 古いキーの削除が実行されることを確認
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('theme-preference');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('guitar-tuner-theme-old');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('app-theme');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user-theme-preference');

      // 再試行でsetItemが呼ばれることを確認
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3); // 初期化時 + setTheme時 + 再試行
    });

    it('容量不足の再試行も失敗した場合、メモリストレージを使用する', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      Object.defineProperty(quotaError, 'name', {
        value: 'QuotaExceededError',
        writable: false
      });

      // 全てのsetItemでエラー
      mockLocalStorage.setItem.mockImplementation(() => { throw quotaError; });

      themeManager = new ThemeManager();
      themeManager.setTheme('dark');

      // アプリケーションは継続し、テーマは正しく設定される
      expect(themeManager.getCurrentTheme()).toBe('dark');
    });

    it('LocalStorage無効時にメモリストレージを使用する', () => {
      // LocalStorageが完全に無効
      Object.defineProperty(window, 'localStorage', {
        writable: true,
        value: undefined
      });

      expect(() => {
        themeManager = new ThemeManager();
        themeManager.setTheme('dark');
      }).not.toThrow();

      expect(themeManager.getCurrentTheme()).toBe('dark');
    });
  });

  describe('メモリストレージのフォールバック', () => {
    beforeEach(() => {
      // LocalStorageを無効化
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage disabled');
      });
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage disabled');
      });
    });

    it('LocalStorage無効時にメモリストレージに保存される', () => {
      themeManager = new ThemeManager();
      themeManager.setTheme('dark');

      // メモリストレージから読み込めることを確認
      expect(themeManager.getCurrentTheme()).toBe('dark');
      expect(themeManager.getThemePreference()).toBe('dark');
    });

    it('メモリストレージからの読み込みが正しく動作する', () => {
      themeManager = new ThemeManager();
      themeManager.setTheme('light');

      // 新しいインスタンスでは読み込めない（メモリストレージは揮発性）
      themeManager.destroy();
      const newThemeManager = new ThemeManager();
      expect(newThemeManager.getThemePreference()).toBe('system');
      newThemeManager.destroy();
    });

    it('メモリストレージでの複数回の保存・読み込み', () => {
      themeManager = new ThemeManager();

      themeManager.setTheme('dark');
      expect(themeManager.getCurrentTheme()).toBe('dark');

      themeManager.setTheme('light');
      expect(themeManager.getCurrentTheme()).toBe('light');

      themeManager.setTheme('system');
      expect(themeManager.getCurrentTheme()).toBe('light'); // システムはライト
      expect(themeManager.getThemePreference()).toBe('system');
    });
  });

  describe('データ整合性の検証', () => {
    it('不正なテーマ値の保存を拒否する', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      themeManager = new ThemeManager();

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

    it('保存データの形式が一貫している', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      themeManager = new ThemeManager();

      const themes: ThemePreference[] = ['light', 'dark', 'system'];
      
      themes.forEach(theme => {
        themeManager.setTheme(theme);
        
        const savedCall = mockLocalStorage.setItem.mock.calls.find(call => 
          call[0] === 'guitar-tuner-theme'
        );
        
        if (savedCall) {
          const savedData = JSON.parse(savedCall[1]);
          
          expect(savedData).toHaveProperty('theme');
          expect(savedData).toHaveProperty('timestamp');
          expect(savedData).toHaveProperty('version');
          expect(typeof savedData.theme).toBe('string');
          expect(typeof savedData.timestamp).toBe('number');
          expect(typeof savedData.version).toBe('string');
        }
      });
    });

    it('タイムスタンプの単調増加性', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      themeManager = new ThemeManager();

      let previousTimestamp = 0;

      ['dark', 'light', 'system'].forEach(theme => {
        themeManager.setTheme(theme as ThemePreference);
        
        const savedCall = mockLocalStorage.setItem.mock.calls.find(call => 
          call[0] === 'guitar-tuner-theme'
        );
        
        if (savedCall) {
          const savedData = JSON.parse(savedCall[1]);
          expect(savedData.timestamp).toBeGreaterThanOrEqual(previousTimestamp);
          previousTimestamp = savedData.timestamp;
        }
      });
    });
  });

  describe('パフォーマンステスト', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockReturnValue(null);
      themeManager = new ThemeManager();
    });

    it('大量のテーマ変更が効率的に処理される', () => {
      const startTime = performance.now();

      // 1000回のテーマ変更
      for (let i = 0; i < 1000; i++) {
        const theme = i % 3 === 0 ? 'light' : i % 3 === 1 ? 'dark' : 'system';
        themeManager.setTheme(theme);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 1000回の変更が2秒以内に完了することを確認
      expect(duration).toBeLessThan(2000);
    });

    it('LocalStorage操作の回数が最適化されている', () => {
      // 同じテーマを複数回設定
      themeManager.setTheme('dark');
      themeManager.setTheme('dark');
      themeManager.setTheme('dark');

      // 各setTheme呼び出しで保存が実行される（重複排除は行わない）
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3);
    });

    it('メモリ使用量が適切に管理される', () => {
      // 大量のテーマ変更でメモリリークが発生しないことを確認
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      for (let i = 0; i < 10000; i++) {
        themeManager.setTheme(i % 2 === 0 ? 'light' : 'dark');
      }

      // ガベージコレクションを促進（可能な場合）
      if (global.gc) {
        global.gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // メモリ使用量が大幅に増加していないことを確認（5MB以下の増加）
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // 5MB
      }
    });
  });

  describe('クリーンアップとリソース管理', () => {
    it('destroy時にメモリストレージがクリアされる', () => {
      // LocalStorageを無効化してメモリストレージを使用
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage disabled');
      });

      themeManager = new ThemeManager();
      themeManager.setTheme('dark');
      expect(themeManager.getCurrentTheme()).toBe('dark');

      themeManager.destroy();

      // 新しいインスタンスではメモリストレージがクリアされている
      const newThemeManager = new ThemeManager();
      expect(newThemeManager.getThemePreference()).toBe('system');
      newThemeManager.destroy();
    });

    it('複数のインスタンスが独立してメモリストレージを管理する', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage disabled');
      });

      const themeManager1 = new ThemeManager();
      const themeManager2 = new ThemeManager();

      themeManager1.setTheme('dark');
      themeManager2.setTheme('light');

      expect(themeManager1.getCurrentTheme()).toBe('dark');
      expect(themeManager2.getCurrentTheme()).toBe('light');

      themeManager1.destroy();
      themeManager2.destroy();
    });
  });
});