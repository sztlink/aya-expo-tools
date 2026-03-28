import subprocess, os, shutil, time
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from ultralytics import YOLO
import torch

DATE = '2026-03-20'
START = '144500'
END = '170000'
FPS = 10
W, H = 1080, 1920
CAM_H = 560
HEADER_H = 150
FFMPEG = 'C:\\ffmpeg\\ffmpeg.exe'
BASE = Path('D:/aya-expo-data/timelapse') / DATE
TRILHA = Path('D:/beleza-astral/AUDIO/Samuel_Trilha.v2_19.03.wav')
LOGO_AYA = Path('C:/aya-expo-tools/tmp/logo-aya.png')
LOGO_SZT = Path('C:/aya-expo-tools/tmp/logo-szt-art-tech.png')
MODEL_PATH = 'C:/aya-expo-tools/cv/yolov8s.pt'
GPU = 'cuda:0'
CONF = 0.25
FRAMES_DIR = Path('C:/aya-expo-tools/tmp/tl4_frames')
OUT = Path('C:/aya-expo-tools/tmp/timelapse-stories-v4.mp4')

BG = (10, 10, 10)
WHT = (255, 255, 255)
GRY = (130, 130, 130)
DRK = (55, 55, 55)

FONT_DIR = 'C:/Windows/Fonts'
def fnt(name, size):
    p = f'{FONT_DIR}/{name}'
    return ImageFont.truetype(p, size) if Path(p).exists() else ImageFont.load_default()

f_title = fnt('arialbd.ttf', 52)
f_sub = fnt('arial.ttf', 24)
f_label = fnt('arial.ttf', 20)
f_badge = fnt('arial.ttf', 16)
f_foot1 = fnt('arialbd.ttf', 30)
f_foot2 = fnt('arial.ttf', 22)
f_small = fnt('arial.ttf', 18)

camera_defs = [
    ('cam-2', 'CAM-2   ENTRADA'),
    ('cam-1', 'CAM-1   IMERSIVA I'),
    ('cam-3', 'CAM-3   IMERSIVA II'),
]

def get_frames(cam):
    d = BASE / cam
    frames = sorted([f for f in d.glob('*.jpg') if START <= f.stem <= END])
    print(f'{cam}: {len(frames)} frames [{frames[0].stem} -> {frames[-1].stem}]')
    return [str(f) for f in frames]

def load_logo(path, h):
    if not Path(path).exists():
        return None
    img = Image.open(path).convert('RGBA')
    w = int(img.width * h / img.height)
    return img.resize((w, h), Image.LANCZOS)

