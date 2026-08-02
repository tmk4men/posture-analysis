#!/usr/bin/env python3
"""ラクレッチ5種のカード写真を「ラクレッチ改」の写真へ差し替え、
カーフレイズのカードを新規に作る。

なぜ必要か（先方 UGOQ からの回答・2026-08-02）:
  - ラクレッチのマシンが新型（Rakuretch ロゴ入り）になり、写真一式が届いた。
    ただし届いたのはマシン単体写真で、カード（タイトル・キャッチ・運動のポイント）
    ではないため、既存カードの写真部分だけを入れ替える。
  - カーフレイズに専用マシンは無く、レクスコのレッグプレス／シーテッドレッグプレスで
    「脚を伸ばした状態でつま先立ち」をして行う。そこでシーテッドレッグプレスの
    カードを土台に、文言だけ差し替えたカーフレイズのカードを起こす。

入力（いずれも .gitignore 済みの先方資料）:
    素材/ラクレッチ改/{チェスト,ショルダー,ツイスター,ヒップ,アダクター}.jpg
出力:
    assets/exercises/rakuretch-*.webp, assets/exercises/calf-raise.webp

リポジトリルートから:
    python scripts/build-machine-cards.py
"""

import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
EX = os.path.join(ROOT, "assets", "exercises")
SRC_PHOTOS = os.path.join(ROOT, "素材", "ラクレッチ改")

# 差し替え対象：出力名 -> (元カード, 新しいマシン写真)
RAKURETCH = {
    "rakuretch-chest": ("083B22F6-0546-4098-AD74-4FA264A5FEF8.webp", "チェスト.jpg"),
    "rakuretch-shoulder": ("4EF4CA4C-AC1C-4CAD-AE5A-0DCC70C34776.webp", "ショルダー.jpg"),
    "rakuretch-twister": ("E723D8FF-A38A-4228-958B-BA8C48B35CE9.webp", "ツイスター.jpg"),
    "rakuretch-hip": ("44A75005-F733-4B8E-87D0-7419C998DAED.webp", "ヒップ.jpg"),
    "rakuretch-adductor": ("755699E9-0BE6-4002-B187-ECC14D9E1861.webp", "アダクター.jpg"),
}
# カーフレイズの土台にするカード（シーテッドレッグプレス）
LEG_PRESS_CARD = "071D6111-4469-4F5B-A134-BBEEB4CC5FC4.webp"

PAD_X = 22          # 白枠の内側に残す左右の余白
TOP_PAD = 26        # 同・上
GAP = 38            # 写真の下端と緑ラベルのあいだ
V_POS = 0.72        # 配置域の縦位置（1.0 でラベル直上。空白を上に多めに残す）

FONT_PATH = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
BG = (248, 249, 242)
GREEN = (33, 78, 52)
BLACK = (34, 34, 34)
WHITE = (255, 255, 255)


# ---- カードの構造を画素から拾うヘルパー -----------------------------------
# カード画像は先方支給で、サイズも余白も1枚ずつ違う。座標を決め打ちにせず、
# 白い写真枠と緑のラベル帯を毎回検出してから加工する。

def white_frame(a):
    """左側の白い写真枠の外接矩形 (x0, y0, x1, y1)。"""
    h, w, _ = a.shape
    white = (a[:, :, 0] >= 248) & (a[:, :, 1] >= 248) & (a[:, :, 2] >= 248)
    left = white[:, : int(w * 0.58)]
    rows = np.where(left.mean(axis=1) > 0.60)[0]
    cols = np.where(left.mean(axis=0) > 0.60)[0]
    return int(cols.min()), int(rows.min()), int(cols.max()), int(rows.max())


def green_mask(a):
    r, g, b = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
    return (r < 80) & (g > 50) & (g < 130) & (b < 90) & (g - r > 15) & (g - b > 10)


def label_top(a, box):
    """写真枠の内側・下部にある緑ラベルの上端（絶対座標）。"""
    x0, y0, x1, y1 = box
    inner = green_mask(a)[y0:y1 + 1, x0:x1 + 1]
    grow = inner.mean(axis=1)
    half = len(grow) // 2
    cand = np.where(grow[half:] > 0.05)[0]
    if not len(cand):
        raise RuntimeError("緑ラベルが見つからない")
    return y0 + half + int(cand.min())


