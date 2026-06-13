import fs from 'fs';
import path from 'path';
import { FmcsaOpenDataProvider } from '../src/sentinels/fmcsaOpenDataProvider';

const SNAP = path.join(__dirname, '../data/fmcsa-snapshots/operating-authority.json');

async function main() {
  const since = new Date().toISOString();

  fs.rmSync(SNAP, { force: true });

  const p1 = new FmcsaOpenDataProvider();
  const run1 = await p1.fetchNewAuthorities(since);
  const snap = JSON.parse(fs.readFileSync(SNAP, 'utf-8'));
  console.log(`BASELINE new=${run1.length} degraded=${p1.degraded()} snapshotDockets=${snap.dockets.length} (expect new=0 cold start)`);

  // Simulate three dockets newly appearing by dropping them from the prior snapshot.
  const dropped = snap.dockets.slice(0, 3);
  snap.dockets = snap.dockets.slice(3);
  fs.writeFileSync(SNAP, JSON.stringify(snap, null, 2));
  console.log(`INJECT removed ${dropped.length} dockets from prior snapshot: ${dropped.join(', ')}`);

  const p2 = new FmcsaOpenDataProvider();
  const run2 = await p2.fetchNewAuthorities(since);
  console.log(`DIFF new=${run2.length} degraded=${p2.degraded()} (expect ${dropped.length} new, enriched)`);
  for (const r of run2) {
    console.log('  ', JSON.stringify({
      docket: r.docket_number, dot: r.dot_number, name: r.legal_name, dba: r.dba_name,
      type: r.authority_type, granted: r.authority_granted_date,
      pu: r.power_units, drv: r.drivers, loc: `${r.phy_city},${r.phy_state}`,
      op: r.operation_classification, cargo: r.cargo_carried,
    }));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('THREW:', e); process.exit(1); });
