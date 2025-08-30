# デプロイメントガイド

## 概要

このドキュメントでは、ギターチューナーWebアプリケーションを本番環境にデプロイする手順を説明します。

## 前提条件

- Node.js 18以上
- npm または yarn
- HTTPS対応のWebホスティングサービス（マイクアクセスに必要）

## ビルドとテスト

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 本番用ビルド

```bash
# 完全なビルドとテスト
npm run deploy:ready

# または個別実行
npm run lint          # TypeScriptチェック
npm run test          # テスト実行
npm run build         # 本番ビルド
npm run deploy:test   # 本番テスト
```

### 3. ローカルでの本番テスト

```bash
# HTTPS環境でのテスト（推奨）
npm run preview:https

# HTTP環境でのテスト（マイクアクセス制限あり）
npm run preview
```

## デプロイメント方法

### Netlify

1. `dist` フォルダをNetlifyにドラッグ&ドロップ
2. または Git連携でデプロイ

**Build settings:**
- Build command: `npm run deploy:build`
- Publish directory: `dist`

### Vercel

```bash
# Vercel CLIを使用
npx vercel --prod

# または Git連携でデプロイ
```

**Build settings:**
- Build command: `npm run deploy:build`
- Output directory: `dist`

### GitHub Pages

1. GitHub Actionsを設定
2. `dist` フォルダを `gh-pages` ブランチにプッシュ

### Apache/Nginx

1. `dist` フォルダの内容をWebサーバーにアップロード
2. `.htaccess` ファイルが適切に配置されていることを確認

## セキュリティ設定

### HTTPS必須

マイクアクセスにはHTTPS接続が必要です。以下を確認してください：

- SSL証明書が有効
- HTTPからHTTPSへのリダイレクト設定
- HSTS（HTTP Strict Transport Security）の有効化

### Content Security Policy

以下のCSPが設定されています：

```
default-src 'self'; 
script-src 'self' 'unsafe-inline'; 
style-src 'self' 'unsafe-inline'; 
media-src 'self' blob:; 
connect-src 'self'; 
img-src 'self' data:; 
font-src 'self'; 
object-src 'none'; 
base-uri 'self'; 
form-action 'self'; 
frame-ancestors 'none';
```

### セキュリティヘッダー

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: microphone=(self), camera=(), geolocation=(), payment=()`

## パフォーマンス最適化

### ファイルサイズ

- JavaScript: ~27KB (gzipped: ~8KB)
- CSS: ~16KB (gzipped: ~4KB)
- HTML: ~4KB (gzipped: ~1KB)

### キャッシュ戦略

- HTML: キャッシュなし
- CSS/JS: 1年間キャッシュ（ハッシュ付きファイル名）
- 画像: 1年間キャッシュ

### 圧縮

- Gzip圧縮が有効
- Brotli圧縮（サポートされている場合）

## 監視とメンテナンス

### エラー監視

本番環境では以下の監視を推奨：

- JavaScript エラーの監視
- マイクアクセスエラーの監視
- パフォーマンス監視

### 定期メンテナンス

- 依存関係の更新
- セキュリティパッチの適用
- ブラウザ互換性の確認

## トラブルシューティング

### マイクアクセスが動作しない

1. HTTPS接続を確認
2. ブラウザの設定を確認
3. Permissions Policyを確認

### 音程検出が不正確

1. マイクの音量レベルを確認
2. 背景ノイズの影響を確認
3. ブラウザのWeb Audio API対応を確認

### パフォーマンスの問題

1. ネットワーク速度を確認
2. デバイスの性能を確認
3. 他のタブやアプリケーションの影響を確認

## サポートブラウザ

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+
- iOS Safari 14+
- Android Chrome 88+

## 連絡先

技術的な問題やサポートが必要な場合は、プロジェクトのIssueトラッカーを使用してください。