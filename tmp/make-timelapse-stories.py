"""
AYA Expo Tools — Timelapse Stories 9:16
Mapeamento da sala imersiva · Beleza Astral · 20.03.2026 · 14h45-17h
"""

import cv2
import numpy as np
import subprocess
import os
import shutil
from pathlib import Path

# ── Config ────────────────────────────────────────────────
DATE       = "2026-03-20"
START      = "144500"  # 14h45
END        = "170000"  # 17h00
FPS        = 10
W, H       = 1080, 1920
CAM_H      = 560
HEADER_H   = 120
FOOTER_H   = H - HEADER_H - 3 * CAM_H   # = 200
FFMPEG     = "C:\\ffmpeg\\ffmpeg.exe"
PYTHON     = "C:\\aya-expo-tools\\cv\\venv\\Scripts\\python.exe"
BASE       = Path("D:/aya-expo-data/timelapse") / DATE
LOGO_PATH  = Path("C:/aya-expo-tools/ui/logo-aya-branco.png")
FRAMES_DIR = Path("C:/aya-expo-tools/tmp/tl_frames")
OUT        = Path("C:/aya-expo-tools/tmp/timelapse-stories.mp4")
LOG        = Path("C:/aya-expo-tools/tmp/timelapse-log.txt")

BG    = (10, 10, 10)
WHITE = (255, 255, 255)
GRAY  = (130, 130, 130)
DARK  = (50, 50, 50)

def log(msg):
    print(msg, flush=True)

# ── Load frames ───────────────────────────────────────────
def get_frames(cam):
    d = BASE / cam
    if not d.exists():
        log(f"WARN: {d} nao existe")
        return []
    frames = sorted([f for f in d.glob("*.jpg") if START <= f.stem <= END])
    log(f"  {cam}: {len(frames)} frames ({frames[0].stem if frames else '-'} ate {frames[-1].stem if frames else '-'})")
    return [str(f) for f in frames]

log("=== Timelapse Stories 9:16 ===")
log(f"Periodo: {START[:2]}h{START[2:4]} - {END[:2]}h{END[2:4]}")

cam2 = get_frames("cam-2")
cam1 = get_frames("cam-1")
cam3 = get_frames("cam-3")
n = min(len(cam2), len(cam1), len(cam3))
log(f"Frames sincronizados: {n}  |  Duracao: {n/FPS:.1f}s @ {FPS}fps")

if n == 0:
    log("ERRO: sem frames!")
    exit(1)

# ── Load logo ─────────────────────────────────────────────
logo = None
if LOGO_PATH.exists():
    logo = cv2.imread(str(LOGO_PATH), cv2.IMREAD_UNCHANGED)
    if logo is not None:
        lh = 48
        lw = int(logo.shape[1] * lh / logo.shape[0])
        logo = cv2.resize(logo, (lw, lh))
        log(f"Logo: {lw}x{lh}")

def overlay_rgba(bg, fg, x, y):
    if fg is None: return
    h, w = fg.shape[:2]
    y2 = min(y + h, bg.shape[0])
    x2 = min(x + w, bg.shape[1])
    fh, fw = y2 - y, x2 - x
    if fh <= 0 or fw <= 0: return
    src = fg[:fh, :fw]
    if src.shape[2] == 4:
        alpha = src[:, :, 3:4].astype(np.float32) / 255.0
        rgb = src[:, :, :3].astype(np.float32)
        dst = bg[y:y2, x:x2].astype(np.float32)
        bg[y:y2, x:x2] = (rgb * alpha + dst * (1 - alpha)).astype(np.uint8)
    else:
        bg[y:y2, x:x2] = src[:, :, :3]

def text_center(img, txt, y, size, color=WHITE, thick=1):
    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, th), _ = cv2.getTextSize(txt, font, size, thick)
    x = (img.shape[1] - tw) // 2
    cv2.putText(img, txt, (x, y), font, size, color, thick, cv2.LINE_AA)

def text_left(img, txt, x, y, size, color=GRAY, thick=1):
    cv2.putText(img, txt, (x, y), cv2.FONT_HERSHEY_SIMPLEX, size, color, thick, cv2.LINE_AA)

def text_right(img, txt, y, size, color=GRAY, thick=1):
    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, _), _ = cv2.getTextSize(txt, font, size, thick)
    cv2.putText(img, txt, (W - tw - 30, y), font, size, color, thick, cv2.LINE_AA)

# ── Render frames ─────────────────────────────────────────
log(f"Renderizando {n} frames compostos...")
os.makedirs(str(FRAMES_DIR), exist_ok=True)
OUT.parent.mkdir(parents=True, exist_ok=True)

