# FALLBACK — Manual Operations Guide

When Pi/szt.link is unavailable, use this guide for manual operations.

---

## 1. Manual Pendrive Preparation

### Requirements
- 64GB USB 3.0 pendrive (minimum)
- Source files from 4090 Render Server or aya-workspace
- ~2 hours preparation time

### Steps

**1.1 Copy repo code**
```bash
# From Windows workstation or 4090
cd C:\Users\AYA1\Documents\aya-expo-tools
xcopy /S /E /Y . E:\aya-expo-tools\
```

**1.2 Prepare Node.js portable**
- Download Node.js Windows Binary (.zip): https://nodejs.org/dist/v22.16.0/node-v22.16.0-win-x64.zip
- Extract to `E:\node-portable\`
- Verify `node.exe`, `npm`, `npm.cmd` are present

**1.3 Package Python venv**
```bash
# From 4090 Render Server (has CUDA + torch installed)
ssh root@192.168.3.20

# Navigate to venv
cd /path/to/aya-expo-tools/clusters/cv/python/venv/

# Archive venv (~7GB)
tar -czf venv-torch-cuda.tar.gz venv/

# Copy to pendrive (via SFTP or network share)
# Then extract on pendrive to E:\python-venv\
```

Alternatively, create fresh venv on a machine with GPU:
```bash
python -m venv E:\python-venv
E:\python-venv\Scripts\pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
E:\python-venv\Scripts\pip install ultralytics onnxruntime-gpu opencv-python numpy
```

**Important field note (Amano Rio, 2026-04):** the venv alone is **not** sufficient.
The target machine also needs a valid **Python 3.11 base installation** that matches the venv.
If `pyvenv.cfg` points to a nonexistent path, the CV pipeline will fail even if `python-venv/` was copied successfully.

Minimum verification on target machine:
```bash
C:\aya-expo-tools\clusters\cv\python\venv\Scripts\python.exe --version
C:\aya-expo-tools\clusters\cv\python\venv\Scripts\python.exe -c "import torch; print(torch.cuda.is_available())"
```

If the first command fails, install Python 3.11 locally and repair `pyvenv.cfg` before assuming CV is ready.

**1.4 Copy models**
```bash
# Download YOLO model
curl -L -o E:\models\yolov8l.pt https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8l.pt

# Download ReID model (OSNet)
curl -L -o E:\models\osnet_x0_25.onnx https://github.com/KaiyangZhou/deep-person-reid/releases/download/v1.0.0/osnet_x0_25.onnx
```

Or copy from existing installation:
```bash
copy C:\aya-expo-tools\clusters\cv\python\models\*.pt E:\models\
copy C:\aya-expo-tools\clusters\cv\python\models\*.onnx E:\models\
```

**1.5 Copy install.bat**
```bash
copy C:\Users\AYA1\Documents\aya-expo-tools\install.bat E:\
```

**1.6 WireGuard config (optional)**
- See section 2 below for manual WireGuard setup
- Copy `.conf` files to `E:\wg-config\` if available

---

## 2. Manual WireGuard Setup

### If Pi/Gateway is unavailable

**2.1 Access Unraid UI**
- Navigate to: https://192.168.3.2:8443 (Unraid Dashboard)
- Login with root credentials

**2.2 Create WireGuard peer**
1. Go to Settings → Network → WireGuard
2. Click "Add Peer" on `wg0` interface
3. Generate peer keys (button available in UI)
4. Configure:
   - Name: `amano-rio` (or expo name)
   - Allowed IPs: `10.10.10.100/32` (next available)
   - Persistent Keepalive: `25`
5. Save and download `.conf` file

**2.3 Install on expo machine**
1. Download WireGuard: https://www.wireguard.com/install/
2. Install WireGuard for Windows
3. Import the `.conf` file from Unraid
4. Activate tunnel: `wg-quick up amano-rio`
5. Verify connection: `ping 192.168.3.2`

---

## 3. Manual Config Creation

When auto-config via Pi is unavailable.

**3.1 Template location**
```
C:\aya-expo-tools\config\template.json
```

**3.2 Amano Rio example**
```json
{
  "expoName": "amano-rio",
  "hardware": {
    "cpu": "Intel Core i9-13900K",
    "ram": "64GB DDR5",
    "gpu": "NVIDIA RTX 3090 24GB",
    "storage": "2TB NVMe SSD"
  },
  "cameras": [
    {
      "id": "cam-entrada",
      "url": "rtsp://admin:aya2026@192.168.2.101:554/stream1",
      "position": "entrada-principal",
      "resolution": "1920x1080",
      "fps": 30
    },
    {
      "id": "cam-obra-a",
      "url": "rtsp://admin:aya2026@192.168.2.102:554/stream1",
      "position": "sala-a",
      "resolution": "1920x1080",
      "fps": 30
    }
  ],
  "displays": [
    {
      "id": "monitor-1",
      "position": "parede-norte",
      "resolution": "3840x2160",
      "output": "HDMI-1"
    },
    {
      "id": "monitor-2",
      "position": "parede-sul",
      "resolution": "1920x1080",
      "output": "HDMI-2"
    }
  ],
  "network": {
    "localIP": "192.168.2.100",
    "vpnIP": "10.10.10.100",
    "gateway": "192.168.2.1",
    "dns": ["1.1.1.1", "8.8.8.8"]
  },
  "reporting": {
    "enabled": true,
    "interval": 3600,
    "includeScreenshots": true,
    "includeMetrics": true
  }
}
```

**3.3 Save as**
```
C:\aya-expo-tools\config\amano-rio.json
```

**3.4 Restart service**
```bash
schtasks /end /tn "AYA Expo Tools Node"
schtasks /run /tn "AYA Expo Tools Node"
```

If that task does not exist on the target machine, run the runtime directly:
```bash
C:\aya-expo-tools\node\node.exe C:\aya-expo-tools\index.js --config=<slug>
```

---

## 4. Manual Portal Registration

When Gateway/szt.link is unavailable for auto-registration.

**4.1 Access Portal directly**
- URL: https://portal.aya.cx (or via VPN: http://192.168.3.10:3000)
- Login with felipe@aya.cx or admin account

**4.2 Register expo manually**
1. Navigate to: Projetos → Novo Projeto
2. Create project:
   - Nome: "Amano Rio de Janeiro"
   - Tipo: "Exposição"
   - Status: "Em Montagem"
   - Data Início: [montagem date]
   - Data Fim: [desmontagem date]
3. Add custom fields:
   - `expo_config`: `amano-rio`
   - `expo_local_ip`: `192.168.2.100`
   - `expo_vpn_ip`: `10.10.10.100`
   - `expo_hardware_profile`: `i9-13900K + RTX3090`

**4.3 Add to monitoring**
- Navigate to: Sistema → Monitoramento
- Add endpoint: `http://192.168.2.100:3000/health` or `http://10.10.10.100:3000/health` (VPN)

