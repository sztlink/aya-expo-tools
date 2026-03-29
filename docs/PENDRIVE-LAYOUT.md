# Pendrive Layout — Offline Installation Kit

Expected structure for the offline installation pendrive.

---

## Requirements

- **Capacity**: 64GB USB 3.0 minimum (recommended 128GB for headroom)
- **Format**: NTFS or exFAT (for files >4GB support)
- **Label**: "AYA-EXPO-TOOLS" (recommended for easy identification)

---

## Directory Structure

```
PENDRIVE (E:\ or F:\ depending on system)
│
├── install.bat                         # Main installer script (~9KB)
│
├── aya-expo-tools/                     # Repo code (~500MB)
│   ├── clusters/
│   ├── config/
│   ├── core/
│   ├── docs/
│   ├── logs/
│   ├── scripts/
│   ├── server/
│   ├── test/
│   ├── ui/
│   ├── index.js
│   ├── package.json
│   ├── package-lock.json
│   └── README.md
│
├── node-portable/                      # Node.js portable (~100MB)
│   ├── node.exe                        # Node.js executable (v22.16.0)
│   ├── npm                             # NPM Unix script
│   ├── npm.cmd                         # NPM Windows batch
│   ├── npx                             # NPX Unix script
│   ├── npx.cmd                         # NPX Windows batch
│   └── node_modules/                   # NPM core modules
│       ├── npm/
│       └── corepack/
│
├── python-venv/                        # Pre-packaged Python venv (~7GB)
│   ├── Scripts/
│   │   ├── python.exe                  # Python 3.11.9
│   │   ├── pip.exe
│   │   └── activate.bat
│   ├── Lib/
│   │   └── site-packages/
│   │       ├── torch/                  # PyTorch 2.5.0+cu121
│   │       ├── torchvision/
│   │       ├── ultralytics/            # YOLOv8
│   │       ├── onnxruntime/            # ONNX Runtime GPU
│   │       ├── cv2/                    # OpenCV
│   │       └── numpy/
│   └── pyvenv.cfg
│
├── models/                             # Pre-trained models (~1.2GB)
│   ├── yolov8l.pt                      # YOLOv8-large for RTX 3090 (~175MB)
│   └── osnet_x0_25.onnx                # OSNet ReID model (~1MB)
│
└── wg-config/                          # WireGuard configs (optional, ~1KB each)
    ├── amano-rio.conf                  # Amano Rio VPN config
    └── README.txt                      # Brief instructions
```

---

## Size Breakdown

| Component | Size | Notes |
|-----------|------|-------|
| install.bat | ~9KB | Main installer script |
| aya-expo-tools/ | ~500MB | Repo code without node_modules |
| node-portable/ | ~100MB | Node.js v22 Windows binary |
| python-venv/ | ~7GB | PyTorch + CUDA + dependencies |
| models/ | ~1.2GB | YOLO + ReID models |
| wg-config/ | ~10KB | Optional VPN configs |
| **TOTAL** | **~9GB** | Fits comfortably in 64GB |

---

## How to Prepare

### Quick Method (From Existing Installation)

If you have a working aya-expo-tools installation with everything configured:

```bash
# 1. Copy repo code (exclude node_modules and logs)
xcopy /S /E /Y /EXCLUDE:exclude.txt C:\aya-expo-tools E:\aya-expo-tools\

# 2. Copy Node.js portable (if already extracted)
xcopy /S /E /Y C:\aya-expo-tools\node-portable E:\node-portable\

# 3. Copy Python venv
xcopy /S /E /Y C:\aya-expo-tools\clusters\cv\python\venv E:\python-venv\

# 4. Copy models
copy C:\aya-expo-tools\clusters\cv\python\models\*.pt E:\models\
copy C:\aya-expo-tools\clusters\cv\python\models\*.onnx E:\models\

# 5. Copy install.bat from repo root
copy C:\aya-expo-tools\install.bat E:\

# 6. (Optional) Copy WireGuard configs
copy C:\Users\AYA1\Documents\wg-configs\*.conf E:\wg-config\
```

### Manual Method (From Scratch)

See `docs/FALLBACK.md` section 1 for detailed instructions.

---

## Pre-flight Checklist

Before taking the pendrive to expo site:

- [ ] `install.bat` is in root of pendrive
- [ ] `aya-expo-tools/` folder exists with complete code
- [ ] `node-portable/node.exe` exists and is ~130MB
- [ ] `python-venv/Scripts/python.exe` exists
- [ ] `python-venv/Lib/site-packages/torch/` exists (PyTorch)
- [ ] `python-venv/Lib/site-packages/ultralytics/` exists (YOLO)
- [ ] `models/yolov8l.pt` exists (~175MB)
- [ ] `models/osnet_x0_25.onnx` exists (~1MB)
- [ ] (Optional) WireGuard `.conf` files in `wg-config/`
- [ ] Total size is ~9-10GB (verify with `dir /s`)

---

## Installation Time Estimates

| Step | Time | Bottleneck |
|------|------|------------|
| Copy code | 2-5 min | USB 3.0 speed |
| Copy Node.js | 1-2 min | USB 3.0 speed |
| Copy Python venv | 20-60 min | **7GB copy to HDD/SSD** |
| Copy models | 2-5 min | USB 3.0 speed |
| WireGuard setup | 5-10 min | Manual config if needed |
| npm install | 5-10 min | Depends on node_modules size |
| Start server | 1-2 min | Initial boot |
| **TOTAL** | **45-90 min** | Mostly venv copy |

**Note**: SSD destination is ~2-3x faster than HDD. Budget 45 min for SSD, 90 min for HDD.

---

## Verification

After installation completes, verify on target machine:

```bash
# 1. Check Node.js
C:\aya-expo-tools\node-portable\node.exe --version
# Should output: v22.16.0

# 2. Check Python
C:\aya-expo-tools\clusters\cv\python\venv\Scripts\python.exe --version
# Should output: Python 3.11.9

# 3. Check PyTorch CUDA
C:\aya-expo-tools\clusters\cv\python\venv\Scripts\python.exe -c "import torch; print(torch.cuda.is_available())"
# Should output: True (if NVIDIA GPU present)

# 4. Check models
dir C:\aya-expo-tools\clusters\cv\python\models
# Should show: yolov8l.pt, osnet_x0_25.onnx

# 5. Check server
curl http://localhost:3000/health
# Should output: {"status":"ok"}
```

---

## Notes

- **USB 3.0 is critical**: USB 2.0 will make venv copy take 2-3 hours
- **NTFS format recommended**: Handles large files better than FAT32
- **Keep a backup pendrive**: Always have 2 copies for critical expos
- **Label clearly**: "AYA EXPO TOOLS v2.0 — DO NOT FORMAT"
- **Update regularly**: Re-prepare pendrive after major repo updates

---

Last updated: 2026-03-29  
Version: 2.0
