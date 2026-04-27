// Load an uploaded File into an HTMLImageElement, resolving once decoded.
export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export function setupUpload(view, onImageReady) {
  const card = document.querySelector(`.upload-card[data-view="${view}"]`);
  const input = card.querySelector(`input[type="file"][data-view="${view}"]`);
  const dropzone = card.querySelector(".dropzone");
  const wrap = card.querySelector(".canvas-wrap");

  input.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { img } = await loadImageFromFile(file);
      dropzone.classList.add("has-image");
      wrap.classList.add("has-image");
      await onImageReady(view, img);
    } catch (err) {
      console.error(err);
      alert(`${view} の画像読み込みに失敗しました`);
    }
  });
}

export function resetUpload(view) {
  const card = document.querySelector(`.upload-card[data-view="${view}"]`);
  const input = card.querySelector(`input[type="file"][data-view="${view}"]`);
  const dropzone = card.querySelector(".dropzone");
  const wrap = card.querySelector(".canvas-wrap");
  const list = card.querySelector(".metric-list");
  input.value = "";
  dropzone.classList.remove("has-image");
  wrap.classList.remove("has-image");
  list.classList.remove("has-data");
  list.innerHTML = "";
  const canvas = wrap.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 0;
  canvas.height = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
