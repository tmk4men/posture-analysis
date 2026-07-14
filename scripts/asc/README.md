# App Store Connect 自動化CLI（複数アプリで使い回し可）

秘密鍵は端末に置いたまま、ストア運用をコマンドで自動化するツール（Node標準のみ・依存なし）。
**このアプリ専用ではありません。** APIキーは Apple アカウント（チーム）単位なので、
**1つの鍵で同じアカウントの全アプリを操作**できます。他アプリのリリースでもそのまま使えます。

## 1. 認証情報を発行（初回のみ・アカウントごとに1回）

App Store Connect →「ユーザーとアクセス」→「Integrations／キー」→ **App Store Connect API** で
チーム用キーを作成し、以下3点を取得：

- **Issuer ID**
- **Key ID**
- **秘密鍵 `.p8`**（ダウンロードは一度きり）

## 2. グローバル設定を1つ用意（全プロジェクト共通）

`~/.asc/config.json` を作成（`~` はホーム。Windowsは `C:\Users\<あなた>\.asc\config.json`）：

```json
{
  "default": "main",
  "profiles": {
    "main":     { "keyId": "XXXXXXXXXX", "issuerId": "....", "keyPath": "AuthKey_XXXXXXXXXX.p8" },
    "clientB":  { "keyId": "YYYYYYYYYY", "issuerId": "....", "keyPath": "AuthKey_YYYYYYYYYY.p8" }
  }
}
```

- `.p8` は `~/.asc/` に置けば `keyPath` は相対名でOK（絶対パスも可）。
- **同じアカウントの複数アプリ**なら profile は1つでよい（appId を変えるだけ）。
- **別Appleアカウント**を扱うときだけ profile を足し、`--profile clientB` で切替。
- 単一アカウントだけなら `{ "keyId":"", "issuerId":"", "keyPath":"" }` のフラット形でも可。

> プロジェクト固有にしたい場合は、そのプロジェクト直下に `./.asc.json` を置くと優先される。
> 設定探索順： 環境変数 → `./.asc.json` → `<スクリプト>/.asc.json` → `~/.asc/config.json`

## 3. どこからでも呼べるようにする（任意）

```bash
cd scripts/asc && npm link      # 以後 "asc" コマンドが全ディレクトリで使える
```

未導入でも `node scripts/asc/asc.mjs <command>` で同じことができる。

## 4. 実行

```bash
asc apps                       # アプリ一覧（appId確認）
asc iaps <appId>               # App内課金一覧
asc subgroups <appId> / subs <groupId>
asc builds <appId>
asc get /v1/apps limit=5       # 任意GET
asc sales <vendorNumber>       # 売上サマリー(前日)
asc profiles                   # 設定済みプロファイル確認
asc apps --profile clientB     # アカウント切替
```

最初の疎通は **`asc apps`**。appId が分かれば以降のコマンドに使える。

## セキュリティ

- `.p8` と `.asc.json` / `config.json` は **絶対にコミットしない**（リポジトリ側は `.gitignore` 済み。
  `~/.asc/` はそもそもリポジトリ外）。
- JWT は20分で失効し、実行のたびに生成される。
## 書き込み系（作成・更新・削除）

**安全策：書き込みは既定でドライラン**（送信内容を表示するだけ）。実際に送るときだけ `--yes`。

```bash
asc post <path> <body.json|-|'{...}'>    # 作成
asc patch <path> <body.json|-|'{...}'>   # 更新
asc delete <path>                         # 削除
asc whatsnew <appId> ja "軽微な改善。"     # 新機能テキスト更新（ガイド付き）
```

- ボディは「ファイルパス」「`-`(標準入力)」「その場のJSON文字列」のいずれでも可。
- まず `--yes` 無しで実行 → 送信内容を確認 → 問題なければ `--yes` を付けて再実行。
- Windowsの **Git Bash** はパス自動変換で `/v1/...` が化けることがある。**PowerShell推奨**、
  または Git Bash なら `MSYS_NO_PATHCONV=1 asc get /v1/apps` のように無効化する。

### レシピ①：買い切り（非消耗）課金を作る
```bash
# 1) 課金を作成（productId は逆ドメインで一意に）
asc post /v2/inAppPurchases '{"data":{"type":"inAppPurchases",
  "attributes":{"name":"永久解除","productId":"com.you.app.lifetime","inAppPurchaseType":"NON_CONSUMABLE"},
  "relationships":{"app":{"data":{"type":"apps","id":"<appId>"}}}}}' --yes
# 2) 日本語ローカライズ
asc post /v1/inAppPurchaseLocalizations '{"data":{"type":"inAppPurchaseLocalizations",
  "attributes":{"locale":"ja","name":"永久解除","description":"全機能を無制限に利用できます。"},
  "relationships":{"inAppPurchaseV2":{"data":{"type":"inAppPurchases","id":"<iapId>"}}}}}' --yes
# 3) 価格ポイントを調べる → 価格スケジュール作成
asc get /v2/inAppPurchases/<iapId>/pricePoints filter[territory]=JPN limit=200
asc post /v1/inAppPurchasePriceSchedules '{ ... 上で選んだ pricePoint を参照 ... }' --yes
# 4) 審査に提出
asc post /v1/inAppPurchaseSubmissions '{"data":{"type":"inAppPurchaseSubmissions",
  "relationships":{"inAppPurchaseV2":{"data":{"type":"inAppPurchases","id":"<iapId>"}}}}}' --yes
```

### レシピ②：自動更新サブスク＋無料トライアル
```bash
# 1) グループ（無ければ）
asc post /v1/subscriptionGroups '{"data":{"type":"subscriptionGroups",
  "attributes":{"referenceName":"Main"},"relationships":{"app":{"data":{"type":"apps","id":"<appId>"}}}}}' --yes
# 2) サブスク本体（月額）
asc post /v1/subscriptions '{"data":{"type":"subscriptions",
  "attributes":{"name":"月額プラン","productId":"com.you.app.monthly","subscriptionPeriod":"ONE_MONTH","groupLevel":1},
  "relationships":{"group":{"data":{"type":"subscriptionGroups","id":"<groupId>"}}}}}' --yes
# 3) ローカライズ / 価格（pricePoint取得→ /v1/subscriptionPrices）/ 4) 無料トライアル
asc post /v1/subscriptionIntroductoryOffers '{ ...FREE_TRIAL, 期間 ... }' --yes
```

> 価格まわり（pricePoint）はアプリ・地域ごとにIDが変わるため、必ず `get` で調べてから投入する。
> どのレシピも **まず `--yes` 無しでドライラン**して本文を確認するのが安全。
