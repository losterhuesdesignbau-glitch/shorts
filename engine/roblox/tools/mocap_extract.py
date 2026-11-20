"""Motion-Capture aus einem Tanzvideo: 2D-Gelenkpunkte pro Frame (YOLO-Pose, COCO-17) für bis zu N Personen,
nach Position links→rechts sortiert.  python tools/mocap_extract.py video.mp4 out.json [--people 2] [--max 13.5] [--model yolo11m-pose.pt]"""
import argparse, json
import numpy as np


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video'); ap.add_argument('out')
    ap.add_argument('--people', type=int, default=2); ap.add_argument('--max', type=float, default=0)
    ap.add_argument('--model', default='yolo11m-pose.pt')
    a = ap.parse_args()
    from ultralytics import YOLO
    import cv2
    m = YOLO(a.model)
    cap = cv2.VideoCapture(a.video); fps = cap.get(cv2.CAP_PROP_FPS) or 30
    W = cap.get(cv2.CAP_PROP_FRAME_WIDTH); H = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    frames = []; i = 0
    while True:
        ok, im = cap.read()
        if not ok or (a.max and i / fps > a.max): break
        r = m(im, verbose=False)[0]
        ppl = []
        if r.keypoints is not None and len(r.keypoints):
            kp = r.keypoints.xy.cpu().numpy(); cf = r.keypoints.conf.cpu().numpy(); bx = r.boxes.xyxy.cpu().numpy(); sc = r.boxes.conf.cpu().numpy()
            order = np.argsort(-sc)[:a.people]
            for j in sorted(order, key=lambda j: (bx[j][0] + bx[j][2]) / 2):
                ppl.append({'k': np.round(kp[j], 1).tolist(), 'c': np.round(cf[j], 2).tolist(), 'box': np.round(bx[j], 1).tolist()})
        frames.append(ppl); i += 1
    json.dump({'fps': fps, 'w': W, 'h': H, 'frames': frames}, open(a.out, 'w'))
    print(f'{len(frames)} Frames, {fps:.1f} fps -> {a.out}')


if __name__ == '__main__':
    main()
