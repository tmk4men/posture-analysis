import {
  FilesetResolver,
  PoseLandmarker,
} from "https://esm.sh/@mediapipe/tasks-vision@0.10.21";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const WASM_URL = "https://esm.sh/@mediapipe/tasks-vision@0.10.21/wasm";

let landmarkerPromise = null;

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "IMAGE",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });
    })();
  }
  return landmarkerPromise;
}

export async function warmup() {
  await getLandmarker();
}

export async function detectPose(imageElement) {
  const detector = await getLandmarker();
  const result = detector.detect(imageElement);
  if (!result.landmarks || result.landmarks.length === 0) return null;
  return {
    landmarks: result.landmarks[0],
    worldLandmarks: result.worldLandmarks?.[0] ?? null,
  };
}
