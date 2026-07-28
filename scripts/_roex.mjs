// Pull the reference monster table into a flat JSON so the mapping pass can
// match against it without re-parsing YAML every run.
import fs from 'node:fs';

const t = fs.readFileSync('E:/ro-reference/rathena/db/pre-re/mob_db.yml', 'utf8');
const out = [];
for (const chunk of t.split('
  - Id:').slice(1)) {
  const g = (k) => {
    const m = chunk.match(new RegExp(String.raw`^    ${k}:\s*(\S+)`, 'm'));
    return m ? m[1] : undefined;
  };
  const num = (k) => {
    const v = g(k);
    return v === undefined ? undefined : Number(v);
  };
  const name = g('Name');
  if (!name) continue;
  out.push({
    aegis: g('AegisName'), name,
    level: num('Level') ?? 1, hp: num('Hp') ?? 1,
    baseExp: num('BaseExp') ?? 0, jobExp: num('JobExp') ?? 0,
    atk: num('Attack') ?? 0, atk2: num('Attack2') ?? 0,
    def: num('Defense') ?? 0, mdef: num('MagicDefense') ?? 0,
    str: num('Str') ?? 0, agi: num('Agi') ?? 0, vit: num('Vit') ?? 0,
    int: num('Int') ?? 0, dex: num('Dex') ?? 0, luk: num('Luk') ?? 0,
    range: num('AttackRange') ?? 1,
    size: (g('Size') ?? 'Medium').toLowerCase(),
    race: (g('Race') ?? 'Formless').toLowerCase(),
    element: (g('Element') ?? 'Neutral').toLowerCase(),
    elementLevel: num('ElementLevel') ?? 1,
    walkSpeed: num('WalkSpeed') ?? 400,
    attackDelay: num('AttackDelay') ?? 1000,
    boss: g('Class') === 'Boss',
    mvp: /Mvp: true/.test(chunk),
  });
}
fs.mkdirSync('E:/SpiritClaude/.cache', { recursive: true });
fs.writeFileSync('E:/SpiritClaude/.cache/ro_mobs.json', JSON.stringify(out));
console.log(`extracted: ${out.length}  boss: ${out.filter((m) => m.boss).length}  mvp: ${out.filter((m) => m.mvp).length}`);
