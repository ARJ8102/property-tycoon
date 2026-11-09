import { TOKENS, type TokenId } from '@property-tycoon/shared';
const paths: Record<Exclude<TokenId, 'circle'>, string> = {
 triangle: 'M16 3 30 28H2Z', square: 'M5 5H27V27H5Z', diamond: 'M16 2 30 16 16 30 2 16Z',
 star: 'm16 2 4.3 9 9.7 1.4-7 6.8 1.7 9.6-8.7-4.5-8.7 4.5L9 19.2l-7-6.8 9.7-1.4Z',
 hexagon: 'M9 3H23L30 16 23 29H9L2 16Z', heart: 'M16 29C12 25 2 18 2 10 2 1 12 0 16 8 20 0 30 1 30 10 30 18 20 25 16 29Z', cross: 'M11 2H21V11H30V21H21V30H11V21H2V11H11Z',
};
export function Token({id, size = 26}: {id: TokenId; size?: number}) {
 const token = TOKENS.find(t => t.id === id)!;
 return <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={`${token.name} token`} className="token"><g fill={token.color} stroke="white" strokeWidth="1.8" strokeLinejoin="round">{id === 'circle' ? <circle cx="16" cy="16" r="13"/> : <path d={paths[id]}/>}</g></svg>;
}
