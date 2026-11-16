import {randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual, randomUUID} from 'node:crypto';
import {promisify} from 'node:util';
import {fail} from './model.mjs';
import {transaction} from './db.mjs';
const scrypt=promisify(scryptCallback);
export const digest=value=>createHash('sha256').update(value).digest();
export async function hashPassword(password) {
  if (typeof password!=='string'||password.length<12||password.length>1024) fail('Use a password of 12–1024 characters.');
  const salt=randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await scrypt(password,salt,64)).toString('hex')}`;
}
export async function verifyPassword(password,encoded) {
  const [scheme,salt,hash]=encoded.split(':');
  if (scheme!=='scrypt'||!salt||!hash||typeof password!=='string'||password.length>1024) return false;
  const actual=await scrypt(password,salt,64), expected=Buffer.from(hash,'hex');
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
export async function createOwner(pool,login,password) {
  if (typeof login!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(login)) fail('Use a lowercase owner login of 1–64 letters, digits, underscores or hyphens.');
  const hash=await hashPassword(password), id=randomUUID();
  return transaction(pool, async c=>{
    await c.query('INSERT INTO accounts(id,login_name,password_hash) VALUES($1,$2,$3)',[id,login,hash]);
    await c.query('INSERT INTO profiles(owner_id,display_name) VALUES($1,$2)',[id,login]);
    return id;
  });
}
export async function session(pool,req) {
  const token=(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('picturebook_session='))?.slice(20);
  if (!token||!/^[a-f0-9]{64}$/.test(token)) return null;
  return (await pool.query(`SELECT a.id,a.login_name FROM sessions s JOIN accounts a ON a.id=s.owner_id
    WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND a.disabled_at IS NULL`,[digest(token)])).rows[0]??null;
}
export function cookie(token,secure,maxAge) {
  return `picturebook_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`;
}
export function createLoginLimiter() {
  const attempts=new Map();
  return key=>{
    const now=Date.now();
    for (const [k,v] of attempts) if (now-v.start>900000) attempts.delete(k);
    const entry=attempts.get(key)??{count:0,start:now};
    if (entry.count>=10 || attempts.size>=10000 && !attempts.has(key)) fail('Too many login attempts. Try again in 15 minutes.',429);
    entry.count++; attempts.set(key,entry);
  };
}
export async function login(pool,loginName,password,days=7) {
  const account=(await pool.query('SELECT * FROM accounts WHERE login_name=$1',[typeof loginName==='string'?loginName.toLowerCase():''])).rows[0];
  // Equal-cost dummy hash check for unknown users.
  const encoded=account?.password_hash??`scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
  if (!await verifyPassword(password,encoded)||!account||account.disabled_at) fail('Incorrect login or password.',401);
  const token=randomBytes(32).toString('hex');
  await pool.query('DELETE FROM sessions WHERE expires_at<now() OR revoked_at IS NOT NULL');
  await pool.query('INSERT INTO sessions(token_hash,owner_id,expires_at) VALUES($1,$2,$3)',[digest(token),account.id,new Date(Date.now()+days*86400000)]);
  return token;
}
export async function logout(pool,req) {
  const token=(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('picturebook_session='))?.slice(20);
  if (token) await pool.query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1',[digest(token)]);
}