def trim_white(im, thr=246):
    """白背景の写真を被写体の外接矩形で切り出す。"""
    a = np.array(im.convert("RGB"))
    nonwhite = ~((a[:, :, 0] >= thr) & (a[:, :, 1] >= thr) & (a[:, :, 2] >= thr))
    ys = np.where(nonwhite.sum(axis=1) > 2)[0]
    xs = np.where(nonwhite.sum(axis=0) > 2)[0]
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def font(size, weight="Bold"):
    f = ImageFont.truetype(FONT_PATH, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass  # 可変フォントでなければ既定ウェイトのまま
    return f


# ---- 1. ラクレッチ5種：写真だけ差し替える ---------------------------------

def swap_photo(out_name, card_fn, photo_fn):
    card = Image.open(os.path.join(EX, card_fn)).convert("RGB")
    a = np.array(card)
    x0, y0, x1, y1 = white_frame(a)
    lt = label_top(a, (x0, y0, x1, y1))

    ax0, ax1 = x0 + PAD_X, x1 - PAD_X
    ay0, ay1 = y0 + TOP_PAD, lt - GAP
    aw, ah = ax1 - ax0, ay1 - ay0

    photo = trim_white(Image.open(os.path.join(SRC_PHOTOS, photo_fn)))
    scale = min(aw / photo.width, ah / photo.height)
    nw, nh = int(photo.width * scale), int(photo.height * scale)
    photo = photo.resize((nw, nh), Image.LANCZOS)

    out = card.copy()
    out.paste((255, 255, 255), (x0 + 2, y0 + 2, x1 - 1, lt - 6))  # 旧写真を消す
    out.paste(photo, (ax0 + (aw - nw) // 2, ay0 + int((ah - nh) * V_POS)))

    path = os.path.join(EX, out_name + ".webp")
    out.save(path, "WEBP", quality=92, method=6)
    print(f"  {out_name:22s} 写真 {nw}x{nh} (x{scale:.2f})  {os.path.getsize(path)//1024}KB")


# ---- 2. カーフレイズ：レッグプレスのカードから文言を差し替えて起こす -------

def build_calf_raise(out_name="calf-raise"):
    im = Image.open(os.path.join(EX, LEG_PRESS_CARD)).convert("RGB")
    d = ImageDraw.Draw(im)
    W, H = im.size
    EDGE = 4  # カード最外周の枠線を消さないための余白

    # タイトル
    d.rectangle([EDGE, 34, W - EDGE, 165], fill=BG)
    ft, fs = font(96), font(52)
    title, sub = "カーフレイズ", "ふくらはぎ強化"
    tw, sw = d.textlength(title, font=ft), d.textlength(sub, font=fs)
    gap = 22
    x = (W - (tw + gap * 2 + 6 + sw)) / 2
    d.text((x, 46), title, font=ft, fill=GREEN)
    sx = x + tw + gap
    d.line([(sx, 56), (sx, 144)], fill=GREEN, width=5)
    d.text((sx + gap + 6, 84), sub, font=fs, fill=GREEN)

    # キャッチ
    d.rectangle([EDGE, 170, W - EDGE, 245], fill=BG)
    catch = "レッグプレスマシンでふくらはぎを鍛える"
    fc = font(50, "Medium")
    d.text(((W - d.textlength(catch, font=fc)) / 2, 178), catch, font=fc, fill=BLACK)

    # 運動のポイント（先方回答：脚を伸ばした状態でつま先立ち）
    col_x = int(W * 0.60)
    d.rectangle([col_x - 20, 395, W - EDGE, 840], fill=BG)
    points = [
        ["脚を伸ばした状態で", "つま先立ちをする"],
        ["かかとをゆっくり", "下ろす"],
        ["反動を使わず", "一定の速さで行う"],
    ]
    fp = font(44, "Medium")
    y = 415
    for lines in points:
        d.ellipse([col_x - 4, y + 16, col_x + 10, y + 30], fill=BLACK)
        for i, ln in enumerate(lines):
            d.text((col_x + 32, y + i * 62), ln, font=fp, fill=BLACK)
        y += 62 * len(lines) + 22

    # 下部の緑ラベル（元の帯を消して、文字幅に合わせて描き直す）
    a = np.array(im)
    X_FROM = 10  # カード最外周の枠線を拾わないよう内側から測る
    band = green_mask(a)[1150:1330, X_FROM:int(W * 0.57)]
    ys = np.where(band.mean(axis=1) > 0.02)[0]
    xs = np.where(band.mean(axis=0) > 0.02)[0]
    by0, by1 = 1150 + int(ys.min()), 1150 + int(ys.max())
    bx0 = X_FROM + int(xs.min())
    d.rectangle([bx0 - 6, by0 - 6, int(W * 0.57), by1 + 8], fill=WHITE)

    label, fl = "カーフレイズ", font(56)
    lw = d.textlength(label, font=fl)
    pad_x, height = 44, by1 - by0
    d.rounded_rectangle([bx0, by0, bx0 + lw + pad_x * 2, by1], radius=height // 2, fill=GREEN)
    d.text((bx0 + pad_x, by0 + (height - 56) / 2 - 6), label, font=fl, fill=WHITE)

    path = os.path.join(EX, out_name + ".webp")
    im.save(path, "WEBP", quality=92, method=6)
    print(f"  {out_name:22s} {im.size[0]}x{im.size[1]}  {os.path.getsize(path)//1024}KB")


def main():
    if not os.path.isdir(SRC_PHOTOS):
        sys.exit(f"素材が無い: {SRC_PHOTOS}")
    print("ラクレッチ（写真差し替え）")
    for out_name, (card_fn, photo_fn) in RAKURETCH.items():
        swap_photo(out_name, card_fn, photo_fn)
    print("カーフレイズ（新規）")
    build_calf_raise()


if __name__ == "__main__":
    main()