camera_defs = [
    (cam2, "CAM-2  ENTRADA"),
    (cam1, "CAM-1  SALA"),
    (cam3, "CAM-3  IMERSAO"),
]

for i in range(n):
    canvas = np.zeros((H, W, 3), dtype=np.uint8)
    canvas[:] = BG

    # ── Camera strips ──────────────────────────────────────
    for j, (flist, label) in enumerate(camera_defs):
        img = cv2.imread(flist[i])
        if img is None:
            img = np.zeros((CAM_H, W, 3), dtype=np.uint8)
        else:
            ih, iw = img.shape[:2]
            scale = W / iw
            nh = int(ih * scale)
            img = cv2.resize(img, (W, nh))
            # center crop vertically
            sy = max(0, (nh - CAM_H) // 2)
            img = img[sy:sy + CAM_H, :]
            if img.shape[0] < CAM_H:
                img = cv2.copyMakeBorder(img, 0, CAM_H - img.shape[0], 0, 0, cv2.BORDER_CONSTANT, value=BG)

        y_pos = HEADER_H + j * CAM_H
        canvas[y_pos:y_pos + CAM_H, :] = img

        # Subtle top divider
        cv2.line(canvas, (0, y_pos), (W, y_pos), (25, 25, 25), 1)

        # Camera label — small, top-left, semi-transparent bar
        lbl_bg = canvas[y_pos:y_pos + 32, :220].copy()
        lbl_bg = cv2.addWeighted(lbl_bg, 0.3, np.zeros_like(lbl_bg), 0.7, 0)
        canvas[y_pos:y_pos + 32, :220] = lbl_bg
        text_left(canvas, label, 14, y_pos + 22, 0.5, WHITE, 1)

    # ── Header ────────────────────────────────────────────
    # Gradient-ish: just dark bar
    cv2.line(canvas, (0, HEADER_H - 1), (W, HEADER_H - 1), (20, 20, 20), 1)

    # AYA logo (left)
    if logo is not None:
        overlay_rgba(canvas, logo, 30, (HEADER_H - logo.shape[0]) // 2)

    # "BELEZA ASTRAL" centered
    text_center(canvas, "BELEZA ASTRAL", 50, 1.4, WHITE, 2)
    text_center(canvas, "Farol Santander  Sao Paulo", 85, 0.55, GRAY, 1)

    # ── Footer ────────────────────────────────────────────
    footer_y = HEADER_H + 3 * CAM_H
    cv2.line(canvas, (0, footer_y), (W, footer_y), (20, 20, 20), 1)

    # Main label
    text_center(canvas, "mapeamento", footer_y + 65, 1.2, WHITE, 2)
    text_center(canvas, "sala imersiva  Beleza Astral", footer_y + 105, 0.6, GRAY, 1)

    # Timestamp from filename
    stem = Path(cam2[i]).stem  # e.g. "144510"
    ts = f"{stem[:2]}h{stem[2:4]}"
    text_center(canvas, f"20.03.2026  14h45 - 17h00", footer_y + 148, 0.5, DARK, 1)

    # Progress bar (thin, bottom of footer)
    prog = int((i / (n - 1)) * W) if n > 1 else W
    bar_y = H - 6
    cv2.rectangle(canvas, (0, bar_y), (W, H), (18, 18, 18), -1)
    cv2.rectangle(canvas, (0, bar_y), (prog, H), (80, 80, 80), -1)

    # Current time indicator (top-right of footer)
    text_right(canvas, ts, footer_y + 65, 0.8, (60, 60, 60), 1)

    # Save
    cv2.imwrite(str(FRAMES_DIR / f"frame_{i:04d}.jpg"), canvas,
                [cv2.IMWRITE_JPEG_QUALITY, 90])

    if i % 30 == 0 or i == n - 1:
        log(f"  Frame {i+1}/{n}  ({ts})")

# ── Encode ────────────────────────────────────────────────
log("Codificando com ffmpeg...")
cmd = [
    FFMPEG, "-y",
    "-framerate", str(FPS),
    "-i", str(FRAMES_DIR / "frame_%04d.jpg"),
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    str(OUT),
]
r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
if r.returncode == 0:
    size_mb = OUT.stat().st_size / 1024 / 1024
    log(f"VIDEO OK: {OUT}  ({size_mb:.1f} MB)  {n/FPS:.1f}s")
else:
    log(f"ERRO ffmpeg:\n{r.stderr[-1500:]}")

# Cleanup temp frames
shutil.rmtree(str(FRAMES_DIR), ignore_errors=True)
log("Concluido.")
