const dots: Record<number, number[]> = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
export function Die({value,rolling=false}: {value: number|null;rolling?:boolean}) {
 return <svg className={`die ${rolling?'rolling':''}`} viewBox="0 0 36 36" role="img" aria-label={rolling?'Dice rolling':value===null?'Die not rolled':`Die: ${value}`}><rect x="1" y="1" width="34" height="34" rx="6" fill="#f9faf4" stroke="#708569"/>{!rolling&&value!==null&&dots[value]?.map(i=><circle key={i} cx={9+(i%3)*9} cy={9+Math.floor(i/3)*9} r="2.5" fill="#214e36"/>)}{!rolling&&value===null&&<text x="18" y="23" textAnchor="middle" fontSize="17" fill="#73866a">?</text>}</svg>;
}
