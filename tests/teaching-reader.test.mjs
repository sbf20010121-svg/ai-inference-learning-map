import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { allCourses, allCourseById } from "../site/js/course-registry.js";
import { chaptersFor } from "../site/js/mechanism-curriculum.js";
import { teachingCourses } from "../site/js/teaching-courses.js";
import { renderFocusReader } from "../site/js/focus-reader.js";
import { learningFoundations } from "../site/js/learning-foundations.js";
import { staticMechanism } from "../site/js/teaching-blocks.js";

test("authored reading content preserves every course and chapter identity without missing fallbacks", () => {
  assert.deepEqual(Object.keys(teachingCourses).sort(), allCourses.map(c => c.id).sort());
  for (const item of allCourses) {
    const course = teachingCourses[item.id];
    assert.deepEqual(Object.keys(course.chapters).sort(), chaptersFor(item.id).map(c => c.id).sort(), item.id);
    for (const text of [...course.intro, ...course.closing]) assert.ok(typeof text === "string" && text.trim(), item.id);
    assert.ok(course.prerequisites.length > 0, item.id);
    for (const prerequisite of course.prerequisites) {
      assert.ok(prerequisite.term && prerequisite.explain, item.id);
      if (prerequisite.course) assert.ok(allCourseById.has(prerequisite.course), item.id + "/" + prerequisite.course);
    }
    assert.ok(course.references.length > 0, item.id);
    for (const ref of course.references) assert.equal(new URL(ref.url).protocol, "https:");
    for (const [id, chapter] of Object.entries(course.chapters)) {
      assert.ok(chapter.title && chapter.blocks.length > 0, item.id + "/" + id);
      for (const block of chapter.blocks) {
        assert.ok(["p", "math", "table", "figure", "note", "heading", "code"].includes(block.type));
        if (block.type === "math") assert.ok(block.variables.length && block.explanation, item.id + "/" + id);
        if (block.type === "table") for (const row of block.rows) assert.equal(row.length, block.columns.length, item.id + "/" + id);
      }
    }
  }
});

test("a course reads continuously with its prerequisites and equations outside the optional experiment", () => {
  for (const item of allCourses) {
    const html = renderFocusReader(item, {}, { chapter: chaptersFor(item.id)[0].id });
    const body = html.slice(0, html.indexOf('<details class="course-experiment"'));
    assert.equal((body.match(/data-learning-chapter=/g) || []).length, chaptersFor(item.id).length, item.id);
    assert.equal((body.match(/id="mechanismQuestion"/g) || []).length, 1, item.id);
    assert.ok(body.indexOf('class="learning-prerequisites"') < body.indexOf('class="learning-article"'));
    assert.doesNotMatch(body, /data-mech-key=|data-f-answer=/, item.id + " reading must not require the experiment");
    const mathCount = Object.values(teachingCourses[item.id].chapters).flatMap(ch => ch.blocks).filter(b => b.type === "math").length;
    assert.equal((body.slice(body.indexOf('class="learning-article"')).match(/class="learning-equation"/g) || []).length, mathCount, item.id);
    assert.match(html, /<details class="course-experiment" id="optionalMechanism" >/);
    // NaN may be explained in prose; a computed cell or attribute must not be NaN.
    assert.doesNotMatch(html, /undefined|(?:>\s*|=["'])NaN(?=\s*<|["'])/);
  }
});

test("all authored MathML is well formed with valid fraction, index and limit arity", () => {
  const blocks = [
    ...Object.entries(teachingCourses).flatMap(([course, value]) => Object.entries(value.chapters).flatMap(([chapter, section]) => section.blocks.map(block => ({ id: `${course}/${chapter}`, ...block })))),
    ...learningFoundations.flatMap(item => item.blocks.map(block => ({ id: `foundation/${item.id}`, ...block }))),
  ].filter(block => block.type === "math");
  assert.ok(blocks.length > 0);
  for (const block of blocks) assert.doesNotMatch(block.html, /<(?:script|iframe|style)\b|\bon\w+\s*=|javascript:|\\(?:frac|sum|begin)\b/i, block.id);
  const python = `import json,sys,xml.etree.ElementTree as E
errors=[]
arity={'mfrac':2,'msub':2,'msup':2,'msubsup':3,'munder':2,'mover':2,'munderover':3,'mroot':2}
for block in json.load(sys.stdin):
 try:
  root=E.fromstring(block['html'])
  assert root.tag=='{http://www.w3.org/1998/Math/MathML}math', 'MathML namespace'
  for n in root.iter():
   name=n.tag.split('}')[-1]
   if name in arity: assert len(n)==arity[name], name+' child count'
 except Exception as e: errors.append(block['id']+': '+str(e))
print(json.dumps(errors,ensure_ascii=False))
sys.exit(bool(errors))`;
  const result = spawnSync("python3", ["-c", python], { input: JSON.stringify(blocks), encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("static reading figures retain the labels that identify the mathematical objects", () => {
  const chapter = chaptersFor("gemm-tiling").find(item => item.id === "reuse");
  const figure = staticMechanism(chapter, "gemm-reading", { kStep: 2 });
  assert.match(figure, /A：该Tile复用的行带/);
  assert.match(figure, /B：该Tile复用的列带/);
  assert.match(figure, /C：已累计4个K位置/);
  assert.doesNotMatch(figure, /<button|<fieldset|data-mech-key/);
});
