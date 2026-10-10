"""Builds the website images in public/universe/ from the project art.

Sources: the shared project folder (/mnt/project-files) and Anton's PARTSHIFT folders
copied from his computer (staged under /mnt/user-data/uploads). Re-run after art changes:

    python3 site/tools/build_assets.py [project-files] [uploads/Я ДЕЛАЮ ИГРУ]

Big paintings become .webp (quality 82), pixel sprites stay .png at native size
(the page scales them with image-rendering: pixelated).
"""
import json
import os
import shutil
import sys

from PIL import Image

PF = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files'
UP = sys.argv[2] if len(sys.argv) > 2 else '/mnt/user-data/uploads/Я ДЕЛАЮ ИГРУ'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'universe')

MEDIA = f'{UP}/ПРЕЗЕНТАЦИЯ_ДЛЯ_ПАПЫ_2026-08-10/media'
REVIEW = f'{UP}/marketing/comic_series_owner_stories/review_batch_01'
DONUT = f'{UP}/marketing/partshift_social_launch_d0/comics_stories/comic_01_last_donut_ru/b03_truth_label_fix'
SMM = f'{UP}/marketing/partshift_smm_launch_pack/p0_visual_masters'
REFS = f'{PF}/lore/refs'


def webp(src, name, width=1600, box=None, q=82):
    im = Image.open(src)
    im = im.convert('RGBA' if im.mode in ('RGBA', 'P', 'LA') else 'RGB')
    if box:
        w, h = im.size
        im = im.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    dst = os.path.join(OUT, name + '.webp')
    im.save(dst, 'WEBP', quality=q, method=6)
    return dst


def copy(src, name):
    dst = os.path.join(OUT, name)
    shutil.copyfile(src, dst)
    return dst


