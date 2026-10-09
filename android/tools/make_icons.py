"""Placeholder launcher icon and splash for the Android build.

Usage: python3 android/tools/make_icons.py <path to art/source/cutouts/characters/s01.png>
Draws S-01's head and shoulders (pixel art, nearest-neighbour) on the brand night-to-blue
gradient with a cyan seam ring. Replace with the artist's icon when it exists.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

RES = Path(__file__).resolve().parent.parent / 'app/src/main/res'
NIGHT, DEEP, SEAM = (11, 17, 23), (17, 90, 128), (87, 216, 242)
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def gradient(size):
    im = Image.new('RGB', (size, size))
    px = im.load()
    for y in range(size):
        for x in range(size):
            t = min(1, max(0, (x + y) / (2 * size) * 1.4 - 0.1))
            px[x, y] = tuple(round(DEEP[i] * (1 - t) + NIGHT[i] * t) for i in range(3))
    return im.convert('RGBA')


def hero(src, height):
    s = Image.open(src).convert('RGBA')
    bust = s.crop((0, 0, s.width, int(s.height * 0.42)))
    k = max(1, height // bust.height)
    bust = bust.resize((bust.width * k, bust.height * k), Image.NEAREST)
    if bust.height != height:
        bust = bust.resize((round(bust.width * height / bust.height), height), Image.NEAREST)
    return bust


def foreground(src, size):
    """Adaptive-icon foreground: 108 units, art kept inside the central 66."""
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = size * 33 / 108
    c = size / 2
    d.ellipse((c - r, c - r, c + r, c + r), outline=SEAM, width=max(2, size // 54))
    b = hero(src, round(size * 0.5))
    im.alpha_composite(b, (round(c - b.width / 2), round(c + r * 0.92 - b.height)))
    return im


def legacy(src, size, round_mask):
    big = size * 4
    bg = gradient(big)
    fg = foreground(src, round(big * 108 / 72)).resize((big * 108 // 72,) * 2, Image.NEAREST)
    off = (fg.width - big) // 2
    bg.alpha_composite(fg.crop((off, off, off + big, off + big)))
    mask = Image.new('L', (big, big), 0)
    md = ImageDraw.Draw(mask)
    if round_mask:
        md.ellipse((0, 0, big - 1, big - 1), fill=255)
    else:
        md.rounded_rectangle((0, 0, big - 1, big - 1), radius=big // 6, fill=255)
    out = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    out.paste(bg, mask=mask)
    return out.resize((size, size), Image.LANCZOS)


def main(src):
    for name, k in DENSITIES.items():
        d = RES / f'mipmap-{name}'
        d.mkdir(exist_ok=True)
        foreground(src, round(108 * k)).save(d / 'ic_launcher_foreground.png')
        legacy(src, round(48 * k), False).save(d / 'ic_launcher.png')
        legacy(src, round(48 * k), True).save(d / 'ic_launcher_round.png')
    (RES / 'drawable-nodpi').mkdir(exist_ok=True)
    # Splash icon (Android 12+ shows it centred on the window background).
    foreground(src, 1152).save(RES / 'drawable-nodpi' / 'splash_icon.png')


if __name__ == '__main__':
    main(sys.argv[1])
