import type { PropertySpace, PropertyGroup, Space } from './types.js';
export const INITIAL_CASH = 1500;
// Exact economics in board order; IDs and collection membership stay stable.
export const CITY_ECONOMICS = [
 [60,50,2,10,30,90,160,250],[60,50,4,20,60,180,320,450],
 [100,50,6,30,90,270,400,550],[100,50,6,30,90,270,400,550],[120,50,8,40,100,300,450,600],
 [140,100,10,50,150,450,625,750],[140,100,10,50,150,450,625,750],[160,100,12,60,180,500,700,900],
 [180,100,14,70,200,550,750,950],[180,100,14,70,200,550,750,950],[200,100,16,80,220,600,800,1000],
 [220,150,18,90,250,700,875,1050],[220,150,18,90,250,700,875,1050],[240,150,20,100,300,750,925,1100],
 [260,150,22,110,330,800,975,1150],[260,150,22,110,330,800,975,1150],[280,150,24,120,360,850,1025,1200],
 [300,200,26,130,390,900,1100,1275],[300,200,26,130,390,900,1100,1275],[320,200,28,150,450,1000,1200,1400],
 [350,200,35,175,500,1100,1300,1500],[400,200,50,200,600,1400,1700,2000],
] as const;
const CITY_IDS=[1,3,6,8,9,11,13,14,16,18,19,21,23,24,26,27,29,31,32,34,37,39];
const p = (id:number,name:string,group:PropertyGroup,_price:number):PropertySpace => {
 const [price,cost,...rents]=CITY_ECONOMICS[CITY_IDS.indexOf(id)]!;
 return {id,name,kind:'property',group,price,baseRent:rents[0]!,rents,upgradeCost:cost,landmarkCost:cost,landmarkRent:rents[5]!};
};
export const BOARD: readonly Space[] = [
 {id:0,name:'Launch Plaza',kind:'start'}, p(1,'Lisbon','clay',60), {id:2,name:'Treasure',kind:'event'}, p(3,'Porto','clay',60), {id:4,name:'Civic Tax',kind:'tax',amount:200},
 {id:5,name:'Atlantic Line',kind:'transit',price:200,baseRent:25}, p(6,'Riga','sky',100), {id:7,name:'Luck',kind:'event'}, p(8,'Oslo','sky',100), p(9,'Berlin','sky',120),
 {id:10,name:'Lockup',kind:'inspection'}, p(11,'Marrakesh','rose',140), {id:12,name:'Power',kind:'utility',price:150,baseRent:4}, p(13,'Cairo','rose',140), p(14,'Nairobi','rose',160),
 {id:15,name:'Desert Line',kind:'transit',price:200,baseRent:25}, p(16,'Istanbul','amber',180), {id:17,name:'Treasure',kind:'event'}, p(18,'Athens','amber',180), p(19,'Rome','amber',200),
 {id:20,name:'Public Gardens',kind:'rest'}, p(21,'Mumbai','coral',220), {id:22,name:'Luck',kind:'event'}, p(23,'Hanoi','coral',220), p(24,'Manila','coral',240),
 {id:25,name:'Pacific Line',kind:'transit',price:200,baseRent:25}, p(26,'Seoul','gold',260), p(27,'Kyoto','gold',260), {id:28,name:'Aqua',kind:'utility',price:150,baseRent:4}, p(29,'Tokyo','gold',280),
 {id:30,name:'Busted',kind:'detour'}, p(31,'Melbourne','jade',300), p(32,'Sydney','jade',300), {id:33,name:'Treasure',kind:'event'}, p(34,'Auckland','jade',320),
 {id:35,name:'Southern Line',kind:'transit',price:200,baseRent:25}, {id:36,name:'Luck',kind:'event'}, p(37,'Vancouver','indigo',350), {id:38,name:'Skyline Tax',kind:'tax',amount:100}, p(39,'New York','indigo',400),
];