def anim_gifs():
    """One looping GIF per unit from the animator's x2 sheets (art/anim/x2/anim.json), 2× nearest-neighbour."""
    meta = json.load(open(f'{PF}/art/anim/x2/anim.json'))['sets']
    pick = {'demon': 'walk', 'resident': 'walk', 'defender': 'walk', 'adaptant_thermo': 'walk', 'adaptant_cryo': 'walk',
            'adaptant_volt': 'walk', 'heavy_adaptant': 'walk', 'nest': None, 'bld_reactor': None, 'bld_command': None}
    for name, anim in pick.items():
        m = meta[name]
        sheet = Image.open(f'{PF}/art/anim/x2/{m["sheet"]}').convert('RGBA')
        fw, fh = m['frameSize']
        a = m['anims'][anim] if anim else next(iter(m['anims'].values()))
        frames = []
        for i in a['frames']:
            x, y = (i % m['cols']) * fw, (i // m['cols']) * fh
            f = sheet.crop((x, y, x + fw, y + fh)).resize((fw * 2, fh * 2), Image.NEAREST)
            frames.append(f)
        frames[0].save(os.path.join(OUT, f'px/anim-{name}.gif'), save_all=True, append_images=frames[1:],
                       duration=round(1000 / a.get('fps', 8)), loop=0, disposal=2, optimize=False)


def main():
    os.makedirs(os.path.join(OUT, 'px'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'comics'), exist_ok=True)

    # Key art and world pages.
    webp(f'{MEDIA}/00_ОБЛОЖКА.png', 'key-art', 1600)
    webp(f'{MEDIA}/02_МИР_И_ЛОКАЦИИ.png', 'world-locations', 1800)
    webp(f'{MEDIA}/01_ВИЗУАЛЬНЫЙ_СТИЛЬ.png', 'style-compass', 1800)
    webp(f'{MEDIA}/03_ДОКТОР_С_РУКОЙ.png', 'doctor-arm', 1600)
    for n, src in [('dossier-s01', '10_S01_ДОСЬЕ'), ('dossier-doctor', '11_ДОКТОР_ДОСЬЕ'), ('dossier-n73', '12_N73_ДОСЬЕ')]:
        webp(f'{MEDIA}/{src}.png', n, 1536)
    webp(f'{UP}/OWNER_HANDOFF_SOCIAL_2026-08-11/01_AVATAR_RECOMMENDED_03.png', 'emblem', 256)
    for n in ['smm_01_sunline_beach_4x5', 'smm_02_pressure_ice_4x5', 'smm_03_hive_terrace_4x5']:
        webp(f'{SMM}/{n}.png', n.replace('_4x5', '').replace('smm_0', 'scene-').replace('_', '-'), 1080)

    # Comics: full 1080 width so the lettering stays readable.
    webp(f'{MEDIA}/09_КОМИКС_ПРОЛОГ.png', 'comics/prologue-ru', 1024)
    for k in range(1, 5):
        webp(f'{DONUT}/comic_01_last_donut_ru_story_0{k}_b03.png', f'comics/last-donut-{k}-ru', 1080)
    webp(f'{DONUT}/comic_01_last_donut_ru_4x5_b03.png', 'comics/last-donut-cover', 1080)
    for slug, src in [('nothing-happened', 'nothing-happened-today-beach-news'), ('pressure-test', 'pressure-test-review-v1'), ('two-kinds', 'two-kinds-of-power-hive-smoke-match')]:
        for lang in ('ru', 'en'):
            webp(f'{REVIEW}/{src}-{lang}.png', f'comics/{slug}-{lang}', 1080)

    # Concept sheets and the cards cut out of them (the sheets are 2×2 or 3-column layouts).
    webp(f'{REFS}/buildings-12-approved-v01.png', 'buildings-sheet', 1536)
    webp(f'{REFS}/city-life-hero-fans-street-chef-microreactor-v1.png', 'city-life', 1003)
    webp(f'{REFS}/demon-ilya-dorn-corrected-four-full-arms-v2.png', 'demon-sheet', 1024)
    webp(f'{REFS}/lore-sprites-01-v01.png', 'sprites-01', 1536)
    webp(f'{REFS}/lore-sprites-02-auto-upgrade-v01.png', 'sprites-02', 1536)
    # Share of each card to cut (top, bottom): the name plates carry unapproved personal names (QA-023).
    trims = {'sheet-01-lineman-frostline-kiln-relay-v1': (0, 0.17), 'sheet-03-current-mason-beacon-canopy-v1': (0, 0.15), 'sheet-04-sweep-patch-hive-v1': (0.095, 0)}
    cards = {
        'sheet-01-lineman-frostline-kiln-relay-v1': [('lineman', (0, 0, .5, .5)), ('frostline', (.5, 0, 1, .5)), ('kiln', (0, .5, .5, 1))],
        'sheet-03-current-mason-beacon-canopy-v1': [('current', (0, 0, .5, .5)), ('mason', (.5, 0, 1, .5)), ('beacon', (0, .5, .5, 1)), ('canopy', (.5, .5, 1, 1))],
        'sheet-04-sweep-patch-hive-v1': [('sweep', (0, 0, 1 / 3, 1)), ('patch', (1 / 3, 0, 0.655, 1)), ('hive', (0.665, 0, 1, 1))],
    }
    for sheet, parts in cards.items():
        for name, box in parts:
            top, bottom = trims[sheet]
            span = box[3] - box[1]
            box = (box[0], box[1] + span * top, box[2], box[3] - span * bottom)
            webp(f'{REFS}/{sheet}.png', f'card-{name}', 700, box)

    # GPT pack for the site (art/source/incoming/site) and the comic portraits, 3 moods per hero (art/comm/gpt).
    INC = f'{PF}/art/source/incoming/site'
    webp(f'{INC}/125_site_seraph_concept_sheet.png', 'card-seraph', 1400)
    webp(f'{INC}/126_site_adaptants_sheet.png', 'adaptants-sheet', 1600)
    webp(f'{INC}/127_site_control_billboard.png', 'control-billboard', 1600)
    # gpt_batch_04 (site/gpt_batch_04_site.md). The comic and the jar label arrive already lettered (Pangolin, Unbounded).
    webp(f'{INC}/site_floor42_boardroom.png', 'floor42', 1600)
    webp(f'{INC}/site_splice_heart.png', 'splice-heart', 1600)
    webp(f'{INC}/site_all_on_shift_banner.png', 'all-on-shift', 1900)
    webp(f'{INC}/site_archive_desk.png', 'archive-desk', 1600)
    webp(f'{INC}/site_world_dome.png', 'world-dome', 1900)
    webp(f'{INC}/site_support_jar.png', 'support-jar', 900)
    B04 = f'{PF}/art/batch04_final/generated'
    webp(f'{B04}/202_comic_11_control_warehouse.png', 'control-warehouse', 1600)
    for lang in ('ru', 'en'):
        webp(f'{INC}/site_comic_cat_record-{lang}.png', f'comics/cat-record-{lang}', 1054)
    os.makedirs(os.path.join(OUT, 'portraits'), exist_ok=True)
    for f in os.listdir(f'{PF}/art/comm/gpt'):
        if f.endswith('.png') and not f.startswith('radio_'):
            webp(f'{PF}/art/comm/gpt/{f}', 'portraits/' + f[:-4], 256)

    # Pixel sprites from the artist's cut-outs, in-game animation previews.
    for f in os.listdir(f'{PF}/art/source/cutouts/characters'):
        if f.endswith('.png'):
            copy(f'{PF}/art/source/cutouts/characters/{f}', f'px/{f}')
    for f in os.listdir(f'{PF}/art/source/cutouts/buildings'):
        if f.endswith('.png'):
            webp(f'{PF}/art/source/cutouts/buildings/{f}', 'px/' + f[:-4], 360)
    # anim_gifs()  # Anton 2026-10-09: no character animations on the site for now

    total = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(OUT) for f in fs)
    print(f'public/universe: {total / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