---

## 5. Manual Report Submission

When auto-reporting via Gateway fails.

**5.1 Locate reports**
```
C:\aya-expo-tools\logs\reports\
```

Reports are JSON files with format: `report-YYYYMMDD-HHMMSS.json`

**5.2 Read report**
```bash
type C:\aya-expo-tools\logs\reports\report-20260329-120000.json
```

**5.3 Email report**
- To: `felipe@aya.cx`
- Subject: `[Expo Report] Amano Rio — 29/03/2026`
- Attach: JSON file + screenshots from `logs/screenshots/`
- Body: Brief summary of any issues or anomalies

**5.4 Alternative: Portal upload**
- Access Portal → Projetos → Amano Rio
- Upload files to "Documentos" section
- Tag with: `report`, `auto-generated`

---

## 6. Emergency Contacts

| Role | Contact | When |
|------|---------|------|
| Felipe Sztutman | felipe@aya.cx / +55 11 99999-9999 | Critical expo failure |
| Antonio Rocha (Infra) | antonio@aya.cx | Network/VPN issues |
| AYA Ops | ops@aya.cx | Non-critical operational issues |
| On-site Tech | [local contact] | Hardware/camera issues |

---

## 7. Common Issues & Solutions

### Issue: Camera not connecting
- Verify camera IP: `ping 192.168.2.101`
- Test RTSP stream: `ffplay rtsp://admin:aya2026@192.168.2.101:554/stream1`
- Check camera power and network cable
- Reboot camera via web UI: `http://192.168.2.101`

### Issue: GPU not detected
- Verify driver: `nvidia-smi` (should show RTX 3090)
- Reinstall NVIDIA drivers: https://www.nvidia.com/download/index.aspx
- Check PyTorch CUDA: `python -c "import torch; print(torch.cuda.is_available())"`

### Issue: VPN not connecting
- Check WireGuard service: `sc query WireGuardTunnel$wg0`
- Restart tunnel: `wg-quick down amano-rio && wg-quick up amano-rio`
- Verify Unraid is reachable: `ping 192.168.3.2`

### Issue: Server won't start
- Check logs: `type C:\aya-expo-tools\logs\server.log`
- Verify config: `type C:\aya-expo-tools\config\amano-rio.json`
- Check port 3000 is free: `netstat -an | findstr :3000`
- Restart Task Scheduler: `schtasks /end /tn "AYA Expo Tools Node" && schtasks /run /tn "AYA Expo Tools Node"`
- If the task name differs, run the runtime directly: `C:\aya-expo-tools\node\node.exe C:\aya-expo-tools\index.js --config=<slug>`

---

## 8. Escalation Path

1. **Local troubleshooting** (15 min) — use this doc
2. **Contact on-site tech** (if available) — hardware/network issues
3. **Email AYA Ops** — non-critical issues
4. **Call Felipe** — critical expo failure affecting visitors

---

Last updated: 2026-04-18  
Version: 2.1
