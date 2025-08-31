/**
 * UIController テーマ連携機能のテスト
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { UIController } from './UIController';
import { ThemeManager } from './ThemeManager';

// DOM環境のモック
const mockElement = (id: string) => {
  const element = document.createElement('div');
  element.id = id;
  return element;
};

const mockButton = (id: string) => {
  const button = document.createElement('button');
  button.id = id;
  return button;
};

describe('UIController テーマ連携機能', () => {
  let uiController: UIController;
  let mockThemeManager: ThemeManager;
  let mockThemeToggleButton: HTMLButtonElement;
  let mockThemeIcon: HTMLSpanElement;
  let mockSrOnlyText: HTMLSpanElement;

  beforeEach(() => {
    // DOM要素のモック
    document.body.innerHTML = '';
    
    // 必要なDOM要素を作成
    const elements = [
      'detected-note', 'status-message', 'cents-value', 'tuning-display',
      'meter-needle', 'meter-container', 'instructions', 'toggle-instructions',
      'show-instructions'
    ];
    
    elements.forEach(id => {
      document.body.appendChild(mockElement(id));
    });

    // テーマ切り替えボタンとその子要素を作成
    mockThemeToggleButton = mockButton('theme-toggle');
    mockThemeIcon = document.createElement('span');
    mockThemeIcon.className = 'theme-icon';
    mockSrOnlyText = document.createElement('span');
    mockSrOnlyText.className = 'sr-only';
    
    mockThemeToggleButton.appendChild(mockThemeIcon);
    mockThemeToggleButton.appendChild(mockSrOnlyText);
    document.body.appendChild(mockThemeToggleButton);

    // ThemeManagerのモック
    mockThemeManager = {
      getCurrentTheme: vi.fn().mockReturnValue('light'),
      toggleTheme: vi.fn(),
      setTheme: vi.fn(),
      getThemePreference: vi.fn().mockReturnValue('system'),
      getSystemTheme: vi.fn().mockReturnValue('light'),
      getThemeSettings: vi.fn().mockReturnValue({
        preference: 'system',
        current: 'light',
        systemTheme: 'light'
      }),
      initialize: vi.fn(),
      setupThemeToggleButton: vi.fn(),
      destroy: vi.fn()
    } as unknown as ThemeManager;

    // UIControllerのインスタンス作成
    uiController = new UIController();
  });

  describe('setThemeManager', () => {
    it('ThemeManagerを正しく設定する', () => {
      uiController.setThemeManager(mockThemeManager);
      
      // ThemeManagerが設定されたことを確認（初期UI更新でgetCurrentThemeが呼ばれる）
      expect(mockThemeManager.getCurrentTheme).toHaveBeenCalled();
    });

    it('テーマ切り替えボタンのイベントリスナーを設定する', () => {
      const addEventListenerSpy = vi.spyOn(mockThemeToggleButton, 'addEventListener');
      
      uiController.setThemeManager(mockThemeManager);
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('テーマ切り替えボタンのイベント処理', () => {
    beforeEach(() => {
      uiController.setThemeManager(mockThemeManager);
    });

    it('クリックイベントでテーマを切り替える', () => {
      const clickEvent = new MouseEvent('click');
      mockThemeToggleButton.dispatchEvent(clickEvent);
      
      expect(mockThemeManager.toggleTheme).toHaveBeenCalled();
    });

    it('Enterキーでテーマを切り替える', () => {
      const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      mockThemeToggleButton.dispatchEvent(keydownEvent);
      
      expect(mockThemeManager.toggleTheme).toHaveBeenCalled();
    });

    it('スペースキーでテーマを切り替える', () => {
      const keydownEvent = new KeyboardEvent('keydown', { key: ' ' });
      mockThemeToggleButton.dispatchEvent(keydownEvent);
      
      expect(mockThemeManager.toggleTheme).toHaveBeenCalled();
    });

    it('その他のキーでは何もしない', () => {
      const keydownEvent = new KeyboardEvent('keydown', { key: 'a' });
      mockThemeToggleButton.dispatchEvent(keydownEvent);
      
      expect(mockThemeManager.toggleTheme).not.toHaveBeenCalled();
    });
  });

  describe('テーマ切り替えボタンのUI更新', () => {
    beforeEach(() => {
      uiController.setThemeManager(mockThemeManager);
    });

    it('ライトテーマ時のボタンUIを正しく設定する', () => {
      (mockThemeManager.getCurrentTheme as Mock).mockReturnValue('light');
      
      // テーマ変更を通知
      uiController.notifyThemeChanged();
      
      expect(mockThemeIcon.textContent).toBe('🌙');
      expect(mockThemeToggleButton.getAttribute('aria-pressed')).toBe('false');
      expect(mockThemeToggleButton.getAttribute('title')).toBe('ダークモードに切り替え');
      expect(mockSrOnlyText.textContent).toBe('現在: ライトモード');
    });

    it('ダークテーマ時のボタンUIを正しく設定する', () => {
      (mockThemeManager.getCurrentTheme as Mock).mockReturnValue('dark');
      
      // テーマ変更を通知
      uiController.notifyThemeChanged();
      
      expect(mockThemeIcon.textContent).toBe('☀️');
      expect(mockThemeToggleButton.getAttribute('aria-pressed')).toBe('true');
      expect(mockThemeToggleButton.getAttribute('title')).toBe('ライトモードに切り替え');
      expect(mockSrOnlyText.textContent).toBe('現在: ダークモード');
    });
  });

  describe('テーマ変更時のUI更新', () => {
    beforeEach(() => {
      uiController.setThemeManager(mockThemeManager);
    });

    it('notifyThemeChanged が正しく動作する', () => {
      const getCurrentThemeSpy = vi.spyOn(mockThemeManager, 'getCurrentTheme');
      
      uiController.notifyThemeChanged();
      
      expect(getCurrentThemeSpy).toHaveBeenCalled();
    });

    it('メーターの色更新が呼び出される', () => {
      // メーターの針に位置を設定
      const meterNeedle = document.getElementById('meter-needle') as HTMLElement;
      meterNeedle.style.left = '60%'; // 10セント相当
      
      uiController.notifyThemeChanged();
      
      // CSS変数が使用されていることを確認
      expect(meterNeedle.style.backgroundColor).toContain('var(');
    });
  });

  describe('エラーハンドリング', () => {
    it('テーマ切り替えボタンが存在しない場合でもエラーにならない', () => {
      // テーマ切り替えボタンを削除
      mockThemeToggleButton.remove();
      
      const uiControllerWithoutButton = new UIController();
      
      expect(() => {
        uiControllerWithoutButton.setThemeManager(mockThemeManager);
      }).not.toThrow();
    });

    it('ThemeManagerが設定されていない場合でもエラーにならない', () => {
      expect(() => {
        uiController.notifyThemeChanged();
      }).not.toThrow();
    });

    it('テーマアイコン要素が存在しない場合でもエラーにならない', () => {
      // アイコン要素を削除
      mockThemeIcon.remove();
      mockSrOnlyText.remove();
      
      uiController.setThemeManager(mockThemeManager);
      
      expect(() => {
        uiController.notifyThemeChanged();
      }).not.toThrow();
    });
  });

  describe('アクセシビリティ', () => {
    beforeEach(() => {
      uiController.setThemeManager(mockThemeManager);
    });

    it('aria-pressed属性が正しく設定される', () => {
      (mockThemeManager.getCurrentTheme as Mock).mockReturnValue('light');
      uiController.notifyThemeChanged();
      expect(mockThemeToggleButton.getAttribute('aria-pressed')).toBe('false');

      (mockThemeManager.getCurrentTheme as Mock).mockReturnValue('dark');
      uiController.notifyThemeChanged();
      expect(mockThemeToggleButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('title属性が正しく設定される', () => {
      (mockThemeManager.getCurrentTheme as Mock).mockReturnValue('light');
      uiController.notifyThemeChanged();
      expect(mockThemeToggleButton.getAttribute('title')).toBe('ダークモードに切り替え');

      (mockThemeManager.getCurrentTheme as Mock).mockReturnValue('dark');
      uiController.notifyThemeChanged();
      expect(mockThemeToggleButton.getAttribute('title')).toBe('ライトモードに切り替え');
    });

    it('スクリーンリーダー用テキストが正しく設定される', () => {
      (mockThemeManager.getCurrentTheme as Mock).mockReturnValue('light');
      uiController.notifyThemeChanged();
      expect(mockSrOnlyText.textContent).toBe('現在: ライトモード');

      (mockThemeManager.getCurrentTheme as Mock).mockReturnValue('dark');
      uiController.notifyThemeChanged();
      expect(mockSrOnlyText.textContent).toBe('現在: ダークモード');
    });
  });
});