import fs from 'fs';
import path from 'path';
import { FmcsaOpenDataProvider } from '../src/sentinels/fmcsaOpenDataProvider';
const SNAP = path.join(__dirname, '../data/fmcsa-snapshots/operating-authority.json');
async function main() {
  const before = fs.existsSync(SNAP) ? fs.readFileSync(SNAP, 'utf-8') : 'NONE';
  const p = new FmcsaOpenDataProvider();
  const r = await p.fetchNewAuthorities(new Date().toISOString());
  const after = fs.existsSync(SNAP) ? fs.readFileSync(SNAP, 'utf-8') : 'NONE';
  console.log(`OUTAGE new=${r.length} degraded=${p.degraded()} snapshotUnchanged=${before === after} (expect new=0 degraded=true unchanged=true, no throw)`);
}
main().then(() => process.exit(0)).catch((e) => { console.error('THREW (FAIL — must not crash pipeline):', e.message); process.exit(1); });
