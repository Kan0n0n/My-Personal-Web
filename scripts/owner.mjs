import readline from 'node:readline/promises';
import {database} from '../server/db.mjs';
import {createOwner,hashPassword} from '../server/auth.mjs';
import {transaction} from '../server/db.mjs';

// Password comes from hidden terminal input, never command arguments or logs.
async function secret(prompt) {
  if (!process.stdin.isTTY) throw Error('Run this command in an interactive terminal.');
  process.stdout.write(prompt);
  process.stdin.setRawMode(true); process.stdin.resume();
  let value='';
  return new Promise((resolve,reject)=>{
    const read=chunk=>{
      for (const ch of chunk.toString()) {
        if (ch==='\r'||ch==='\n'||ch==='\u0003') {
          process.stdin.off('data',read); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n');
          if (ch==='\u0003') reject(Error('Cancelled.')); else resolve(value);
          return;
        }
        if (ch==='\u007f'||ch==='\b') value=value.slice(0,-1);
        else if (ch>=' ') value+=ch;
      }
    };
    process.stdin.on('data',read);
  });
}
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const loginName=(await rl.question('Owner login: ')).trim().toLowerCase(); rl.close();
let pool;
try {
  const password=await secret('Password (at least 12 characters): ');
  if (password!==await secret('Repeat password: ')) throw Error('Passwords did not match.');
  pool=database(process.env.MIGRATION_DATABASE_URL||process.env.DATABASE_URL);
  if (process.argv.includes('--reset-password')) {
    const hash=await hashPassword(password);
    await transaction(pool,async c=>{
      const result=await c.query('UPDATE accounts SET password_hash=$1,updated_at=now() WHERE login_name=$2 RETURNING id',[hash,loginName]);
      if (!result.rows.length) throw Error('Owner not found.');
      await c.query('DELETE FROM sessions WHERE owner_id=$1',[result.rows[0].id]);
    });
    console.log('Owner password reset; sessions revoked.');
  } else { await createOwner(pool,loginName,password); console.log('Owner created. Set SITE_OWNER_LOGIN to this login in .env.'); }
} catch (error) { console.error(error.status?error.message:'Owner setup failed. Check the connection, login, and whether the account already exists.'); process.exitCode=1; }
finally { await pool?.end(); }
