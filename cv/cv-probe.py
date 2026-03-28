import json
import cv2
from ultralytics import YOLO

RTSP = 'rtsp://admin:ac00ac00ac00ac@192.168.0.108:554/cam/realmonitor?channel=1&subtype=0'

cap = cv2.VideoCapture(RTSP, cv2.CAP_FFMPEG)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
ret, frame = cap.read()
cap.release()
if not ret or frame is None:
    print(json.dumps({"error": "cannot_read_frame"}))
    raise SystemExit(1)

model = YOLO('yolov8s')
results = []
for conf in [0.1, 0.15, 0.2, 0.25, 0.3]:
    r = model.predict(frame, verbose=False, device='cuda:1', classes=[0], conf=conf, imgsz=1280)
    count = 0
    dets = []
    for rr in r:
        for box in rr.boxes:
            x1,y1,x2,y2 = box.xyxy[0].cpu().numpy().astype(int)
            c = float(box.conf[0])
            count += 1
            dets.append({"bbox":[int(x1),int(y1),int(x2),int(y2)],"conf":round(c,3)})
    results.append({"conf": conf, "count": count, "detections": dets[:10]})
print(json.dumps({"resolution": [frame.shape[1], frame.shape[0]], "results": results}, ensure_ascii=False))
