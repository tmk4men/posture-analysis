#!/usr/bin/env python3
"""カード画像のタイトル右のタグとキャッチ文を、先方の部位色分け図の言い方に書き換える。

なぜ必要か（先方 UGOQ からの依頼・2026-09-09）:
  1ページ目の筋肉リストを一般の方が分かる部位名（首＝頚部、太ももの前＝大腿部・前面 …）
  に変えたのに、2ページ目のカードは「大腿四頭筋」「臀筋群」「広背筋」「ハムストリングス」
  のままで、同じレポートの中で同じ場所を2通りに呼んでいた。カードも図の言い方に揃える。

書き換えるもの:
  - tag   … タイトル右のタグ。「胸まわり伸ばし」→「胸部」のように部位名にする
            （先方が IMG_3374 で1枚ずつ赤で指定・2026-09-09）。
  - catch … その下の1行。患者が読めない筋肉名を部位名に置き換える。
  「膝」は先方の仕様書（姿勢分析マスター）が膝表記なので、そちらに合わせて残す。

作り方の方針:
  カードは先方支給で、サイズも余白も組み方も1枚ずつ違う。座標も書体も決め打ちにしない。
  マシン名は先方の絵をそのまま切り取って使い、描き直すのはタグとキャッチだけにする。
  元の文字から「位置・字面の高さ・1文字あたりの幅・線の濃さ」を実測し、Noto Sans JP を
  可変ウェイトで同じ濃さに寄せ、横だけ元の字幅まで潰して長体を再現する。

  build-machine-cards.py を流し直したときは、pre-copy/ を消してからこれを流し直すこと。

リポジトリルートから:
    python scripts/rewrite-card-copy.py

元画像は必ず ORIGINALS_REF（書き換え前のコミット）から取り出す。
assets/exercises/ の中身は書き換え後の状態でコミットされているので、そこを退避元にすると
「書き換え済みの絵から元の字幅を測る」ことになり、流すたびに字が細く小さくなっていく。
実際にそれで1回作り直している。何度流しても同じ結果になるのはこの取り出し方のおかげ。
"""

import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
EX = os.path.join(ROOT, "assets", "exercises")
BACKUP = os.path.join(EX, "pre-copy")

# 文言を書き換える前のカード（先方支給の状態）が入っている最後のコミット。
# build-machine-cards.py でカードを作り直したときは、ここを新しいコミットに上げて
# pre-copy/ を消してから流し直す。
ORIGINALS_REF = "6b0e9fe"

FONT_PATH = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
WEIGHTS = ["Light", "Regular", "Medium", "SemiBold", "Bold", "ExtraBold", "Black"]
GREEN = (33, 78, 52)
BLACK = (34, 34, 34)
EDGE = 26  # カード外周の枠線を文字と見間違えないための左右マージン

