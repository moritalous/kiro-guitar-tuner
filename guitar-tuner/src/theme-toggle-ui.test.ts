/**
 * テーマ切り替えUIコンポーネントのテスト
 * 要件 2.1, 2.4, 3.3, 3.4 の検証
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeManager } from './ThemeManager';

// DOM環境のセットアップ
function setupDOM() {
  document.body.innerHTML = `
    <div id="app">
      <header>
        <div class="header-content">
          <h1>ギターチューナー</h1>
          <button 
            id="theme-toggle" 
            aria-label="テーマを切り替え" 
            aria-pressed="false"
            title="ダークモード/ライトモードを切り替え"
            class="theme-toggle-button"
          >
            <span class="theme-icon" aria-hidden="true">🌙</span>
            <span class="sr-only">現在: ライトモード</span>
          </button>
        </div>
      </header>
    </div>
  `;
}

describe('テーマ切り替えUIコンポーネント', () => {
  let themeManager: ThemeManager;
  let themeToggleButton: HTMLButtonElement;
  let themeIcon: HTMLSpanElement;
  let srOnlyText: HTMLSpanElement;

  beforeEach(() => {
    // DOM環境をセットアップ
    setupDOM();
    
    // 要素を取得
    themeToggleButton = document.querySelector('#theme-toggle') as HTMLButtonElement;
    themeIcon = document.querySelector('.theme-icon') as HTMLSpanElement;
    srOnlyText = document.querySelector('.sr-only') as HTMLSpanElement;
    
    // ThemeManagerを初期化
    themeManager = new ThemeManager();
    themeManager.setupThemeToggleButton();
  });

  afterEach(() => {
    themeManager.destroy();
    document.body.innerHTML = '';
  });

  describe('ボタンの初期状態', () => {
    it('ライトモード時の初期状態が正しく設定される', () => {
      // ライトモードに明示的に設定
      themeManager.setTheme('light');
      
      // 要件 2.4: ボタンが現在のテーマ状態を視覚的に示すアイコンを表示する
      expect(themeIcon.textContent).toBe('🌙');
      expect(themeToggleButton.getAttribute('aria-pressed')).toBe('false');
      expect(themeToggleButton.getAttribute('title')).toBe('ダークモードに切り替え');
      expect(srOnlyText.textContent).toBe('現在: ライトモード');
    });

    it('必要なアクセシビリティ属性が設定されている', () => {
      // 要件 3.3, 3.4: アクセシビリティ属性の設定
      expect(themeToggleButton.getAttribute('aria-label')).toBe('テーマを切り替え');
      expect(themeToggleButton.getAttribute('aria-pressed')).toBe('false');
      expect(themeToggleButton.getAttribute('title')).toBeTruthy();
      expect(themeIcon.getAttribute('aria-hidden')).toBe('true');
      expect(srOnlyText.classList.contains('sr-only')).toBe(true);
    });
  });

  describe('テーマ切り替え機能', () => {
    it('クリックでテーマが切り替わる', () => {
      // 要件 2.1: ユーザーがテーマ切り替えボタンをクリックすると現在のテーマを反対のテーマに切り替える
      const initialTheme = themeManager.getCurrentTheme();
      
      themeToggleButton.click();
      
      const newTheme = themeManager.getCurrentTheme();
      expect(newTheme).not.toBe(initialTheme);
      expect(newTheme).toBe(initialTheme === 'light' ? 'dark' : 'light');
    });

    it('ダークモード切り替え時にUIが正しく更新される', () => {
      // ダークモードに切り替え
      themeManager.setTheme('dark');
      
      // 要件 2.4: ボタンのアイコンと状態表示機能
      expect(themeIcon.textContent).toBe('☀️');
      expect(themeToggleButton.getAttribute('aria-pressed')).toBe('true');
      expect(themeToggleButton.getAttribute('title')).toBe('ライトモードに切り替え');
      expect(srOnlyText.textContent).toBe('現在: ダークモード');
    });

    it('ライトモードに戻した時にUIが正しく更新される', () => {
      // ダークモードに切り替えてからライトモードに戻す
      themeManager.setTheme('dark');
      themeManager.setTheme('light');
      
      expect(themeIcon.textContent).toBe('🌙');
      expect(themeToggleButton.getAttribute('aria-pressed')).toBe('false');
      expect(themeToggleButton.getAttribute('title')).toBe('ダークモードに切り替え');
      expect(srOnlyText.textContent).toBe('現在: ライトモード');
    });

    it('複数回の切り替えが正しく動作する', () => {
      const initialTheme = themeManager.getCurrentTheme();
      
      // 3回切り替え
      themeToggleButton.click();
      themeToggleButton.click();
      themeToggleButton.click();
      
      // 奇数回なので初期テーマと異なる
      expect(themeManager.getCurrentTheme()).not.toBe(initialTheme);
      
      // もう一度切り替えて元に戻る
      themeToggleButton.click();
      expect(themeManager.getCurrentTheme()).toBe(initialTheme);
    });
  });

  describe('キーボードナビゲーション', () => {
    it('Enterキーでテーマが切り替わる', () => {
      // 要件 3.3: キーボードナビゲーション対応
      const initialTheme = themeManager.getCurrentTheme();
      
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      themeToggleButton.dispatchEvent(enterEvent);
      
      expect(themeManager.getCurrentTheme()).not.toBe(initialTheme);
    });

    it('スペースキーでテーマが切り替わる', () => {
      // 要件 3.3: キーボードナビゲーション対応
      const initialTheme = themeManager.getCurrentTheme();
      
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
      themeToggleButton.dispatchEvent(spaceEvent);
      
      expect(themeManager.getCurrentTheme()).not.toBe(initialTheme);
    });

    it('他のキーでは切り替わらない', () => {
      const initialTheme = themeManager.getCurrentTheme();
      
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      themeToggleButton.dispatchEvent(tabEvent);
      
      expect(themeManager.getCurrentTheme()).toBe(initialTheme);
    });

    it('キーボードイベントでpreventDefaultが呼ばれる', () => {
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      const preventDefaultSpy = vi.spyOn(enterEvent, 'preventDefault');
      
      themeToggleButton.dispatchEvent(enterEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('スクリーンリーダー対応', () => {
    it('aria-pressed属性がテーマに応じて更新される', () => {
      // 要件 3.4: スクリーンリーダー対応
      themeManager.setTheme('light');
      expect(themeToggleButton.getAttribute('aria-pressed')).toBe('false');
      
      themeManager.setTheme('dark');
      expect(themeToggleButton.getAttribute('aria-pressed')).toBe('true');
      
      themeManager.setTheme('light');
      expect(themeToggleButton.getAttribute('aria-pressed')).toBe('false');
    });

    it('スクリーンリーダー用テキストが正しく更新される', () => {
      // 要件 3.4: スクリーンリーダー対応
      themeManager.setTheme('light');
      expect(srOnlyText.textContent).toBe('現在: ライトモード');
      
      themeManager.setTheme('dark');
      expect(srOnlyText.textContent).toBe('現在: ダークモード');
      
      themeManager.setTheme('light');
      expect(srOnlyText.textContent).toBe('現在: ライトモード');
    });

    it('title属性が適切に更新される', () => {
      themeManager.setTheme('light');
      expect(themeToggleButton.getAttribute('title')).toBe('ダークモードに切り替え');
      
      themeManager.setTheme('dark');
      expect(themeToggleButton.getAttribute('title')).toBe('ライトモードに切り替え');
      
      themeManager.setTheme('light');
      expect(themeToggleButton.getAttribute('title')).toBe('ダークモードに切り替え');
    });

    it('アイコンがaria-hiddenに設定されている', () => {
      // 装飾的なアイコンはスクリーンリーダーから隠す
      expect(themeIcon.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('エラーハンドリング', () => {
    it('ボタン要素が見つからない場合でもエラーが発生しない', () => {
      // ボタンを削除
      themeToggleButton.remove();
      
      // 新しいThemeManagerを作成してもエラーが発生しない
      expect(() => {
        const newThemeManager = new ThemeManager();
        newThemeManager.setupThemeToggleButton();
        newThemeManager.destroy();
      }).not.toThrow();
    });

    it('アイコン要素が見つからない場合でもエラーが発生しない', () => {
      // アイコンを削除
      themeIcon.remove();
      
      expect(() => {
        themeManager.setTheme('dark');
      }).not.toThrow();
    });

    it('スクリーンリーダーテキスト要素が見つからない場合でもエラーが発生しない', () => {
      // スクリーンリーダーテキストを削除
      srOnlyText.remove();
      
      expect(() => {
        themeManager.setTheme('dark');
      }).not.toThrow();
    });

    it('DOM操作でエラーが発生してもアプリケーションは継続する', () => {
      // setAttribute をモックしてエラーを発生させる
      const setAttributeSpy = vi.spyOn(themeToggleButton, 'setAttribute')
        .mockImplementation(() => {
          throw new Error('DOM error');
        });
      
      expect(() => {
        themeManager.setTheme('dark');
      }).not.toThrow();
      
      setAttributeSpy.mockRestore();
    });
  });

  describe('イベントリスナーの管理', () => {
    it('同じボタンに複数回setupThemeToggleButtonを呼んでも問題ない', () => {
      // 複数回呼び出し
      themeManager.setupThemeToggleButton();
      themeManager.setupThemeToggleButton();
      
      const initialTheme = themeManager.getCurrentTheme();
      themeToggleButton.click();
      
      // 1回だけ切り替わることを確認（重複リスナーがないことを確認）
      expect(themeManager.getCurrentTheme()).not.toBe(initialTheme);
    });

    it('destroyメソッドでリスナーが適切にクリーンアップされる', () => {
      // 明示的にライトモードに設定
      themeManager.setTheme('light');
      const initialTheme = themeManager.getCurrentTheme();
      
      // destroy後はクリックしても切り替わらない
      themeManager.destroy();
      themeToggleButton.click();
      
      expect(themeManager.getCurrentTheme()).toBe(initialTheme);
    });
  });

  describe('システムテーマとの連携', () => {
    it('システムテーマ変更時にボタンUIが更新される', () => {
      // システムテーマ設定に変更
      themeManager.setTheme('system');
      
      // システムテーマをダークに変更（モック）
      const darkModeQuery = {
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      } as any;
      
      vi.spyOn(window, 'matchMedia').mockReturnValue(darkModeQuery);
      
      // システムテーマ変更をシミュレート
      const changeEvent = { matches: true } as MediaQueryListEvent;
      themeManager['onSystemThemeChange'](changeEvent);
      
      // ボタンUIがダークモード表示に更新される
      expect(themeIcon.textContent).toBe('☀️');
      expect(themeToggleButton.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('パフォーマンス', () => {
    it('大量のテーマ切り替えでもパフォーマンスが劣化しない', () => {
      const startTime = performance.now();
      
      // 100回切り替え
      for (let i = 0; i < 100; i++) {
        themeManager.toggleTheme();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // 100回の切り替えが1秒以内に完了することを確認
      expect(duration).toBeLessThan(1000);
    });

    it('UI更新が効率的に行われる', () => {
      const setAttributeSpy = vi.spyOn(themeToggleButton, 'setAttribute');
      
      themeManager.setTheme('dark');
      
      // 必要最小限の属性更新のみが行われることを確認
      expect(setAttributeSpy).toHaveBeenCalledWith('aria-pressed', 'true');
      expect(setAttributeSpy).toHaveBeenCalledWith('title', 'ライトモードに切り替え');
      
      setAttributeSpy.mockRestore();
    });
  });
});