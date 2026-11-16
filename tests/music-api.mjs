import assert from 'node:assert/strict';
import {music} from '../server/api.mjs';
let calls=0;
const metadata={title:'A song',author_name:'An artist',thumbnail_url:'https://example.com/cover.jpg'};
async function request(method,path,fetcher) {
  const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.data=JSON.parse(body);}};
  await music({method},res,new URL(path,'http://localhost'),fetcher);return res;
}
const upstream=async(url,options)=>{calls++;assert.equal(url.origin,'https://www.youtube.com');assert.equal(url.pathname,'/oembed');assert.ok(options.signal);return {ok:true,json:async()=>({...metadata,html:'excluded'})};};
for(const [method,path,status] of [['POST','/api/music-info?videoId=M7lc1UVf-VE',405],['GET','/api/music-info',400],['GET','/api/music-info?videoId=invalid',400]])assert.equal((await request(method,path,upstream)).status,status);
assert.equal(calls,0);assert.deepEqual((await request('GET','/api/music-info?videoId=M7lc1UVf-VE',upstream)).data,metadata);
for(const stub of [async()=>({ok:false}),async()=>{throw Error('Network');},async()=>({ok:true,json:async()=>({title:'incomplete'})})])assert.equal((await request('GET','/api/music-info?videoId=M7lc1UVf-VE',stub)).status,502);
console.log('7 music API scenarios passed (mocked YouTube).');
