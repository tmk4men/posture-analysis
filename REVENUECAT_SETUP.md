# RevenueCat 連携セットアップ（iOS課金）

Webのコード連携は実装済み（`src/ui/iap.js`）。あとは **RevenueCat側の設定** と
**Capacitorアプリへのプラグイン導入**、**実機テスト**だけ。所要15〜20分。

購入・中断・復元・レシート検証・権利同期は RevenueCat が自動処理する。権利が確定すると
`window.__posturaSetPro(true)` が呼ばれ、レポートの透かし・トレーニングのブラーが即解除される。

---

## 1. RevenueCat プロジェクトを作る（ダッシュボード）

1. https://app.revenuecat.com で無料アカウント作成 → New Project「Postura」
2. **Apps → ＋ → App Store** を追加
   - Bundle ID: `com.tomoki.postura`
   - App Store Connect の共有シークレット or App-Specific Shared Secret を設定（画面の指示どおり）
3. **API Keys** → 「Apple App Store」の **Public key（`appl_...`）** をコピー
   → `src/ui/iap.js` の `RC_API_KEY` に貼る（下の手順5でまとめて反映）

## 2. 商品を取り込む（Products）

1. RevenueCat → **Products → ＋ Import** で App Store Connect から取り込み、または手動追加：
   - `com.tomoki.postura.monthly`（月額サブスク）
   - `com.tomoki.postura.lifetime`（買い切り）

## 3. Entitlement と Offering

1. **Entitlements → ＋** → 識別子 **`pro`** を作成
   - `monthly` と `lifetime` の両方をこの `pro` に紐付ける（どちらを買っても pro になる）
2. **Offerings → Current offering** に、月額（と買い切り）の Package を追加
   - コードは `offerings.current.availablePackages[0]` を購入するので、**月額を先頭**にしておく

## 4. Capacitorアプリにプラグイン導入（Mac・~/postura）

```bash
cd ~/postura
npm install @revenuecat/purchases-capacitor
git pull                       # 最新のWeb（iap.js等）を取得
./scripts/ios-sync.sh          # www再生成 → cap sync（プラグインも同期される）
```

## 5. APIキーを入れて反映

1. `src/ui/iap.js` の `RC_API_KEY` を、手順1でコピーした `appl_...` に変更
2. Web側を再デプロイ：`./scripts/release.sh "RevenueCat APIキー設定"`（Windows側）
   - Macで作業しているなら、`git commit`→`git push` 後に `~/postura` で `git pull && ./scripts/ios-sync.sh`
3. Xcode で再ビルド

## 6. 実機テスト（Sandbox）

1. 実機に TestFlight/ビルドを入れる
2. 設定 → App Store → **Sandboxアカウント**でサインイン（テスト購入用）
3. アプリでレポート生成 → トレーニング面のブラーの **「有料版にアップグレード」** をタップ
   → 購入シートが出る → Sandbox購入 → **ブラー・透かしが即消えれば成功**
4. アプリ削除→再インストール後、コンソール（Safari開発メニュー）で `window.__posturaRestore()` を実行
   → 復元されれば復元処理もOK

## 注意 / トラブル時

- RevenueCat Capacitorプラグインのメソッド名/引数はバージョンで変わることがある。
  購入が動かない場合は `purchasePackage` の引数（`{ aPackage: pkg }`）まわりを、
  導入した `@revenuecat/purchases-capacitor` のバージョンのドキュメントに合わせて調整。
- 権利識別子は **`pro`** で固定（`src/ui/iap.js` の `ENTITLEMENT`）。RevenueCat側と一致させる。
- 価格・無料トライアルは App Store Connect 側の設定がそのまま反映される。

関連: [[posture-app-store-distribution]]（appId 6790814436 / 月額¥800・買い切り¥2,100）
