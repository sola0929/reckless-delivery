// A fingerprint of everything level 1 is made of: to tell that a change to how it is built has changed nothing. npx tsx dev/city-print.ts
import { createHash } from 'node:crypto';
import { city } from '../src/levels/city';
const level = city();
console.log(createHash('sha256').update(JSON.stringify(level)).digest('hex').slice(0, 16), `${level.props.length} props, ${level.objects?.length} objects, ${level.decals.length} decals`);