# 出力名 -> 変更内容。before は「元のカードに何と書いてあったか」。
# 字数から1文字あたりの幅を、濃さからウェイトを割り出すのに使う（記録も兼ねる）。
CHANGES = {
    "47852239-9C3A-4B47-B9FE-142572EFF0E9": {  # アブドミナル
        "tag": ("体幹安定", "腹部"),
        "catch": ("腹筋群を鍛えて座位姿勢を安定", "お腹を鍛えて座った姿勢を安定"),
    },
    "3A4181BD-5FF1-436D-8880-DF9B496A16C9": {  # インナー、アウターサイ
        "tag": ("股関節安定", "股関節"),
        "catch": ("内もも・外ももを鍛えて骨盤の安定を支える",
                  "太ももの内側・外側を鍛えて骨盤の安定を支える"),
    },
    "D707D2D4-0E2A-4033-9A9F-722379755957": {  # バックエクステンションベンチ
        "tag": ("体幹伸展", "背部・腰部"),
        "catch": ("脊柱起立筋を鍛えて姿勢を支える", "背中と腰を鍛えて姿勢を支える"),
    },
    "956B29CA-C3D4-43B7-A627-96E324DEB845": {  # ヒップスラスト
        "tag": ("骨盤安定", "臀部"),
        "catch": ("臀筋群を鍛えて骨盤を支える", "おしりを鍛えて骨盤を支える"),
    },
    "70979BF0-ADE4-4DD5-B203-9AF216E8A7C5": {  # ラットプルダウン
        "tag": ("背中強化", "背部"),
        "catch": ("広背筋を鍛えて肩まわりと姿勢を支える", "背中を鍛えて肩まわりと姿勢を支える"),
    },
    "70FEA71D-817C-4ADC-8076-92ABEE5AD0D7": {  # レッグエクステンション
        "tag": ("太もも前強化", "太ももの前"),
        "catch": ("大腿四頭筋を鍛えて立ち上がりを支える", "太ももの前を鍛えて立ち上がりを支える"),
    },
    "928FDF46-F992-4F28-8FFC-193BE60049C1": {  # ペックフライ、リアデルト
        "tag": ("胸背バランス", "背部・胸部"),
    },
    "A1F2FF6B-C281-44D5-BFF9-48058F49DD3A": {  # シーテッドレッグカール
        "tag": ("もも裏強化", "太ももの後ろ"),
        "catch": ("ハムストリングスを鍛えて膝まわりを安定", "太ももの後ろを鍛えて膝まわりを安定"),
    },
    "071D6111-4469-4F5B-A134-BBEEB4CC5FC4": {  # シーテッドレッグプレス
        "tag": ("下肢強化", "太もも"),
        "catch": ("大腿四頭筋・臀筋群を鍛えて立ち上がりを支える",
                  "太ももの前とおしりを鍛えて立ち上がりを支える"),
    },
    "8B3E0B27-6FF0-4801-BABD-516C1E4A05D9": {  # シーテッドロウ
        "tag": ("肩甲骨を寄せる", "背部"),
    },
    "calf-raise": {
        "tag": ("ふくらはぎ強化", "ふくらはぎ"),
    },
    "rakuretch-adductor": {
        "tag": ("股関節伸ばし", "股関節"),
        "catch": ("内ももを伸ばして股関節まわりの動きをなめらかに",
                  "太ももの内側を伸ばして股関節まわりの動きをなめらかに"),
    },
    "rakuretch-chest": {
        "tag": ("胸まわり伸ばし", "胸部"),
        "catch": ("胸筋群を伸ばして巻き肩をリセット", "胸を伸ばして巻き肩をリセット"),
    },
    "rakuretch-hip": {
        "tag": ("股関節伸ばし", "股関節"),
    },
    "rakuretch-shoulder": {
        "tag": ("肩まわり伸ばし", "肩部"),
    },
    "rakuretch-twister": {
        "tag": ("体幹ひねり", "腰部・背部"),
    },
}

_PROBE = ImageDraw.Draw(Image.new("RGB", (8, 8)))


def font(size, weight):
    f = ImageFont.truetype(FONT_PATH, max(6, int(round(size))))
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def is_ink(a):
    return a.sum(axis=-1) < 430


def text_rows(a, w, h):
    """カード上部の文字行を上から順に (y0, y1, x0, x1) で返す。外周の枠線は落とす。"""
    dark = is_ink(a[:, EDGE:w - EDGE])
    prof = dark[: int(h * 0.28)].sum(axis=1)
    bands, cur = [], None
    for y, v in enumerate(prof):
        if v > 3 and cur is None:
            cur = y
        elif v <= 3 and cur is not None:
            if y - cur > 10:
                bands.append((cur, y - 1))
            cur = None
    out = []
    for y0, y1 in bands:
        xs = np.where(dark[y0:y1 + 1].sum(axis=0) > 0)[0] + EDGE
        if xs.max() - xs.min() > w * 0.93 and (y1 - y0) < 30:
            continue  # 角丸の枠線
        out.append((y0, y1, int(xs.min()), int(xs.max())))
    return out


