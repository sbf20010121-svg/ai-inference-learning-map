import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('研究型样板接入旧知识节点，不破坏原课程 ID 和进度存储',()=>{
 const reader=readFileSync(new URL('../site/js/focus-reader.js',import.meta.url),'utf8');
 const depth=readFileSync(new URL('../site/js/depth.js',import.meta.url),'utf8');
 assert.match(reader,/research-labs\.html\?topic=/);
 assert.match(reader,/linear-state/);
 assert.match(reader,/compiler-lowering/);
 assert.match(depth,/ai-inference-depth-progress-v1/);
});
