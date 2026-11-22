"""Erzeugt Wortmarke und App-Icons aus Poppins SemiBold als Vektorpfade (keine Schrift nötig)."""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
import subprocess, os

f = TTFont('node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff')
gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm
TRACK = -0.03 * upm  # wie in der App (letter-spacing -0.03em)

def glyph_path(ch, dx):
    g = cmap[ord(ch)]
    pen = SVGPathPen(gs)
    gs[g].draw(pen)
    return pen.getCommands(), gs[g].width, g

def text_paths(text):
    x = 0; parts = []; minx = miny = 1e9; maxx = maxy = -1e9
    for ch in text:
        d, w, g = glyph_path(ch, x)
        bp = BoundsPen(gs); gs[g].draw(bp)
        if bp.bounds:
            bx0, by0, bx1, by1 = bp.bounds
            minx, miny, maxx, maxy = min(minx, bx0 + x), min(miny, by0), max(maxx, bx1 + x), max(maxy, by1)
        parts.append(f'<path transform="translate({x:.1f} 0)" d="{d}"/>')
        x += w + TRACK
    return parts, (minx, miny, maxx, maxy)

def wordmark_svg(color, out):
    parts, (x0, y0, x1, y1) = text_paths('milewyse')
    pad = 0
    w, h = x1 - x0, y1 - y0
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" role="img" aria-label="Milewyse">'
           f'<g fill="{color}" transform="translate({-x0:.1f} {y1:.1f}) scale(1 -1)">{"".join(parts)}</g></svg>')
    open(out, 'w').write(svg)
    return w, h

def icon_svg(out, size=1024, rounded=True):
    parts, (x0, y0, x1, y1) = text_paths('m')
    gw, gh = x1 - x0, y1 - y0
    target = size * 0.50                     # „m“ füllt die Hälfte der Breite
    s = target / gw
    tx = (size - gw * s) / 2 - x0 * s
    ty = (size + gh * s) / 2 + y0 * s        # optisch mittig
    r = size * 0.225 if rounded else 0
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
           '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
           '<stop offset="0" stop-color="#4176F7"/><stop offset="0.55" stop-color="#2D62F2"/><stop offset="1" stop-color="#2453E3"/></linearGradient></defs>'
           f'<rect width="{size}" height="{size}" rx="{r:.0f}" fill="url(#g)"/>'
           f'<g fill="#FFFFFF" transform="translate({tx:.1f} {ty:.1f}) scale({s:.4f} {-s:.4f})">{"".join(parts)}</g></svg>')
    open(out, 'w').write(svg)

os.makedirs('src/assets', exist_ok=True)
wordmark_svg('#1D3557', 'src/assets/wordmark-navy.svg')
wordmark_svg('#FFFFFF', 'src/assets/wordmark-white.svg')
icon_svg('public/icon.svg', 512, rounded=True)
icon_svg('/tmp/icon-square.svg', 1024, rounded=False)   # iOS rundet selbst
for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
    subprocess.run(['rsvg-convert', '-w', str(size), '-h', str(size), '/tmp/icon-square.svg', '-o', f'public/{name}'], check=True)
subprocess.run(['cp', 'public/icon.svg', 'src/assets/icon.svg'], check=True)
print('ok')