def split_title(a, band):
    """タイトル行を、真ん中の縦罫線でマシン名とタグに割る。"""
    y0, y1, x0, x1 = band
    dark = is_ink(a[y0:y1 + 1, :])
    colh = dark.sum(axis=0)
    empty = colh <= 2   # にじみで1〜2画素残ることがあるので完全な0は求めない
    h = y1 - y0 + 1

    # 罫線は「背が高い・細い・両側が空いている」列。文字の縦画と紛れないよう空白まで見る。
    # 罫線の高さは行の高さに対して一定ではない（大きなカタカナが行の高さを決めている
    # カードでは、罫線は行の半分ほどしかない）ので、しきい値を緩めながら探す。
    cand = []
    for ratio in (0.70, 0.55, 0.45, 0.35):
        tall = h * ratio
        runs, cur = [], None
        for x in range(x0 + 30, x1 - 20):
            if colh[x] >= tall and cur is None:
                cur = x
            elif colh[x] < tall and cur is not None:
                runs.append((cur, x - 1))
                cur = None
        cand = [(a0 + a1) // 2 for a0, a1 in runs
                if a1 - a0 <= 9
                # 罫線の左右3画素はにじみが乗るので、そこは飛ばして空白かどうかを見る
                and empty[max(0, a0 - 15):max(0, a0 - 3)].all()
                and empty[a1 + 4:a1 + 16].all()]
        if cand:
            break
    if not cand:
        raise RuntimeError("縦罫線が見つからない")
    rule = max(cand, key=lambda x: min(x - x0, x1 - x))

    def bbox(xa, xb):
        sub = dark[:, xa:xb]
        xs = np.where(sub.sum(axis=0) > 0)[0] + xa
        ys = np.where(sub.sum(axis=1) > 0)[0] + y0
        return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())

    return rule, bbox(x0, rule - 8), bbox(rule + 8, x1 + 1)


def bg_color(a, y0):
    """行のすぐ上から地色を拾う（カードごとに違う）。"""
    strip = a[max(0, y0 - 10):max(1, y0 - 3), EDGE:-EDGE]
    return tuple(int(v) for v in np.median(strip.reshape(-1, 3), axis=0))


def ink_ratio(a, box):
    x0, y0, x1, y1 = box
    return float(is_ink(a[y0:y1 + 1, x0:x1 + 1]).mean())


def fit_height(text, target_h, weight):
    """字面の高さが target_h になるフォントサイズ。"""
    lo, hi, best = 8, 160, (10 ** 9, 20)
    while lo <= hi:
        mid = (lo + hi) // 2
        b = _PROBE.textbbox((0, 0), text, font=font(mid, weight))
        got = b[3] - b[1]
        best = min(best, (abs(got - target_h), mid))
        if got < target_h:
            lo = mid + 1
        else:
            hi = mid - 1
    return best[1]


def match_weight(before, target_h, target_ink, bg, color):
    """元の行と同じ濃さになるウェイトを選ぶ。元の書体が手元に無いので濃度で寄せる。
    比較は「元と同じ文言」を描いて行う（漢字とかなで濃さが違うため）。"""
    best = None
    for name in WEIGHTS:
        f = font(fit_height(before, target_h, name), name)
        b = _PROBE.textbbox((0, 0), before, font=f)
        im = Image.new("RGB", (b[2] - b[0] + 2, b[3] - b[1] + 2), bg)
        ImageDraw.Draw(im).text((1 - b[0], 1 - b[1]), before, font=f, fill=color)
        got = float(is_ink(np.array(im).astype(int)).mean())
        cand = (abs(got - target_ink), name)
        if best is None or cand < best:
            best = cand
    return best[1]


def draw_squeezed(im, text, f, color, target_w, x, y_top):
    """描いてから横だけ target_w に潰す。元カードのタイトルは長体で、等幅では合わない。"""
    b = _PROBE.textbbox((0, 0), text, font=f)
    tw, th = b[2] - b[0], b[3] - b[1]
    pad = 6
    layer = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((pad - b[0], pad - b[1]), text, font=f, fill=color + (255,))
    k = target_w / tw
    layer = layer.resize((max(1, int(round(layer.width * k))), layer.height), Image.LANCZOS)
    im.paste(layer, (int(round(x - pad * k)), int(round(y_top - pad))), layer)


