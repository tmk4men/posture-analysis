#!/usr/bin/env bash
# Web版を1コマンドでリリース（キャッシュバスター更新→コミット→push→GitHub Pages反映）。
#
# 使い方:
#   ./scripts/release.sh                 # 既定メッセージでリリース
#   ./scripts/release.sh "CTA文言を調整" # コミットメッセージ指定
#
# ※ Web用（このリポジトリ）専用。Macの Capacitor クローンでは実行しないこと
#   （iOS生成物は .gitignore 済みだが、混乱を避けるため Windows 側で運用）。

set -euo pipefail
cd "$(dirname "$0")/.."

MSG="${1:-release: bump assets}"

echo "▶ キャッシュバスター更新"
bash scripts/bump-cache.sh

if git diff --quiet && git diff --cached --quiet; then
  echo "変更なし。リリースをスキップします。"
  exit 0
fi

echo "▶ コミット & push"
git add -A
git commit -m "$MSG"
git push origin main

echo "✅ デプロイ完了。数十秒〜2分で https://tmk4men.github.io/posture-analysis/ に反映されます。"
