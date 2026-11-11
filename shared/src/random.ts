/** Rejection sampling avoids modulo bias; inject the source for deterministic tests. */
export function randomInt(max: number, fill: (values: Uint32Array<ArrayBuffer>) => void = values => { globalThis.crypto.getRandomValues(values); }): number {
 if (!Number.isSafeInteger(max) || max < 1 || max > 0x100000000) throw new Error('Invalid random range.');
 const values = new Uint32Array(1);
 const limit = Math.floor(0x100000000 / max) * max;
 do { fill(values); } while (values[0]! >= limit);
 return values[0]! % max;
}
export function rollDice(fill?: (values: Uint32Array<ArrayBuffer>) => void): [number, number] {
 return [randomInt(6, fill) + 1, randomInt(6, fill) + 1];
}

/** Private action entropy: never accepted from online clients or broadcast. */
export function actionEntropy(){return Array.from({length:64},()=>randomInt(0x100000000));}
