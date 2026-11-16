import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readBody,readJSON} from '../server/api.mjs';

function request(chunks,headers={}) {
  return Object.assign(Readable.from(chunks.map(chunk=>Buffer.from(chunk))),{headers:{'content-type':'application/json',...headers}});
}
assert.deepEqual(await readBody(request(['ab','cd']),4),Buffer.from('abcd'));
await assert.rejects(()=>readBody(request(['abcde'],{'content-length':'5'}),4),{status:413});
await assert.rejects(()=>readBody(request(['ab','cde']),4),{status:413});
await assert.rejects(()=>readBody(request(['abcde'],{'content-length':'1'}),4),{status:413});
assert.deepEqual(await readJSON(request(['{"name":','"世界"}'],{'content-type':'Application/JSON; charset=utf-8'})),{name:'世界'});
await assert.rejects(()=>readJSON(request(['{"text":"世界"}']),14),{status:413});
for(const type of ['text/plain','application/jsonp','application/json-invalid']) {
  await assert.rejects(()=>readJSON(request(['{}'],{'content-type':type})),{status:415});
}
for(const source of ['{','[]','null','"text"','']) {
  await assert.rejects(()=>readJSON(request([source])),{status:400});
}
console.log('14 request-body scenarios passed.');
