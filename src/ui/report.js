// Render the AI-generated structured findings into the summary section.
// findings shape: { observations: string[], implications: string[], selfcare: string[], notes: string }
export function renderFindings(findings, fallbackText) {
  const container = document.getElementById("summary-output");
  if (!findings) {
    container.innerHTML = `<pre style="white-space:pre-wrap">${escapeHtml(fallbackText ?? "結果がありません")}</pre>`;
    return;
  }

  const list = (items) =>
    items && items.length
      ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
      : "<p>該当なし</p>";

  container.innerHTML = `
    <h3>所見（観察された姿勢の傾向）</h3>
    ${list(findings.observations)}
    <h3>身体への影響として考えられること</h3>
    ${list(findings.implications)}
    <h3>推奨セルフケア</h3>
    ${list(findings.selfcare)}
    ${findings.notes ? `<h3>注意事項</h3><p>${escapeHtml(findings.notes)}</p>` : ""}
    <p class="disclaimer">
      ※ 本所見はAIによる姿勢推定値からの自動生成であり、医学的診断ではありません。
      症状の原因特定や治療方針は施術者の判断によります。
    </p>
  `;
}

export function renderRawSummary(text) {
  renderFindings(null, text);
}

export function setStatus(text) {
  document.getElementById("status-text").textContent = text;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function triggerPrint() {
  window.print();
}
