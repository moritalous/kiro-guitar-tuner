# 設計書

## 概要

ギター用チューナーWebアプリケーションは、Web Audio APIとMediaStream APIを使用してマイクから音声を取得し、自己相関アルゴリズムによる音程検出を行い、リアルタイムで視覚的フィードバックを提供するシングルページアプリケーションです。

## アーキテクチャ

### システム構成

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   マイク入力     │───▶│  音声処理エンジン  │───▶│   UI表示層      │
│ (MediaStream)   │    │ (Web Audio API) │    │ (HTML/CSS/JS)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  音程検出処理    │
                       │ (Autocorrelation)│
                       └─────────────────┘
```

### 技術スタック

- **フロントエンド**: HTML5, CSS3, TypeScript (Vanilla JS)
- **ビルドツール**: Vite
- **音声処理**: Web Audio API, MediaStream API
- **音程検出**: 自己相関アルゴリズム
- **レスポンシブデザイン**: CSS Grid, Flexbox, Media Queries

## コンポーネントと インターフェース

### 1. AudioManager クラス

マイクアクセスと音声データの取得を管理

```typescript
class AudioManager {
  constructor()
  async initialize(): Promise<void>
  startRecording(): void
  stopRecording(): void
  getAudioData(): Float32Array
}
```

### 2. PitchDetector クラス

自己相関アルゴリズムによる音程検出

```typescript
class PitchDetector {
  constructor(sampleRate: number)
  detectPitch(audioBuffer: Float32Array): number | null
  private autocorrelate(buffer: Float32Array): Float32Array
  private findFundamentalFrequency(correlations: Float32Array): number | null
}
```

### 3. TunerEngine クラス

チューニングロジックとギター音程の管理

```typescript
class TunerEngine {
  constructor()
  analyzeNote(frequency: number): NoteData
  private getClosestGuitarNote(frequency: number): string
  private calculateCentsDifference(frequency: number, targetFrequency: number): number
}
```

### 4. UIController クラス

ユーザーインターフェースの制御

```typescript
class UIController {
  constructor()
  updateDisplay(noteData: NoteData): void
  updateMeter(cents: number): void
  showStatus(message: string): void
  setTuningIndicator(isInTune: boolean): void
}
```

## データモデル

### ギター標準チューニング定義

```typescript
const GUITAR_TUNING: Record<string, number> = {
  E2: 82.41,   // 6弦
  A2: 110.00,  // 5弦
  D3: 146.83,  // 4弦
  G3: 196.00,  // 3弦
  B3: 246.94,  // 2弦
  E4: 329.63   // 1弦
};
```

### 音程データ構造

```typescript
interface NoteData {
  frequency: number;      // 検出された周波数
  note: string;          // 最も近い音程名 (例: "E2")
  cents: number;         // セント単位での差 (-50 to +50)
  isInTune: boolean;     // チューニングが正確か (±5セント以内)
  confidence: number;    // 検出の信頼度 (0-1)
}
```

## エラーハンドリング

### マイクアクセスエラー

- ユーザーがマイクアクセスを拒否した場合
- マイクが利用できない場合
- ブラウザがMediaStream APIをサポートしていない場合

### 音声処理エラー

- Web Audio APIの初期化失敗
- 音声データの取得失敗
- サンプリングレートの不一致

### 音程検出エラー

- ノイズが多すぎて音程を検出できない場合
- 音量が小さすぎる場合
- 複数の音が同時に検出される場合

## テスト戦略

### 単体テスト

1. **PitchDetector テスト**
   - 既知の周波数のサイン波での検証
   - ノイズ耐性のテスト
   - 境界値テスト（低周波数・高周波数）

2. **TunerEngine テスト**
   - ギター各弦の標準周波数での検証
   - セント計算の精度テスト
   - 音程名の正確性テスト

### 統合テスト

1. **音声パイプライン テスト**
   - マイク → 音程検出 → UI更新の流れ
   - リアルタイム処理の性能テスト

2. **ブラウザ互換性テスト**
   - Chrome, Firefox, Safari, Edge での動作確認
   - モバイルブラウザでの動作確認

### ユーザビリティテスト

1. **レスポンシブデザイン テスト**
   - 各デバイスサイズでの表示確認
   - タッチ操作の動作確認

2. **実際のギターでのテスト**
   - 各弦での音程検出精度
   - ノイズ環境での動作確認

## パフォーマンス最適化

### リアルタイム処理

- 音声データの処理を60FPS以下に制限
- 自己相関計算の最適化（FFTベースの実装検討）
- 不要な DOM 更新の削減

### メモリ管理

- 音声バッファの適切なサイズ設定
- 使用済みオーディオコンテキストの解放
- イベントリスナーの適切な削除

### バッテリー効率

- Page Visibility API を使用した非アクティブ時の処理停止
- 音程が安定している時の更新頻度削減

## セキュリティ考慮事項

### プライバシー

- マイクデータはローカル処理のみ（サーバー送信なし）
- ユーザーの明示的な許可後のみマイクアクセス
- 音声データの永続化なし

### ブラウザセキュリティ

- HTTPS必須（getUserMediaの要件）
- Content Security Policy の適用
- XSS対策の実装