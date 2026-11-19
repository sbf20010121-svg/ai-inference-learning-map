/** Pure rendering of authored prose, mathematics, comparisons and static figures. */
import { renderMechanism, defaultLab, esc } from "./mechanism-visuals.js";

export function staticMechanism(chapter, namespace, overrides = {}) {
  const state = { ...defaultLab(), ...(chapter.initial || {}) };
  if (chapter.startIR !== undefined) state.ir = chapter.startIR;
  if (chapter.startKV !== undefined) state.kvStep = chapter.startKV;
  Object.assign(state, overrides);
  let html = renderMechanism(chapter.figure, state)
    .replace(/<fieldset\b[\s\S]*?<\/fieldset>/g, "")
    .replace(/<button\b([^>]*)>/g, (_, attrs) => {
      const cls = attrs.match(/\bclass="([^"]*)"/);
      return `<span class="static-figure-label ${cls ? cls[1] : ""}">`;
    })
    .replace(/<\/button>/g, "</span>");
  // Replace only the outer caption. Inner captions identify A/B/C, axes or state.
  const lastCaption = [...html.matchAll(/<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/g)].at(-1);
  if (lastCaption && /^\s*<\/figure>\s*$/.test(html.slice(lastCaption.index + lastCaption[0].length))) {
    html = html.slice(0, lastCaption.index) + html.slice(lastCaption.index + lastCaption[0].length);
  }
  // Several chapters can show the same SVG. Keep marker/label identities local.
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  for (const id of new Set(ids)) {
    const replacement = `${namespace}-${id}`;
    html = html.replaceAll(`id="${id}"`, `id="${replacement}"`)
      .replaceAll(`url(#${id})`, `url(#${replacement})`)
      .replaceAll(`href="#${id}"`, `href="#${replacement}"`)
      .replaceAll(`aria-labelledby="${id}"`, `aria-labelledby="${replacement}"`);
  }
  return html;
}

export function renderTeachingBlock(block, chapter, key = "reading") {
  if (block.type === "p") return `<p>${esc(block.text)}</p>`;
  if (block.type === "note") return `<aside class="learning-note"><p>${esc(block.text)}</p></aside>`;
  if (block.type === "heading") return `<h3>${esc(block.text)}</h3>`;
  if (block.type === "code") return `<figure class="learning-code"><figcaption>${esc(block.label || "教学代码示意")}</figcaption><pre><code>${esc(block.text)}</code></pre></figure>`;
  if (block.type === "table") return `<figure class="learning-comparison"><figcaption>${esc(block.caption || "")}</figcaption><div class="learning-table-scroll" tabindex="0" role="region" aria-label="${esc(block.caption || "对照表")}"><table><thead><tr>${block.columns.map((column) => `<th scope="col">${esc(column)}</th>`).join("")}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((cell, i) => i ? `<td>${esc(cell)}</td>` : `<th scope="row">${esc(cell)}</th>`).join("")}</tr>`).join("")}</tbody></table></div></figure>`;
  if (block.type === "math") return `<section class="learning-equation" aria-label="${esc(block.label || "公式及解释")}"><h3>${esc(block.label || "用公式表达这层关系")}</h3><div class="learning-math" tabindex="0" role="region" aria-label="${esc(block.label || "公式")}">${block.html}</div>${block.variables?.length ? `<dl class="learning-variables">${block.variables.map(([symbol, meaning]) => `<div><dt>${esc(symbol)}</dt><dd>${esc(meaning)}</dd></div>`).join("")}</dl>` : ""}${block.explanation ? `<p>${esc(block.explanation)}</p>` : ""}${block.steps?.length ? `<ol class="learning-derivation">${block.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>` : ""}</section>`;
  if (block.type === "figure" && chapter) return `<figure class="learning-figure"><div class="learning-static-mechanism" data-reading-figure="${esc(chapter.figure)}">${staticMechanism(chapter, key, block.state)}</div><figcaption>${esc(block.caption)}</figcaption></figure>`;
  throw new Error(`Unsupported teaching block: ${block.type}`);
}

export function renderTeachingBlocks(blocks, chapter, key) {
  return blocks.map((block, i) => renderTeachingBlock(block, chapter, `${key}-${i}`)).join("");
}
