# アプリ内課金（Apple IAP）実装メモ ── 購入ラグ対策つき

このWeb repo には StoreKit のコードは入れられない（ネイティブiOSアプリ側にしか置けない）。
ここは **iOSアプリ側で実装すべき仕様** と、**Web側が用意済みの受け口（ブリッジ）** を記録する。

## 前提：課金モデル
- **自動更新サブスク**（例 ¥3,900/月・7日無料トライアル＝Introductory Offer）
- **非消耗型（買い切り／ライフタイム解除）**（例 ¥49,800）
- Small Business Program 登録で手数料 30% → **15%**（年商1,000万円未満で該当）

## 「呼び出しまでのタイムラグで購入失敗」への対策（StoreKit 2）

購入は `purchase()` を呼んでから確定まで時間差がある。Ask to Buy・中断・ネットワークで
結果が **後から / アプリ再起動後に** 届くことがある。短いタイムアウトで失敗扱いにすると、
実際は成功した購入がロックされたままになる。これを防ぐための必須実装：

1. **商品を先読みキャッシュ**：起動時に `Product.products(for:)` を実行して保持。
   購入ボタンは商品ロード完了まで無効＋スピナー（タップ時にネットワーク待ちを起こさない）。
2. **`Transaction.updates` リスナーを起動時に常設**（← 最重要）。
   `App` 初期化で `Task { for await update in Transaction.updates { … } }` を回し、
   遅れて届いた取引もここで検証→権利付与→`finish()`。purchase() の戻り値だけに依存しない。
3. **起動時に `Transaction.currentEntitlements` を照合**して権利を復元
   （アプリ終了中に完了した購入も次回起動で解除される）。
4. **`purchase()` の結果分岐**：
   - `.success(verification)` → `checkVerified` で検証 → 権利付与 → `finish()`
   - `.pending` → 「承認待ち（Ask to Buy）」表示。**失敗にしない**。
   - `.userCancelled` → 無言で戻す
   - それ以外 → 「時間をおいて再試行」（永続失敗にしない）
5. **短いタイムアウトで失敗扱いにしない**。待ち続け、確定は updates リスナーに委ねる。
6. **購入ボタンを多重防止**（処理中は再タップ無効）。
7. **「購入を復元」導線**：`AppStore.sync()`。
8. **返金・失効の追従**：App Store Server Notifications V2（サーバ）or currentEntitlements 再照合。

## Web ⇄ ネイティブ ブリッジ（Web側は実装済み）

WebView/Capacitor 包装の場合、権利状態はネイティブが真実源。確定を検知したら
**遅れて届いても** 下記いずれかで Web に通知すれば、その場でトレーニング面のブラーと
透かしが外れる（`src/ui/paywall.js` に実装済み）：

```swift
// 権利付与時
webView.evaluateJavaScript("window.__posturaSetPro(true)")
// or
webView.evaluateJavaScript("window.postMessage({type:'posturaEntitlement', pro:true}, '*')")

// 失効時
webView.evaluateJavaScript("window.__posturaSetPro(false)")
```

Web側の受け口（`initEntitlementBridge()` が起動時に登録）：
- `window.__posturaSetPro(bool)` … 直接フラグ更新＋UI即反映
- `window.postMessage({type:'posturaEntitlement', pro:bool})` … メッセージ経由
- 前面復帰（`visibilitychange`）で再同期し、遅れて確定した購入を取りこぼさない

Web側は購入を **失敗扱いしない**。ネイティブが確定を push した時点で解除するだけなので、
購入ラグがあっても最終的に必ず整合する（楽観ロック＝localStorage にも保持）。

## 注意
- Web版（GitHub Pages）は Apple 決済を呼べない。Web は「無料お試し funnel」、
  課金は iOSアプリで、という棲み分け（[[posture-app-store-distribution]]）。
- 健康系の審査・販売文言は非医療トーンを厳守（診断表現を避ける）。
