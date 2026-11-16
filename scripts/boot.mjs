import {existsSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const noBrowser=process.argv.includes('--no-browser');
const checkOnly=process.argv.includes('--check');
const quiet=(command,args)=>spawnSync(command,args,{stdio:'ignore',windowsHide:true,timeout:15000}).status===0;
function run(command,args,timeout=120000) {
  const result=spawnSync(command,args,{stdio:'inherit',windowsHide:true,timeout});
  if (result.error||result.status!==0) throw Error(`${command} failed. Check the messages above and try again.`);
}
async function portOpen(host,port) {
  return new Promise(resolve=>{
    const socket=net.createConnection({host,port});
    const finish=value=>{socket.destroy(); resolve(value);};
    socket.setTimeout(1500,()=>finish(false));
    socket.once('connect',()=>finish(true)); socket.once('error',()=>finish(false));
  });
}
async function waitFor(check,seconds,message) {
  const until=Date.now()+seconds*1000;
  while (Date.now()<until) { if (await check()) return; await delay(1000); }
  throw Error(message);
}
function openBrowser(url) {
  if (noBrowser) return;
  // Pass the URL as data to PowerShell, never as shell source.
  const result=spawnSync('powershell.exe',['-NoProfile','-Command','Start-Process -FilePath $env:PICTUREBOOK_OPEN_URL -WindowStyle Hidden'],{
    env:{...process.env,PICTUREBOOK_OPEN_URL:url},stdio:'ignore',windowsHide:true,timeout:15000
  });
  if (result.error||result.status!==0) console.log(`Open your browser at ${url}`);
}
let server;
try {
  const [major,minor]=process.versions.node.split('.').map(Number);
  if (major<22||(major===22&&minor<13)) throw Error('Install Node.js 22.13 or newer.');
  if (!existsSync('.env')) throw Error('Complete the one-time setup in docs/DATABASE-SETUP.md first: .env is missing.');
  if (!existsSync('node_modules/pg/package.json')) throw Error('Run npm ci once in this folder, then reopen this launcher.');
  if (!existsSync('dist/pages/index.html')) throw Error('Build the frontend first: run npm run build in this folder, then reopen the launcher.');
  const {configuration}=await import('./serve.mjs');
  const config=configuration();
  const db=new URL(process.env.DATABASE_URL);
  if (!['postgres:','postgresql:'].includes(db.protocol)||db.href.includes('CHANGE_ME')) throw Error('Set DATABASE_URL in .env using docs/DATABASE-SETUP.md.');
  const localDB=['127.0.0.1','localhost'].includes(db.hostname)&&(db.port||'5432')==='5432'&&db.pathname==='/picturebook';
  const host=process.env.HOST||'127.0.0.1', port=Number(process.env.PORT||4173);
  const connectHost=['0.0.0.0','::'].includes(host)?'127.0.0.1':host;
  const page=`${config.origin}/pages/index.html`;
  if (checkOnly) {
    console.log(`Startup configuration OK. Database: ${db.hostname}:${db.port||5432}${db.pathname}.`);
    console.log(`Browser: ${page}. Local Compose auto-start: ${localDB?'yes':'no'}.`);
  } else {
    if (localDB&&!(await portOpen(db.hostname,Number(db.port||5432)))) {
      console.log('Starting the local PostgreSQL database...');
      if (!quiet('docker',['info'])) {
        const desktop=path.join(process.env.ProgramFiles||'C:\\Program Files','Docker','Docker','Docker Desktop.exe');
        if (!existsSync(desktop)) throw Error('Install/start Docker Desktop, then reopen this launcher.');
        console.log('Starting Docker Desktop. This can take a couple of minutes...');
        run('powershell.exe',['-NoProfile','-Command',String.raw`Start-Process -FilePath (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe') -WindowStyle Hidden`]);
        await waitFor(()=>quiet('docker',['info']),120,'Docker did not become ready. Open Docker Desktop, resolve any startup message, then retry.');
      }
      run('docker',['compose','up','-d','--wait','--wait-timeout','90','db']);
    }
    const {database}=await import('../server/db.mjs');
    const pool=database();
    try { await pool.query('SELECT name FROM schema_migrations LIMIT 1'); }
    catch { throw Error('Database connection/schema check failed. Check .env and the one-time setup in docs/DATABASE-SETUP.md.'); }
    finally { await pool.end(); }
    if (await portOpen(connectHost,port)) {
      const response=await fetch(`http://${connectHost.includes(':')?`[${connectHost}]`:connectHost}:${port}/api/public/notebook`,{signal:AbortSignal.timeout(5000)});
      const data=await response.json().catch(()=>null);
      if (!response.ok||!data||!Object.hasOwn(data,'profile')||!Array.isArray(data.posts)) throw Error(`Port ${port} is occupied. Close that program or check the existing app.`);
      console.log(`Picture Book is already running: ${page}`);
      openBrowser(page);
    } else {
      console.log('Starting Picture Book. Keep this window open; press Ctrl+C to stop the app.');
      server=spawn(process.execPath,['--env-file-if-exists=.env','scripts/serve.mjs'],{stdio:'inherit',windowsHide:true});
      server.once('error',()=>console.error('Could not launch the Node.js server.'));
      const exited=new Promise(resolve=>server.once('exit',(code,signal)=>resolve({code,signal})));
      process.on('SIGINT',()=>server.kill('SIGINT'));
      process.on('SIGTERM',()=>server.kill('SIGTERM'));
      await waitFor(async()=>{
        if (server.exitCode!==null) throw Error('The app stopped during startup. Read the server message above.');
        try { const r=await fetch(`http://${connectHost.includes(':')?`[${connectHost}]`:connectHost}:${port}/api/public/notebook`,{signal:AbortSignal.timeout(1500)}); return r.ok; }
        catch { return false; }
      },30,'The app did not become ready within 30 seconds.');
      console.log(`Ready: ${page}`); openBrowser(page);
      const result=await exited;
      process.exitCode=result.code??0;
    }
  }
} catch (error) {
  server?.kill();
  // Never print driver errors or connection URLs, which may contain passwords.
  console.error(error.message?.startsWith('Invalid URL')?'Check the URL settings in .env.':error.message?.includes('fetch failed')?'Could not check the existing app. Check HOST/PORT in .env.':error.message);
  process.exitCode=1;
}
