import {createPlayingGame as createGame} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionInfo,ownershipTint,finances} from '../.test-build/index.js';
const setup=()=>createGame({humanName:'Taylor',token:'circle',playerCount:4});
test('collections derive counts from actual city, transit and utility data',()=>{
 const s=setup();s.ownership={1:'player-1',3:'player-1',5:'player-1',12:'player-1'};
 assert.deepEqual([collectionInfo(s,1).count,collectionInfo(s,1).total,collectionInfo(s,1).complete],[2,2,true]);assert.equal(collectionInfo(s,5).total,4);assert.equal(collectionInfo(s,12).total,2);
});
test('portfolio separates base assets and development, deducting mortgage once',()=>{
 const s=setup();s.ownership={1:'player-1',3:'player-1'};s.properties={1:{level:1,mortgaged:false},3:{level:0,mortgaged:true}};
 const f=finances(s,'player-1');assert.equal(f.basePropertyValue,120);assert.equal(f.developmentValue,50);assert.equal(f.netWorth,1640);
});
test('city tints exist only for complete ownership and disappear on transfers',()=>{
 const s=setup();s.ownership={1:'player-1'};assert.equal(ownershipTint(s,1),undefined);s.ownership[3]='player-1';assert.ok(ownershipTint(s,1));s.ownership[3]='player-2';assert.equal(ownershipTint(s,1),undefined);
});
test('transit tint handles four, three, pairs, single and four distinct owners',()=>{
 const ids=[5,15,25,35],s=setup();
 for(const distribution of [[1,1,1,1],[1,1,1,2],[1,1,2,2],[1,2,3,4]]){
  ids.forEach((id,index)=>{s.ownership[id]=`player-${distribution[index]}`;});
  for(const id of ids){const count=ids.filter(p=>s.ownership[p]===s.ownership[id]).length;assert.equal(!!ownershipTint(s,id),count>=2);}
  if(distribution.join()==='1,1,2,2'){assert.equal(ownershipTint(s,5),ownershipTint(s,15));assert.notEqual(ownershipTint(s,5),ownershipTint(s,25));}
 }
});
test('utility tint is distinct and removed when ownership is split; base city rent doubles',async()=>{
 const {calculateRent}=await import('../.test-build/index.js');const s=setup();s.ownership={12:'player-1',28:'player-1',1:'player-1',3:'player-1'};
 assert.equal(ownershipTint(s,12),ownershipTint(s,28));assert.notEqual(ownershipTint(s,12),ownershipTint(s,1));assert.equal(calculateRent(s,1),4);s.ownership[28]='player-2';assert.equal(ownershipTint(s,12),undefined);
});
