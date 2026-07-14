#!/usr/bin/env bash
# Macの Capacitor クローンで実行：最新のWebをアプリに反映する（www更新 → cap sync）。
#
# 使い方（Mac、~/postura で）:
#   git pull                 # 最新のWebを取得（※ローカルで index.html 等を書き換えていないこと）
#   ./scripts/ios-sync.sh    # www を作り直して iOS に同期
# そのあと Xcode で再ビルド（▶ Run / Archive）。

set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ www を作り直し"
rm -rf www
mkdir -p www
cp -R app.html app.css src assets icons sw.js manifest.json favicon.svg www/
# アプリ起動時にツール(app.html)を開く
cp app.html www/index.html

echo "▶ Capacitor に同期"
npx cap sync ios

echo "✅ 反映完了。Xcode で再ビルドしてください。"
