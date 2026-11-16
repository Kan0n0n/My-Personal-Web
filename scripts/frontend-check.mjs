export async function frontendReady(base, expectedHTML, fetcher = fetch) {
  const page = await fetcher(new URL('/pages/index.html',base),{signal:AbortSignal.timeout(3000)});
  if(!page.ok || await page.text() !== expectedHTML)return false;
  const scripts=Array.from(expectedHTML.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),match=>match[1]);
  if(!scripts.length)return false;
  for(const source of scripts){
    const url=new URL(source,base);
    if(url.origin!==new URL(base).origin||!url.pathname.startsWith('/assets/'))return false;
    const response=await fetcher(url,{signal:AbortSignal.timeout(3000)});
    if(!response.ok||!response.headers.get('content-type')?.includes('javascript'))return false;
  }
  return true;
}