def rewrite(name, spec):
    im = Image.open(os.path.join(BACKUP, name + ".webp")).convert("RGB")
    a = np.array(im).astype(int)
    w, h = im.size
    rows = text_rows(a, w, h)
    if len(rows) < 2:
        raise RuntimeError(f"{name}: 文字行を2つ見つけられない ({rows})")
    d = ImageDraw.Draw(im)
    notes = []

    if "tag" in spec:
        # マシン名（ラクレッチ、チェスト …）の絵は先方のものをそのまま切り取って使い、
        # 差し替えるのは縦罫線の右のタグだけにする。タグは短くなることが多いので、
        # 「マシン名＋罫線＋新しいタグ」をひとかたまりとして中央に置き直す。
        t_be, t_af = spec["tag"]
        y0, y1, _, _ = rows[0]
        rule, mb, tb = split_title(a, rows[0])
        bg = bg_color(a, y0)
        t_h = tb[3] - tb[1] + 1
        t_unit = (tb[2] - tb[0] + 1) / len(t_be)   # 元の1文字あたりの幅
        gap = rule - mb[2]
        t_wt = match_weight(t_be, t_h, ink_ratio(a, tb), bg, GREEN)

        top, bot = y0 - 8, y1 + 9
        machine = im.crop((mb[0], top, mb[2] + 1, bot))
        m_w = machine.width
        sw = t_unit * len(t_af)
        limit = w - 2 * (EDGE + 18)
        total = m_w + gap * 2 + 5 + sw
        if total > limit:      # 字数が増えて入らない分だけタグ側を詰める
            sw = max(20, sw - (total - limit))
            total = limit

        d.rectangle([EDGE, top, w - EDGE, bot], fill=bg)
        x = int(round(w / 2 - total / 2))
        im.paste(machine, (x, top))
        rx = x + m_w + gap
        d.line([(rx, y0 + 4), (rx, y1 - 2)], fill=GREEN, width=5)
        draw_squeezed(im, t_af, font(fit_height(t_af, t_h, t_wt), t_wt), GREEN, sw,
                      rx + gap + 5, tb[3] - t_h + 1)
        notes.append(f"tag「{t_be}」→「{t_af}」{t_wt} 幅{int(total)}≦{limit}")

    if "catch" in spec:
        before, after = spec["catch"]
        y0, y1, x0, x1 = rows[1]
        bg = bg_color(a, y0)
        c_h = y1 - y0 + 1
        unit = (x1 - x0 + 1) / len(before)
        wt = match_weight(before, c_h, ink_ratio(a, (x0, y0, x1, y1)), bg, BLACK)
        tw = min(unit * len(after), w - 2 * (EDGE + 18))
        # 元が中央寄せか左寄せかは、行の中心がカード中心からどれだけ離れているかで見る。
        # 左余白だけで見ると、単に文言が長い行を左寄せと誤判定する。
        keep_left = abs((x0 + x1) // 2 - w // 2) > w * 0.05
        x = x0 if keep_left else w / 2 - tw / 2
        x = max(EDGE + 10, min(x, w - EDGE - 10 - tw))
        d.rectangle([EDGE, y0 - 6, w - EDGE, y1 + 6], fill=bg)
        draw_squeezed(im, after, font(fit_height(after, c_h, wt), wt), BLACK, tw, x, y0)
        notes.append(f"catch「{after}」{wt} {'左寄せ' if keep_left else '中央'}")

    im.save(os.path.join(EX, name + ".webp"), "WEBP", quality=92, method=6)
    print(f"  {name[:20]:22s} " + " / ".join(notes))


def fetch_originals():
    """書き換え前のカードを ORIGINALS_REF から pre-copy/ に取り出す。"""
    os.makedirs(BACKUP, exist_ok=True)
    got = 0
    for name in CHANGES:
        bak = os.path.join(BACKUP, name + ".webp")
        if os.path.exists(bak):
            continue
        path = f"assets/exercises/{name}.webp"
        blob = subprocess.run(
            ["git", "show", f"{ORIGINALS_REF}:{path}"],
            cwd=ROOT, capture_output=True,
        ).stdout
        if blob[:4] != b"RIFF":
            sys.exit(f"{ORIGINALS_REF} から {path} を取り出せない")
        with open(bak, "wb") as f:
            f.write(blob)
        got += 1
    if got:
        print(f"  元画像 {got} 枚を {ORIGINALS_REF} から取り出した")


def main():
    fetch_originals()
    print(f"カード文言の書き換え（{len(CHANGES)}枚）")
    for name, spec in CHANGES.items():
        rewrite(name, spec)


if __name__ == "__main__":
    main()
