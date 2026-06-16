// Face detection runs ONLY in the browser. We dynamically import face-api so
// the SSR runtime never evaluates the tfjs bundle (which references browser-only
// globals like TextEncoder differently and crashes).

// Loose types — we don't import the package at module scope.
type Point = { x: number; y: number };
type FaceApiModule = typeof import("@vladmandic/face-api/dist/face-api.esm.js");

let faceapi: FaceApiModule | null = null;
let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model";

export async function loadFaceModels(): Promise<void> {
  if (typeof window === "undefined") return;
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    if (!faceapi) {
      faceapi = await import("@vladmandic/face-api/dist/face-api.esm.js");
    }
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();
  return loadingPromise;
}

export interface FaceCheckResult {
  faceDetected: boolean;
  multipleFaces: boolean;
  bothEyesVisible: boolean;
  centered: boolean;
  livenessOk: boolean;
  reason?: string;
}

export interface LivenessState {
  earHistory: number[];
  posHistory: { x: number; y: number }[];
  lastBlinkAt: number;
  lastMoveAt: number;
}

export function createLivenessState(): LivenessState {
  return { earHistory: [], posHistory: [], lastBlinkAt: 0, lastMoveAt: Date.now() };
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(eye: Point[]) {
  const v1 = dist(eye[1], eye[5]);
  const v2 = dist(eye[2], eye[4]);
  const h = dist(eye[0], eye[3]);
  return (v1 + v2) / (2 * h);
}

export async function checkFace(
  video: HTMLVideoElement,
  state: LivenessState
): Promise<FaceCheckResult> {
  if (!modelsLoaded || !faceapi || video.readyState < 2 || video.videoWidth === 0) {
    return {
      faceDetected: false,
      multipleFaces: false,
      bothEyesVisible: false,
      centered: false,
      livenessOk: false,
      reason: "Camera not ready",
    };
  }

  const detections = await faceapi
    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
    .withFaceLandmarks(true);

  if (detections.length === 0) {
    return {
      faceDetected: false,
      multipleFaces: false,
      bothEyesVisible: false,
      centered: false,
      livenessOk: false,
      reason: "No face detected",
    };
  }

  if (detections.length > 1) {
    return {
      faceDetected: true,
      multipleFaces: true,
      bothEyesVisible: false,
      centered: false,
      livenessOk: false,
      reason: "Multiple faces detected",
    };
  }

  const det = detections[0];
  const box = det.detection.box;
  const landmarks = det.landmarks;
  const leftEye = landmarks.getLeftEye() as Point[];
  const rightEye = landmarks.getRightEye() as Point[];

  const leftEyeWidth = dist(leftEye[0], leftEye[3]);
  const rightEyeWidth = dist(rightEye[0], rightEye[3]);
  const minEyeW = box.width * 0.06;
  const bothEyesVisible = leftEyeWidth > minEyeW && rightEyeWidth > minEyeW;

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const centered =
    cx > vw * 0.2 &&
    cx < vw * 0.8 &&
    cy > vh * 0.15 &&
    cy < vh * 0.85 &&
    box.width > vw * 0.15;

  const ear = (eyeAspectRatio(leftEye) + eyeAspectRatio(rightEye)) / 2;
  state.earHistory.push(ear);
  if (state.earHistory.length > 30) state.earHistory.shift();

  state.posHistory.push({ x: cx, y: cy });
  if (state.posHistory.length > 30) state.posHistory.shift();

  const now = Date.now();

  if (state.earHistory.length >= 5) {
    const recent = state.earHistory.slice(-5);
    const minR = Math.min(...recent);
    const maxR = Math.max(...recent);
    if (maxR > 0.25 && minR < 0.2) {
      state.lastBlinkAt = now;
    }
  }

  if (state.posHistory.length >= 10) {
    const xs = state.posHistory.map((p) => p.x);
    const ys = state.posHistory.map((p) => p.y);
    const xVar = Math.max(...xs) - Math.min(...xs);
    const yVar = Math.max(...ys) - Math.min(...ys);
    if (xVar > 3 || yVar > 3) {
      state.lastMoveAt = now;
    }
  }

  const livenessOk = now - state.lastBlinkAt < 12000 || now - state.lastMoveAt < 6000;

  let reason: string | undefined;
  if (!bothEyesVisible) reason = "Both eyes must be clearly visible";
  else if (!centered) reason = "Center your face in the frame";
  else if (!livenessOk) reason = "Looks like a static image — please move or blink";

  return {
    faceDetected: true,
    multipleFaces: false,
    bothEyesVisible,
    centered,
    livenessOk,
    reason,
  };
}
