"""
AYA Expo Tools — Timelapse Stories 9:16 v3
Introducao ao Infinito · Samuel de Saboia · Farol Santander
cam-2: heatmap animado acumulado frame a frame via YOLO
"""

import subprocess, os, shutil, time
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

# ── Config ────────────────────────────────────────────────
DATE       = "2026-03-20"
START      = "144500"
END        = "170000"
FPS        = 10
W, H       = 1080, 1920
CAM_H      = 560
HEADER_H   = 150
FOOTER_H   = H - HEADER_H - 3 * CAM_H   # 200px

FFMPEG     = "C:\\ffmpeg\\ffmpeg.exe"
BASE       = Path("D:/aya-expo-data/timelapse") / DATE
TRILHA     = Path("D:/beleza-astral/AUDIO/Samuel_Trilha.v2_19.03.wav")
LOGO_AYA   = Path("C:/aya-expo-tools/tmp/logo-aya.png")
LOGO_SZT   = Path("C:/aya-expo-tools/tmp/logo-szt.png")
MODEL_PATH = "C:/aya-expo-tools/cv/yolov8s.pt"
GPU        = "cuda:0"   # GPU 0 livre — GPU 1 usada pelo CV live
CONF       = 0.25
FRAMES_DIR = Path("C:/aya-expo-tools/tmp/tl3_frames")
OUT        = Path("C:/aya-expo-tools/tmp/timelapse-stories-v3.mp4")

BG  = (10, 10, 10)
WHT = (255, 255, 255)
GRY = (130, 130, 130)
DRK = (50,  50,  50)

# ── Fonts ─────────────────────────────────────────────────
F = "C:/Windows/Fonts"
def fnt(name, size):
    p = f"{F}/{name}"
    return ImageFont.truetype(p, size) if Path(p).exists() else ImageFont.load_default()

f_title  = fnt("arialbd.ttf", 52)
f_sub    = fnt("arial.ttf",   24)
f_label  = fnt("arial.ttf",   20)
f_badge  = fnt("arial.ttf",   16)
f_foot1  = fnt("arialbd.ttf", 30)
f_foot2  = fnt("arial.ttf",   22)
f_small  = fnt("arial.ttf",   18)

# ── Load frames ───────────────────────────────────────────
def get_frames(cam):
    d = BASE / cam
    frames = sorted([f for f in d.glob("*.jpg") if START <= f.stem <= END])
    print(f"  {cam}: {len(frames)} frames  [{frames[0].stem} -> {frames[-1].stem}]")
    return [str(f) for f in frames]

print("=== Timelapse Stories v3 + Heatmap YOLO ===")
cam2 = get_frames("cam-2")
cam1 = get_frames("cam-1")
cam3 = get_frames("cam-3")
n = min(len(cam2), len(cam1), len(cam3))
duration = n / FPS
print(f"Total: {n} frames  |  {duration:.1f}s  @  {FPS}fps\n")

# ── Load logos ────────────────────────────────────────────
def load_logo(path, h):
    if not Path(path).exists(): return None
    img = Image.open(path).convert("RGBA")
    w = int(img.width * h / img.height)
    return img.resize((w, h), Image.LANCZOS)

logo_aya = load_logo(LOGO_AYA, 70)
logo_szt = load_logo(LOGO_SZT, 52)
print(f"Logo AYA: {logo_aya.size if logo_aya else 'n/a'}")
print(f"Logo SZT: {logo_szt.size if logo_szt else 'n/a'}\n")

# ─────────────────────────────────────────────────────────
# FASE 1 - YOLO nos frames de cam-2: heatmap acumulado
# ─────────────────────────────────────────────────────────
print("FASE 1 - YOLO inference nos 136 frames de cam-2...")

from ultralytics import YOLO
import torch

device = GPU if torch.cuda.is_available() else "cpu"
model = YOLO(MODEL_PATH)
# Warmup
dummy = np.zeros((640, 640, 3), dtype=np.uint8)
model.predict(dummy, verbose=False, device=device, classes=[0])
print(f"  Modelo: yolov8s  |  Device: {device}")

# Heatmap em resolucao nativa do frame (sera reescalado ao renderizar)
first = cv2.imread(cam2[0])
FH, FW = first.shape[:2]  # ex: 1920x1080
heatmap_acc = np.zeros((FH, FW), dtype=np.float64)
heatmap_frames = []  # per-frame: (hm_color_bgr, alpha_2d) ou None

