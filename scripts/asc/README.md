# App Store Connect 自動化CLI

秘密鍵はあなたの端末に置いたまま、ストア運用をコマンドで自動化するツール（Node標準のみ・依存なし）。

## 1. 認証情報を発行（初回のみ）

App Store Connect →「ユーザーとアクセス」→「Integrations（統合）／キー」→ **App Store Connect API** で
チーム用キーを作成し、以下3点を取得：

- **Issuer ID**（ページ上部に表示）
- **Key ID**（作成したキーの行）
- **秘密鍵 `.p8`**（**ダウンロードは一度きり**。無くさないこと）

> ロールは、まず読み取り中心なら「Developer」「App Manager」等。課金/メタデータを書き換えるなら
> 「Admin」または該当権限が要る。

## 2. 認証情報をこのツールに渡す（2通り・どちらでも）

**A. 設定ファイル（おすすめ）**：`scripts/asc/.asc.json` を作成（このファイルは .gitignore 済み）

```json
{
  "keyId": "XXXXXXXXXX",
  "issuerId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "keyPath": "AuthKey_XXXXXXXXXX.p8"
}
```

`.p8` は `scripts/asc/` に置けば `keyPath` は相対名でOK（絶対パスも可）。`.p8` もコミットされない。

**B. 環境変数**

```bash
export ASC_KEY_ID=XXXXXXXXXX
export ASC_ISSUER_ID=aaaaaaaa-bbbb-...
export ASC_KEY_PATH=/path/to/AuthKey_XXXXXXXXXX.p8
```

## 3. 実行

```bash
node scripts/asc/asc.mjs token        # 疎通確認用のJWTを出力
node scripts/asc/asc.mjs apps         # アプリ一覧（appId をここで確認）
node scripts/asc/asc.mjs iaps <appId> # App内課金一覧
node scripts/asc/asc.mjs subgroups <appId>
node scripts/asc/asc.mjs subs <groupId>
node scripts/asc/asc.mjs builds <appId>
node scripts/asc/asc.mjs get /v1/apps limit=5   # 任意のGET
node scripts/asc/asc.mjs sales <vendorNumber>   # 売上サマリー(前日)
```

最初の疎通は **`apps`** が分かりやすい（appId が分かれば以降のコマンドに使える）。

## セキュリティ

- `.p8` と `.asc.json` は **絶対にコミットしない**（`.gitignore` 済み）。
- JWT は20分で失効。毎回コマンド実行時に生成される。
- 書き込み系（課金作成・審査提出・メタ更新）は次段で追加予定。まずは読み取りで疎通を確認。
