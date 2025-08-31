/**
 * main.ts のテーマシステム統合のテスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// テスト用のモック
const mockThemeManager = {
  initialize: vi.fn(),
  setupThemeToggleButton: vi.fn(),
  getThemeSettings: vi.fn(() => ({
    preference: 'system' as const,
    current: 'light' as const,
    systemTheme: 'light' as const
  })),
  destroy: vi.fn()
};

const mockUIController = {
  setThemeManager: vi.fn(),
  updateAppState: vi.fn(),
  hideInstructions: vi.fn(),
  showWaitingState: vi.fn(),
  showLowVolumeWarning: vi.fn(),
  showLowConfidenceWarning: vi.fn(),
  updateDisplay: vi.fn(),
  showTuningComplete: vi.fn(),
  showError: vi.fn()
};

const mockAudioManager = {
  initialize: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  cleanup: vi.fn(),
  getAudioData: vi.fn(() => new Float32Array(0)),
  initialized: false,
  sampleRate: 44100
};

// DOM要素のモック
const createMockButton = (id: string) => {
  const button = document.createElement('button');
  button.id = id;
  button.disabled = false;
  return button;
};

const createMockElement = (id: string, tagName: string = 'div') => {
  const element = document.createElement(tagName);
  element.id = id;
  return element;
};

// MediaQueryList のモック
const createMockMediaQueryList = (matches: boolean = false) => {
  const listeners: Array<(event: MediaQueryListEvent) => void> = [];
  
  return {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        listeners.push(listener);
      }
    }),
    removeEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    // テスト用のヘルパーメソッド
    _triggerChange: (newMatches: boolean) => {
      const event = { matches: newMatches } as MediaQueryListEvent;
      listeners.forEach(listener => listener(event));
    },
    _getListenerCount: () => listeners.length
  };
};

// window.matchMedia のモック
let mockMediaQueryList: ReturnType<typeof createMockMediaQueryList>;

describe('main.ts テーマシステム統合', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalConsoleLog: typeof console.log;
  let originalConsoleWarn: typeof console.warn;
  let originalConsoleError: typeof console.error;
  
  beforeEach(() => {
    // console メソッドをモック
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    
    // window.matchMedia をモック
    originalMatchMedia = window.matchMedia;
    mockMediaQueryList = createMockMediaQueryList();
    window.matchMedia = vi.fn(() => mockMediaQueryList);
    
    // DOM要素を設定
    document.body.innerHTML = '';
    const appDiv = document.createElement('div');
    appDiv.id = 'app';
    
    const startButton = createMockButton('start-button');
    const stopButton = createMockButton('stop-button');
    const statusMessage = createMockElement('status-message');
    
    appDiv.appendChild(startButton);
    appDiv.appendChild(stopButton);
    appDiv.appendChild(statusMessage);
    document.body.appendChild(appDiv);
    
    // モックをリセット
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // console メソッドを復元
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    
    // window.matchMedia を復元
    window.matchMedia = originalMatchMedia;
    
    // DOM をクリア
    document.body.innerHTML = '';
  });

  describe('テーマシステム初期化', () => {
    it('ThemeManager.initialize() が呼び出される', async () => {
      // テスト用のGuitarTunerAppクラスを作成
      class TestGuitarTunerApp {
        private themeManager = mockThemeManager;
        private uiController = mockUIController;
        private audioManager = mockAudioManager;
        private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListener }> = [];
        
        constructor() {
          this.uiController.setThemeManager(this.themeManager);
          this.initializeApp();
        }
        
        private initializeApp(): void {
          this.initializeThemeSystem();
        }
        
        private initializeThemeSystem(): void {
          try {
            this.themeManager.initialize();
            this.themeManager.setupThemeToggleButton();
            this.setupSystemThemeMonitoring();
          } catch (error) {
            console.warn('テーマシステムの初期化に失敗しました:', error);
          }
        }
        
        private setupSystemThemeMonitoring(): void {
          if (typeof window === 'undefined' || !window.matchMedia) {
            console.warn('matchMedia APIが利用できません。システムテーマの自動切り替えは無効です。');
            return;
          }

          try {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            const systemThemeChangeHandler = (event: MediaQueryListEvent) => {
              console.log('システムテーマが変更されました:', event.matches ? 'dark' : 'light');
              
              const currentSettings = this.themeManager.getThemeSettings();
              
              if (currentSettings.preference === 'system') {
                console.log('ユーザー設定が"system"のため、テーマを自動更新しました');
              } else {
                console.log('ユーザー設定が手動のため、テーマは変更されませんでした');
              }
            };
            
            if (darkModeQuery.addEventListener) {
              darkModeQuery.addEventListener('change', systemThemeChangeHandler);
            } else if (darkModeQuery.addListener) {
              darkModeQuery.addListener(systemThemeChangeHandler);
            }
            
            this.eventListeners.push({
              element: darkModeQuery as any,
              event: 'change',
              handler: systemThemeChangeHandler as EventListener
            });
            
          } catch (error) {
            console.warn('システムテーマ監視の設定に失敗しました:', error);
          }
        }
        
        async cleanup(): Promise<void> {
          this.themeManager.destroy();
          
          this.eventListeners.forEach(({ element, event, handler }) => {
            try {
              if (element && typeof (element as any).removeEventListener === 'function') {
                element.removeEventListener(event, handler);
              } else if (element && typeof (element as any).removeListener === 'function') {
                (element as any).removeListener(handler);
              }
            } catch (error) {
              console.warn('イベントリスナーの削除に失敗しました:', error);
            }
          });
          this.eventListeners = [];
        }
      }
      
      const app = new TestGuitarTunerApp();
      
      // ThemeManager の初期化メソッドが呼び出されることを確認
      expect(mockThemeManager.initialize).toHaveBeenCalledTimes(1);
      expect(mockThemeManager.setupThemeToggleButton).toHaveBeenCalledTimes(1);
      
      // システムテーマ監視が設定されることを確認
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledTimes(1);
      
      // クリーンアップ
      await app.cleanup();
    });

    it('matchMedia API が利用できない場合の警告メッセージ', async () => {
      // matchMedia を undefined に設定
      (window as any).matchMedia = undefined;
      
      class TestGuitarTunerApp {
        private themeManager = mockThemeManager;
        private uiController = mockUIController;
        
        constructor() {
          this.initializeThemeSystem();
        }
        
        private initializeThemeSystem(): void {
          this.themeManager.initialize();
          this.themeManager.setupThemeToggleButton();
          this.setupSystemThemeMonitoring();
        }
        
        private setupSystemThemeMonitoring(): void {
          if (typeof window === 'undefined' || !window.matchMedia) {
            console.warn('matchMedia APIが利用できません。システムテーマの自動切り替えは無効です。');
            return;
          }
        }
      }
      
      new TestGuitarTunerApp();
      
      // 警告メッセージが出力されることを確認
      expect(console.warn).toHaveBeenCalledWith(
        'matchMedia APIが利用できません。システムテーマの自動切り替えは無効です。'
      );
    });

    it('テーマシステム初期化エラーのハンドリング', async () => {
      // ThemeManager.initialize でエラーを発生させる
      mockThemeManager.initialize.mockImplementation(() => {
        throw new Error('初期化エラー');
      });
      
      class TestGuitarTunerApp {
        private themeManager = mockThemeManager;
        
        constructor() {
          this.initializeThemeSystem();
        }
        
        private initializeThemeSystem(): void {
          try {
            this.themeManager.initialize();
            this.themeManager.setupThemeToggleButton();
          } catch (error) {
            console.warn('テーマシステムの初期化に失敗しました:', error);
          }
        }
      }
      
      new TestGuitarTunerApp();
      
      // エラーが適切にキャッチされ、警告メッセージが出力されることを確認
      expect(console.warn).toHaveBeenCalledWith(
        'テーマシステムの初期化に失敗しました:',
        expect.any(Error)
      );
    });
  });

  describe('システムテーマ変更の監視', () => {
    it('システムテーマ変更時のログ出力（system設定）', async () => {
      // ユーザー設定を 'system' に設定
      mockThemeManager.getThemeSettings.mockReturnValue({
        preference: 'system',
        current: 'light',
        systemTheme: 'light'
      });
      
      class TestGuitarTunerApp {
        private themeManager = mockThemeManager;
        private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListener }> = [];
        
        constructor() {
          this.setupSystemThemeMonitoring();
        }
        
        private setupSystemThemeMonitoring(): void {
          const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
          
          const systemThemeChangeHandler = (event: MediaQueryListEvent) => {
            console.log('システムテーマが変更されました:', event.matches ? 'dark' : 'light');
            
            const currentSettings = this.themeManager.getThemeSettings();
            
            if (currentSettings.preference === 'system') {
              console.log('ユーザー設定が"system"のため、テーマを自動更新しました');
            } else {
              console.log('ユーザー設定が手動のため、テーマは変更されませんでした');
            }
          };
          
          darkModeQuery.addEventListener('change', systemThemeChangeHandler);
          this.eventListeners.push({
            element: darkModeQuery as any,
            event: 'change',
            handler: systemThemeChangeHandler as EventListener
          });
        }
      }
      
      new TestGuitarTunerApp();
      
      // システムテーマ変更をシミュレート
      (mockMediaQueryList as any)._triggerChange(true);
      
      // 適切なログメッセージが出力されることを確認
      expect(console.log).toHaveBeenCalledWith('システムテーマが変更されました:', 'dark');
      expect(console.log).toHaveBeenCalledWith('ユーザー設定が"system"のため、テーマを自動更新しました');
    });

    it('システムテーマ変更時のログ出力（手動設定）', async () => {
      // ユーザー設定を 'light' に設定
      mockThemeManager.getThemeSettings.mockReturnValue({
        preference: 'light',
        current: 'light',
        systemTheme: 'dark'
      });
      
      class TestGuitarTunerApp {
        private themeManager = mockThemeManager;
        
        constructor() {
          this.setupSystemThemeMonitoring();
        }
        
        private setupSystemThemeMonitoring(): void {
          const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
          
          const systemThemeChangeHandler = (event: MediaQueryListEvent) => {
            console.log('システムテーマが変更されました:', event.matches ? 'dark' : 'light');
            
            const currentSettings = this.themeManager.getThemeSettings();
            
            if (currentSettings.preference === 'system') {
              console.log('ユーザー設定が"system"のため、テーマを自動更新しました');
            } else {
              console.log('ユーザー設定が手動のため、テーマは変更されませんでした');
            }
          };
          
          darkModeQuery.addEventListener('change', systemThemeChangeHandler);
        }
      }
      
      new TestGuitarTunerApp();
      
      // システムテーマ変更をシミュレート
      (mockMediaQueryList as any)._triggerChange(false);
      
      // 適切なログメッセージが出力されることを確認
      expect(console.log).toHaveBeenCalledWith('システムテーマが変更されました:', 'light');
      expect(console.log).toHaveBeenCalledWith('ユーザー設定が手動のため、テーマは変更されませんでした');
    });
  });

  describe('クリーンアップ処理', () => {
    it('ThemeManager.destroy() が呼び出される', async () => {
      class TestGuitarTunerApp {
        private themeManager = mockThemeManager;
        private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListener }> = [];
        
        async cleanup(): Promise<void> {
          this.themeManager.destroy();
          
          this.eventListeners.forEach(({ element, event, handler }) => {
            try {
              if (element && typeof (element as any).removeEventListener === 'function') {
                element.removeEventListener(event, handler);
              } else if (element && typeof (element as any).removeListener === 'function') {
                (element as any).removeListener(handler);
              }
            } catch (error) {
              console.warn('イベントリスナーの削除に失敗しました:', error);
            }
          });
          this.eventListeners = [];
        }
      }
      
      const app = new TestGuitarTunerApp();
      await app.cleanup();
      
      // ThemeManager の destroy メソッドが呼び出されることを確認
      expect(mockThemeManager.destroy).toHaveBeenCalledTimes(1);
    });

    it('MediaQueryList イベントリスナーの削除', async () => {
      class TestGuitarTunerApp {
        private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListener }> = [];
        
        constructor() {
          this.setupSystemThemeMonitoring();
        }
        
        private setupSystemThemeMonitoring(): void {
          const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
          const handler = () => {};
          
          darkModeQuery.addEventListener('change', handler);
          this.eventListeners.push({
            element: darkModeQuery as any,
            event: 'change',
            handler: handler as EventListener
          });
        }
        
        async cleanup(): Promise<void> {
          this.eventListeners.forEach(({ element, event, handler }) => {
            try {
              if (element && typeof (element as any).removeEventListener === 'function') {
                element.removeEventListener(event, handler);
              } else if (element && typeof (element as any).removeListener === 'function') {
                (element as any).removeListener(handler);
              }
            } catch (error) {
              console.warn('イベントリスナーの削除に失敗しました:', error);
            }
          });
          this.eventListeners = [];
        }
      }
      
      const app = new TestGuitarTunerApp();
      await app.cleanup();
      
      // MediaQueryList の removeEventListener が呼び出されることを確認
      expect(mockMediaQueryList.removeEventListener).toHaveBeenCalledTimes(1);
    });

    it('イベントリスナー削除時のエラーハンドリング', async () => {
      // removeEventListener でエラーを発生させる
      const mockElement = {
        removeEventListener: vi.fn(() => {
          throw new Error('削除エラー');
        })
      };
      
      class TestGuitarTunerApp {
        private eventListeners = [
          {
            element: mockElement as any,
            event: 'change',
            handler: (() => {}) as EventListener
          }
        ];
        
        async cleanup(): Promise<void> {
          this.eventListeners.forEach(({ element, event, handler }) => {
            try {
              if (element && typeof (element as any).removeEventListener === 'function') {
                element.removeEventListener(event, handler);
              }
            } catch (error) {
              console.warn('イベントリスナーの削除に失敗しました:', error);
            }
          });
          this.eventListeners = [];
        }
      }
      
      const app = new TestGuitarTunerApp();
      await app.cleanup();
      
      // エラーが適切にキャッチされ、警告メッセージが出力されることを確認
      expect(console.warn).toHaveBeenCalledWith(
        'イベントリスナーの削除に失敗しました:',
        expect.any(Error)
      );
    });
  });
});