t0 = time.time()
for i, fpath in enumerate(cam2[:n]):
    img = cv2.imread(fpath)
    if img is None:
        heatmap_frames.append(None)
        continue

    # YOLO inference
    results = model.predict(img, verbose=False, device=device,
                            classes=[0], conf=CONF, imgsz=640)

    # Acumula gaussianas nos pés de cada pessoa detectada
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
            cx = (x1 + x2) // 2
            cy = min(int(y2), FH - 1)                      # pé
            sigma = max((x2 - x1) // 2, 30)
            ys = np.arange(max(0, cy - sigma*3), min(FH, cy + sigma*3))
            xs = np.arange(max(0, cx - sigma*3), min(FW, cx + sigma*3))
            if len(ys) and len(xs):
                yy, xx = np.meshgrid(ys, xs, indexing='ij')
                g = np.exp(-((xx-cx)**2 + (yy-cy)**2) / (2*sigma**2))
                heatmap_acc[ys[0]:ys[-1]+1, xs[0]:xs[-1]+1] += g * 4.0

    # Gera frame colorido proporcional ao acumulado atual
    hm_max = heatmap_acc.max()
    if hm_max > 0.5:
        hm_norm = np.clip(heatmap_acc / hm_max, 0, 1)
        hm_u8   = (hm_norm * 255).astype(np.uint8)
        hm_clr  = cv2.applyColorMap(hm_u8, cv2.COLORMAP_JET)
        # Zero-heat areas = transparente
        alpha   = np.clip(hm_norm * 1.4, 0, 0.68)
        heatmap_frames.append((hm_clr, alpha))
    else:
        heatmap_frames.append(None)

    if i % 20 == 0 or i == n - 1:
        ela = time.time() - t0
        eta = ela / (i + 1) * (n - i - 1)
        dets = sum(1 for x in heatmap_frames if x is not None)
        print(f"  {i+1:3d}/{n}  {Path(fpath).stem}  ETA {eta:.0f}s  "
              f"frames-com-calor: {dets}")

print(f"FASE 1 concluida em {time.time()-t0:.1f}s\n")

# ─────────────────────────────────────────────────────────
# FASE 2 — Render composto
# ─────────────────────────────────────────────────────────
print("FASE 2 - Renderizando frames compostos...")

os.makedirs(str(FRAMES_DIR), exist_ok=True)
OUT.parent.mkdir(parents=True, exist_ok=True)

camera_defs = [
    (cam2, "CAM-2   ENTRADA", True),
    (cam1, "CAM-1   IMERSIVA  I", False),
    (cam3, "CAM-3   IMERSIVA  II", False),
]

def scale_crop(img, tw, th):
    ih, iw = img.shape[:2]
    sc = tw / iw
    nh = int(ih * sc)
    r = cv2.resize(img, (tw, nh))
    sy = max(0, (nh - th) // 2)
    c = r[sy:sy+th, :]
    if c.shape[0] < th:
        c = cv2.copyMakeBorder(c, 0, th-c.shape[0], 0, 0, cv2.BORDER_CONSTANT, value=BG)
    return c

def blend_heatmap(cam_frame, hm_data, tw, th):
    """Blend heatmap onto cam frame (already scaled/cropped to tw×th)."""
    if hm_data is None:
        return cam_frame
    hm_color, alpha = hm_data
    # Scale heatmap color to tw×th using same crop logic
    hm_s = scale_crop(hm_color, tw, th)
    # Scale alpha
    alpha_r = cv2.resize(alpha.astype(np.float32), (FW, FH))
    # Crop alpha with same logic
    sc = tw / FW
    nh = int(FH * sc)
    alpha_r2 = cv2.resize(alpha.astype(np.float32), (tw, nh))
    sy = max(0, (nh - th) // 2)
    a_crop = alpha_r2[sy:sy+th, :]
    if a_crop.shape[0] < th:
        a_crop = np.pad(a_crop, ((0, th-a_crop.shape[0]), (0,0)))
    a3 = a_crop[:, :, np.newaxis]
    blended = (cam_frame.astype(float) * (1-a3) + hm_s.astype(float) * a3)
    return blended.clip(0, 255).astype(np.uint8)

def paste_pil(pil_img, logo, x, y):
    if logo: pil_img.paste(logo, (x, y), logo)

def txt_center(draw, text, y, fnt, col=WHT):
    bb = draw.textbbox((0,0), text, font=fnt)
    draw.text(((W-(bb[2]-bb[0]))//2, y), text, font=fnt, fill=col)

for i in range(n):
    canvas = np.full((H, W, 3), BG, dtype=np.uint8)

    for j, (flist, label, use_hm) in enumerate(camera_defs):
        img = cv2.imread(flist[i]) if i < len(flist) else None
        if img is None:
            img = np.zeros((CAM_H, W, 3), dtype=np.uint8)
        else:
            img = scale_crop(img, W, CAM_H)

        if use_hm:
            img = blend_heatmap(img, heatmap_frames[i], W, CAM_H)

        yp = HEADER_H + j * CAM_H
        canvas[yp:yp+CAM_H, :] = img
        cv2.line(canvas, (0, yp), (W, yp), (25, 25, 25), 1)

        # Label bg
        bar = canvas[yp:yp+34, :300].astype(float) * 0.2
        canvas[yp:yp+34, :300] = bar.astype(np.uint8)

    # Footer divider
    fy = HEADER_H + 3 * CAM_H
    cv2.line(canvas, (0, fy), (W, fy), (25, 25, 25), 1)

    # Progress bar
    prog = int(i / max(n-1, 1) * W)
    cv2.rectangle(canvas, (0, H-4), (W, H), (16, 16, 16), -1)
    cv2.rectangle(canvas, (0, H-4), (prog, H), (65, 65, 65), -1)

    # PIL text overlay
    pil = Image.fromarray(cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(pil)

    # Camera labels
    for j, (_, label, use_hm) in enumerate(camera_defs):
        yp = HEADER_H + j * CAM_H
        draw.text((16, yp+8), label, font=f_label, fill=(210,210,210))
        if use_hm:
            active = heatmap_frames[i] is not None
            col = (30, 200, 100) if active else (60, 60, 60)
            draw.text((W-85, yp+8), "● CV", font=f_badge, fill=col)

    # HEADER
    txt_center(draw, "INTRODUÇÃO AO INFINITO", 28, f_title, WHT)
    txt_center(draw, "Samuel de Saboia  ·  Farol Santander  ·  São Paulo", 88, f_sub, GRY)
    if logo_aya:
        paste_pil(pil, logo_aya, 28, (HEADER_H - logo_aya.height)//2)

    # FOOTER
    txt_center(draw, "mapeamento · sala imersiva", fy+44, f_foot1, WHT)
    txt_center(draw, "20.03.2026  ·  14h45 — 17h00", fy+90, f_foot2, GRY)
    if logo_szt:
        paste_pil(pil, logo_szt, W-logo_szt.width-28, fy+132)
    draw.text((30, fy+150), "AYA Studio", font=f_small, fill=(60,60,60))

    # Timestamp (top right footer)
    stem = Path(cam2[i]).stem
    ts   = f"{stem[:2]}h{stem[2:4]}"
    bb   = draw.textbbox((0,0), ts, font=f_foot2)
    draw.text((W-(bb[2]-bb[0])-30, fy+44), ts, font=f_foot2, fill=DRK)

    cv2.imwrite(
        str(FRAMES_DIR / f"frame_{i:04d}.jpg"),
        cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR),
        [cv2.IMWRITE_JPEG_QUALITY, 92]
    )

    if i % 30 == 0 or i == n-1:
        print(f"  Frame {i+1}/{n}  {ts}")

print("FASE 2 concluida\n")

# ─────────────────────────────────────────────────────────
# FASE 3 — ffmpeg: encode + trilha + fade
# ─────────────────────────────────────────────────────────
print("FASE 3 - Codificando...")

if TRILHA.exists():
    cmd = [
        FFMPEG, "-y",
        "-framerate", str(FPS),
        "-i", str(FRAMES_DIR / "frame_%04d.jpg"),
        "-ss", "0", "-t", str(duration),
        "-i", str(TRILHA),
        "-filter_complex",
        f"[1:a]atrim=0:{duration},afade=t=out:st={duration-2}:d=2,"
        f"aformat=sample_rates=44100[a]",
        "-map", "0:v", "-map", "[a]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-shortest",
        str(OUT),
    ]
    print("  Trilha: OK")
else:
    print("  AVISO: trilha nao encontrada - sem audio")
    cmd = [
        FFMPEG, "-y",
        "-framerate", str(FPS),
        "-i", str(FRAMES_DIR / "frame_%04d.jpg"),
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(OUT),
    ]

r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
if r.returncode == 0:
    mb = OUT.stat().st_size / 1024 / 1024
    print(f"\nVIDEO OK -> {OUT}\n{mb:.1f} MB  |  {duration:.1f}s  |  audio={'sim' if TRILHA.exists() else 'nao'}")
else:
    print("ERRO ffmpeg:\n" + r.stderr[-2000:])

shutil.rmtree(str(FRAMES_DIR), ignore_errors=True)
print("\nConcluido.")
