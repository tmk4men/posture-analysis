#!/usr/bin/env bash
# Bump the cache-buster ?v=... on CSS/JS references in app.html and index.html.
#
# Why: GitHub Pages serves static assets with ~10-minute browser cache, so
# returning users may see stale JS/CSS after a deploy. Bumping the query
# string on every release forces the browser to fetch fresh files.
#
# Usage: ./scripts/bump-cache.sh  (run before `git commit && git push`)
#
# The version is a UTC timestamp (YYYYMMDD-HHMM). It is written into the
# import specifiers of every module under src/ as well, because the modules
# use plain static imports.
#
# なぜ動的 import で伝播させないか：以前は各モジュールが
#   const V = new URL(import.meta.url).search;
#   const { X } = await import("./y.js" + V);
# という形で ?v= を引き継いでいたが、これはトップレベル await を使う。
# トップレベル await は Safari 15（iOS 15）以降にしか無いため、それより古い
# iPhone ではファイルが構文エラーになりアプリが丸ごと起動しなかった。
# 静的 import に戻し、バージョンはこのスクリプトが書き込む方式にした。

set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="$(date -u +%Y%m%d-%H%M)"
echo "Bumping cache version to v=${VERSION}"

# HTML の参照と、src/ 配下の import 指定子をまとめて置き換える。
FILES=(app.html index.html)
while IFS= read -r f; do FILES+=("$f"); done < <(find src -name '*.js')

sed -i -E "s/\\?v=[A-Za-z0-9_-]+/?v=${VERSION}/g" "${FILES[@]}"

echo "Updated:"
grep -rnE "\\?v=" app.html index.html src | head -40 || true

# 取りこぼし検出：src の相対 import に ?v= が付いていない行があれば警告する。
MISSING="$(grep -rnE 'from "\.\.?/[^"]+\.js"' src || true)"
if [ -n "$MISSING" ]; then
  echo
  echo "WARNING: ?v= の付いていない import があります（キャッシュが切れません）:"
  echo "$MISSING"
fi
