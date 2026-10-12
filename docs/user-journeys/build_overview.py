"""Create a single visual map of the captured Savly user journeys.

Requires Pillow. Run from the repository root with:
    python3 docs/user-journeys/build_overview.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from build import JOURNEYS, ROOT


WIDTH = 2400
MARGIN = 72
HEADER = 170
ROW_HEIGHT = 810
ROW_GAP = 20
FOOTER = 85
HEIGHT = HEADER + len(JOURNEYS) * (ROW_HEIGHT + ROW_GAP) + FOOTER
FONT_DIR = Path("/System/Library/Fonts/Supplemental")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "Arial Bold.ttf" if bold else "Arial.ttf"
    return ImageFont.truetype(str(FONT_DIR / name), size)


def wrap(draw: ImageDraw.ImageDraw, message: str, face: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    line = ""
    for word in message.split():
        candidate = f"{line} {word}".strip()
        if line and draw.textbbox((0, 0), candidate, font=face)[2] > max_width:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


canvas = Image.new("RGB", (WIDTH, HEIGHT), "#ecf1f7")
draw = ImageDraw.Draw(canvas)
draw.text((MARGIN, 52), "Savly user journeys", font=font(64, True), fill="#102442")
draw.text((MARGIN, 120), "Six core flows · screens follow left to right", font=font(30), fill="#486283")

for number, (name, subtitle, steps, note) in enumerate(JOURNEYS, 1):
    top = HEADER + (number - 1) * (ROW_HEIGHT + ROW_GAP)
    draw.rounded_rectangle((MARGIN, top, WIDTH - MARGIN, top + ROW_HEIGHT), radius=28, fill="white")
    draw.rounded_rectangle((MARGIN + 28, top + 28, MARGIN + 99, top + 91), radius=17, fill="#184e90")
    draw.text((MARGIN + 42, top + 35), f"{number:02d}", font=font(39, True), fill="white")
    draw.text((MARGIN + 126, top + 25), name, font=font(47, True), fill="#102442")
    draw.text((MARGIN + 126, top + 79), subtitle, font=font(27), fill="#486283")

    shot_w = 250
    shot_h = round(shot_w * 844 / 390)
    gap = 67
    total = len(steps) * shot_w + (len(steps) - 1) * gap
    start_x = (WIDTH - total) // 2
    image_y = top + 131
    for step_num, (stem, title, action) in enumerate(steps):
        x = start_x + step_num * (shot_w + gap)
        screen = Image.open(ROOT / "screenshots" / f"{stem}.png").convert("RGB")
        screen = screen.resize((shot_w, shot_h), Image.Resampling.LANCZOS)
        draw.rounded_rectangle((x - 5, image_y - 5, x + shot_w + 5, image_y + shot_h + 5), radius=16, fill="#cad6e5")
        canvas.paste(screen, (x, image_y))
        draw.rounded_rectangle((x - 1, image_y - 1, x + shot_w, image_y + shot_h), radius=11, outline="#152947", width=4)
        draw.text((x + shot_w // 2, image_y + shot_h + 21), title, font=font(25, True), anchor="mt", fill="#122641")
        draw.text((x + shot_w // 2, image_y + shot_h + 53), action, font=font(19), anchor="mt", fill="#546b88")
        if step_num < len(steps) - 1:
            arrow_x = x + shot_w + gap // 2
            arrow_y = image_y + shot_h // 2
            draw.line((arrow_x - 19, arrow_y, arrow_x + 17, arrow_y), fill="#3478c1", width=6)
            draw.polygon(
                [(arrow_x + 17, arrow_y - 11), (arrow_x + 30, arrow_y), (arrow_x + 17, arrow_y + 11)],
                fill="#3478c1",
            )

    note_face = font(21)
    note_lines = wrap(draw, note, note_face, WIDTH - 2 * MARGIN - 90)
    for line_index, line in enumerate(note_lines[:2]):
        draw.text((MARGIN + 42, top + 748 + line_index * 25), line, font=note_face, fill="#435b7b")

draw.text(
    (MARGIN, HEIGHT - 62),
    "Browser prototype · illustrative prices · simulated account verification · native Premium plan screen not captured",
    font=font(22),
    fill="#526b89",
)

png = ROOT / "Savly-user-journeys-overview.png"
pdf = ROOT / "Savly-user-journeys-overview.pdf"
canvas.save(png, optimize=True)
canvas.save(pdf, "PDF", resolution=150)
print(f"Built {png} and {pdf}")