def scale_crop(img, tw, th):
    ih, iw = img.shape[:2]
    sc = tw / iw
    nh = int(ih * sc)
    r = cv2.resize(img, (tw, nh))
    sy = max(0, (nh - th) // 2)
    c = r[sy:sy+th, :]
    if c.shape[0] < th:
        c = cv2.copyMakeBorder(c, 0, th - c.shape[0], 0, 0, cv2.BORDER_CONSTANT, value=BG)
    return c

def scale_crop_alpha(alpha, src_w, src_h, tw, th):
    sc = tw / src_w
    nh = int(src_h * sc)
    a = cv2.resize(alpha.astype(np.float32), (tw, nh))
    sy = max(0, (nh - th) // 2)
    c = a[sy:sy+th, :]
    if c.shape[0] < th:
        c = np.pad(c, ((0, th - c.shape[0]), (0, 0)))
    return c

def txt_center(draw, text, y, font, color=WHT):
    bb = draw.textbbox((0, 0), text, font=font)
    draw.text(((W - (bb[2] - bb[0])) // 2, y), text, font=font, fill=color)

def blend_heatmap(frame, hm_color, alpha, src_w, src_h):
    hm_scaled = scale_crop(hm_color, W, CAM_H)
    a_scaled = scale_crop_alpha(alpha, src_w, src_h, W, CAM_H)
    a3 = a_scaled[:, :, np.newaxis]
    return (frame.astype(float) * (1 - a3) + hm_scaled.astype(float) * a3).clip(0, 255).astype(np.uint8)

print('=== Timelapse Stories v4 - heatmap nas 3 cameras ===')
frames_by_cam = {cam: get_frames(cam) for cam, _ in camera_defs}
n = min(len(v) for v in frames_by_cam.values())
duration = n / FPS
print(f'Total: {n} frames | {duration:.1f}s @ {FPS}fps')

logo_aya = load_logo(LOGO_AYA, 84)
logo_szt = load_logo(LOGO_SZT, 74)
print(f'Logo AYA: {logo_aya.size if logo_aya else "n/a"}')
print(f'Logo SZT: {logo_szt.size if logo_szt else "n/a"}')

print('FASE 1 - YOLO heatmap acumulado nas 3 cameras')
device = GPU if torch.cuda.is_available() else 'cpu'
model = YOLO(MODEL_PATH)
model.predict(np.zeros((640,640,3), dtype=np.uint8), verbose=False, device=device, classes=[0])
print(f'Device: {device}')

heatmaps = {}
for cam, _label in camera_defs:
    sample = cv2.imread(frames_by_cam[cam][0])
    sh, sw = sample.shape[:2]
    acc = np.zeros((sh, sw), dtype=np.float64)
    out = []
    t0 = time.time()
    for i, fpath in enumerate(frames_by_cam[cam][:n]):
        img = cv2.imread(fpath)
        res = model.predict(img, verbose=False, device=device, classes=[0], conf=CONF, imgsz=640)
        for r in res:
            for box in r.boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                cx = (x1 + x2) // 2
                cy = min(int(y2), sh - 1)
                sigma = max((x2 - x1) // 2, 30)
                ys = np.arange(max(0, cy - sigma*3), min(sh, cy + sigma*3))
                xs = np.arange(max(0, cx - sigma*3), min(sw, cx + sigma*3))
                if len(ys) and len(xs):
                    yy, xx = np.meshgrid(ys, xs, indexing='ij')
                    g = np.exp(-((xx-cx)**2 + (yy-cy)**2) / (2*sigma**2))
                    acc[ys[0]:ys[-1]+1, xs[0]:xs[-1]+1] += g * 4.0
        hm_max = acc.max()
        if hm_max > 0.5:
            hm_norm = np.clip(acc / hm_max, 0, 1)
            hm_u8 = (hm_norm * 255).astype(np.uint8)
            hm_clr = cv2.applyColorMap(hm_u8, cv2.COLORMAP_JET)
            alpha = np.clip(hm_norm * 1.35, 0, 0.62)
            out.append((hm_clr, alpha, sw, sh))
        else:
            out.append(None)
        if i % 40 == 0 or i == n - 1:
            eta = (time.time() - t0) / (i + 1) * (n - i - 1)
            print(f'{cam}: {i+1}/{n} ETA {eta:.0f}s')
    heatmaps[cam] = out

print('FASE 2 - render')
os.makedirs(str(FRAMES_DIR), exist_ok=True)
for i in range(n):
    canvas = np.full((H, W, 3), BG, dtype=np.uint8)
    for j, (cam, label) in enumerate(camera_defs):
        img = cv2.imread(frames_by_cam[cam][i])
        img = scale_crop(img, W, CAM_H)
        hm = heatmaps[cam][i]
        if hm is not None:
            img = blend_heatmap(img, hm[0], hm[1], hm[2], hm[3])
        yp = HEADER_H + j * CAM_H
        canvas[yp:yp+CAM_H, :] = img
        cv2.line(canvas, (0, yp), (W, yp), (25, 25, 25), 1)
        bar = canvas[yp:yp+34, :300].astype(float) * 0.2
        canvas[yp:yp+34, :300] = bar.astype(np.uint8)
    fy = HEADER_H + 3 * CAM_H
    cv2.line(canvas, (0, fy), (W, fy), (25, 25, 25), 1)
    prog = int(i / max(n-1, 1) * W)
    cv2.rectangle(canvas, (0, H-4), (W, H), (16,16,16), -1)
    cv2.rectangle(canvas, (0, H-4), (prog, H), (65,65,65), -1)

    pil = Image.fromarray(cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(pil)
    for j, (cam, label) in enumerate(camera_defs):
        yp = HEADER_H + j * CAM_H
        draw.text((16, yp+8), label, font=f_label, fill=(210,210,210))
        draw.text((W-85, yp+8), '● CV', font=f_badge, fill=(30,200,100))

    txt_center(draw, 'INTRODUÇÃO AO INFINITO', 28, f_title, WHT)
    txt_center(draw, 'Samuel de Saboia  ·  Farol Santander  ·  São Paulo', 88, f_sub, GRY)
    if logo_aya:
        pil.paste(logo_aya, (28, (HEADER_H - logo_aya.height)//2), logo_aya)

    txt_center(draw, 'mapeamento · sala imersiva', fy+44, f_foot1, WHT)
    txt_center(draw, '20.03.2026  ·  14h45 — 17h00', fy+90, f_foot2, GRY)
    if logo_szt:
        sx = W - logo_szt.width - 28
        sy = fy + 118
        pil.paste(logo_szt, (sx, sy), logo_szt)
    draw.text((30, fy+150), 'AYA Studio', font=f_small, fill=(80,80,80))

    stem = Path(frames_by_cam['cam-2'][i]).stem
    ts = f'{stem[:2]}h{stem[2:4]}'
    bb = draw.textbbox((0,0), ts, font=f_foot2)
    draw.text((W-(bb[2]-bb[0])-30, fy+44), ts, font=f_foot2, fill=DRK)

    cv2.imwrite(str(FRAMES_DIR / f'frame_{i:04d}.jpg'), cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 92])
    if i % 30 == 0 or i == n - 1:
        print(f'Render: {i+1}/{n} {ts}')

print('FASE 3 - ffmpeg')
cmd = [
    FFMPEG, '-y',
    '-framerate', str(FPS),
    '-i', str(FRAMES_DIR / 'frame_%04d.jpg'),
    '-ss', '0', '-t', str(duration),
    '-i', str(TRILHA),
    '-filter_complex', f'[1:a]atrim=0:{duration},afade=t=out:st={max(duration-2,0)}:d=2,aformat=sample_rates=44100[a]',
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-shortest',
    str(OUT)
]
r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
if r.returncode == 0:
    mb = OUT.stat().st_size / 1024 / 1024
    print(f'VIDEO OK -> {OUT}')
    print(f'{mb:.1f} MB | {duration:.1f}s | audio=sim')
else:
    print('ERRO ffmpeg')
    print(r.stderr[-2000:])

shutil.rmtree(str(FRAMES_DIR), ignore_errors=True)
print('Concluido.')
