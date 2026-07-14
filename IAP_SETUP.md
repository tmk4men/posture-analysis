# App内課金セットアップ（Apple純正StoreKit）

RevenueCat等の中間サービスは使わない。Apple純正のStoreKitを `cordova-plugin-purchase`
（`window.CdvPurchase`）経由で直接叩く。**外部アカウント・APIキー不要。** 購入はApp Storeへ直接。

Web側の連携コードは実装済み（`src/ui/iap.js`）。あとは Capacitorアプリへのプラグイン導入と
Xcode設定、実機テストだけ。所要10〜15分。

前提：App Store Connect に商品が作成済み
- 月額サブスク `com.tomoki.postura.monthly`
- 買い切り `com.tomoki.postura.lifetime`

---

## 1. プラグイン導入（Mac・~/postura）

```bash
cd ~/postura
npm install cordova-plugin-purchase
git pull                 # 最新のWeb（iap.js）を取得
./scripts/ios-sync.sh    # www再生成 → cap sync（プラグインも同期）
```

## 2. Xcode の設定

1. `npx cap open ios` で Xcode を開く
2. App ターゲット → **Signing & Capabilities → ＋ Capability → 「In-App Purchase」** を追加
3. 再ビルド（▶ Run / Archive）

## 3. 実機テスト（Sandbox）

1. 実機に TestFlight/ビルドを入れる
2. iPhone の **設定 → App Store → Sandboxアカウント** でテスト用Apple IDにサインイン
3. アプリでレポート生成 → トレーニング面のブラーにある **「有料版にアップグレード」** をタップ
   → Appleの購入シート → Sandbox購入 → **透かし・ブラーが即消えれば成功**
4. アプリ削除→再インストール後、Safariの開発メニューのコンソールで `window.__posturaRestore()`
   → 復元されればOK

---

## 仕組み（実装済み）

- `src/ui/iap.js`：起動時に商品登録＋StoreKit初期化 → 所有していれば `__posturaSetPro(true)`
- 承認された取引は `finish()`、`finished`/`receiptUpdated`/前面復帰で所有状態を再反映
  → **購入ラグ・中断・別端末購入でも後から確実に解除**
- アップグレードボタンは、アプリ内では純正購入、ブラウザではURLフォールバック（Web版は無料のまま）

## 注意 / トラブル時

- 価格・無料トライアルは App Store Connect の設定がそのまま反映される。
- 商品が「見つからない」場合：プロダクトIDの綴り、契約(有料App)の有効化、
  ビルドのバンドルID（`com.tomoki.postura`）一致、Sandboxサインインを確認。
- `cordova-plugin-purchase` はバージョンでAPIが多少変わる。購入が動かない時は
  `store.order` / `product.getOffer()` まわりを導入版のドキュメントに合わせて調整。
- 所有判定は端末ローカル（`store.owned()`）。厳密なサーバ検証を足すなら、App Store
  Server API / Server Notifications V2 を別途（`IAP_NOTES.md` 参照）。当面は不要。

関連: [[posture-app-store-distribution]] / IAP_NOTES.md
