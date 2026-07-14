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
- 書き込み系（課金作成・審査提出・メタ更新）は次段で追加予定。まず読み取りで疎通確認を。
