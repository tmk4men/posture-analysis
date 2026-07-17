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

# 写真選択は <input type="file" accept="image/*">。iOS はシートの「写真を撮る」で
# カメラを開く直前に Info.plist を見に行き、NSCameraUsageDescription が無いと
# アプリを即クラッシュさせる（2.1 リジェクトの原因）。毎回ここで必ず入れておく。
echo "▶ Info.plist の権限文言を確認"
PLIST="ios/App/App/Info.plist"
ensure_plist_string() {
  local key="$1" val="$2"
  if /usr/libexec/PlistBuddy -c "Print :$key" "$PLIST" >/dev/null 2>&1; then
    /usr/libexec/PlistBuddy -c "Set :$key $val" "$PLIST"
  else
    /usr/libexec/PlistBuddy -c "Add :$key string $val" "$PLIST"
  fi
  echo "  ✓ $key"
}
if [ -f "$PLIST" ]; then
  ensure_plist_string NSCameraUsageDescription "姿勢分析のために全身写真を撮影する場合にカメラを使用します。写真は端末内で処理され、外部に送信されません。"
  ensure_plist_string NSPhotoLibraryUsageDescription "姿勢分析に使う全身写真を選ぶためにフォトライブラリを使用します。写真は端末内で処理され、外部に送信されません。"
else
  echo "  ⚠ $PLIST が見つかりません。スキップしました。"
fi

echo "✅ 反映完了。Xcode で再ビルドしてください。"
