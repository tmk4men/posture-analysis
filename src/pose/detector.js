// MediaPipe はCDNから動的に読み込む。静的 import にすると、CDNが落ちている・
// 回線が塞がれている・その端末で bundle が動かない、のどれか1つで
// このモジュールを読む main.js ごと死に、写真も痛み部位も触れない画面になる。
// 骨格検出以外のUIはMediaPipe無しで成立するので、依存は関数の中に閉じ込める。
const CDN_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21";
const BUNDLE_URL = `${CDN_BASE}/vision_bundle.mjs`;

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task";
const WASM_URL = `${CDN_BASE}/wasm`;

let visionModulePromise = null;
let landmarkerPromise = null;

function loadVisionModule() {
  if (!visionModulePromise) {
    visionModulePromise = import(BUNDLE_URL).catch((err) => {
      visionModulePromise = null; // 再試行できるようにする
      throw new Error(
        `骨格検出エンジンを読み込めませんでした（${(err && err.message) || err}）`,
      );
    });
  }
  return visionModulePromise;
}

async function getLandmarker() {
  if (!landmarkerPromise) {
    // 失敗したまま握り続けると以後ずっと同じ拒否を返すので、落ちたら捨てて次に再試行させる。
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await loadVisionModule();
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
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
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
