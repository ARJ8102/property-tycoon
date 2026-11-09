export type DeckName='Treasure'|'Luck';
export type CardEffect = {kind:'money';amount:number}|{kind:'move';destination:number}|{kind:'trouble'}|{kind:'opponents';amount:number;direction:'collect'|'pay'}|{kind:'transit'}|{kind:'utility'}|{kind:'back';spaces:number}|{kind:'lockup'}|{kind:'repairs';development:number;landmark:number};
export interface GameCard {id:string;title:string;text:string;effect:CardEffect}
const card=(id:string,title:string,text:string,effect:CardEffect):GameCard=>({id,title,text,effect});
export const LUCK_CARDS:readonly GameCard[]=[
 card('luck-01','Skyline appointment','Your next meeting is in New York. Travel forward to that address.',{kind:'move',destination:39}),
 card('luck-02','Fresh start','Return to Launch Plaza along the forward route and receive $200.',{kind:'move',destination:0}),
 card('luck-03','Island showcase','Manila is hosting your exhibition. Travel forward there; a Launch Plaza crossing pays $200.',{kind:'move',destination:24}),
 card('luck-04','Market invitation','Visit Marrakesh by the forward route. Receive $200 if you pass Launch Plaza.',{kind:'move',destination:11}),
 card('luck-05','Express connection','Ride forward to the next transit line. An owner collects twice the usual transit rent.',{kind:'transit'}),
 card('luck-06','Late-night service','The next transit line has a seat for you. Move forward there; pay an owner double normal transit rent.',{kind:'transit'}),
 card('luck-07','Infrastructure visit','Go forward to the closest utility. If another player owns it, roll two fresh dice and pay ten times their sum.',{kind:'utility'}),
 card('luck-08','Street performance','Your lunchtime concert brings in $50 from the bank.',{kind:'money',amount:50}),
 card('luck-09','Release voucher','Keep this Get Out of Trouble voucher outside the deck. Surrender it once to leave Lockup.',{kind:'trouble'}),
 card('luck-10','Missed entrance','Retrace three spaces and resolve the address you reach. Backward travel never earns a Launch Plaza payment.',{kind:'back',spaces:3}),
 card('luck-11','Closed-door inquiry','Report directly to Lockup. This transfer earns no Launch Plaza payment.',{kind:'lockup'}),
 card('luck-12','Facade survey','Pay $25 for each ordinary development and $100 for each Landmark. A Landmark replaces its four levels for this bill.',{kind:'repairs',development:25,landmark:100}),
 card('luck-13','Permit stamp','A document processing stamp costs $15. Pay the bank.',{kind:'money',amount:-15}),
 card('luck-14','Atlantic departure','Travel forward to Atlantic Line at space 5. Collect $200 if you cross Launch Plaza.',{kind:'move',destination:5}),
 card('luck-15','Shared venture launch','Contribute $50 to each other active player’s new venture.',{kind:'opponents',amount:50,direction:'pay'}),
 card('luck-16','Design commission','The bank pays $150 for your new public-space design.',{kind:'money',amount:150}),
];
export const TREASURE_CARDS:readonly GameCard[]=[
 card('treasure-01','Homeward festival','Take the forward route to Launch Plaza and receive $200.',{kind:'move',destination:0}),
 card('treasure-02','Restoration prize','Your restoration project wins a $200 bank award.',{kind:'money',amount:200}),
 card('treasure-03','Archive fee','Pay the bank $50 to retrieve your property records.',{kind:'money',amount:-50}),
 card('treasure-04','Weekend market','Your stall earns $50. Collect it from the bank.',{kind:'money',amount:50}),
 card('treasure-05','Community guarantor','Hold this Get Out of Trouble card until you surrender it to leave Lockup.',{kind:'trouble'}),
 card('treasure-06','Records inquiry','Go straight to Lockup for a records inquiry. Do not collect a Launch Plaza payment.',{kind:'lockup'}),
 card('treasure-07','Garden sponsorship','A sponsor pays you $100 through the bank.',{kind:'money',amount:100}),
 card('treasure-08','Recycled materials','Sell spare materials and collect $20 from the bank.',{kind:'money',amount:20}),
 card('treasure-09','Neighborhood supper','Each other active player contributes $10 to your neighborhood supper.',{kind:'opponents',amount:10,direction:'collect'}),
 card('treasure-10','Workshop proceeds','Your public workshop earns $100 from the bank.',{kind:'money',amount:100}),
 card('treasure-11','Roof inspection bill','Pay the bank $100 for a specialist roof inspection.',{kind:'money',amount:-100}),
 card('treasure-12','Directory renewal','Renew your directory entry by paying the bank $50.',{kind:'money',amount:-50}),
 card('treasure-13','Salvage sale','A salvaged sign sells for $25. Collect the payment from the bank.',{kind:'money',amount:25}),
 card('treasure-14','Neighborhood maintenance','Pay $40 per ordinary development and $115 per Landmark. Do not also count a Landmark’s replaced levels.',{kind:'repairs',development:40,landmark:115}),
 card('treasure-15','Found deposit','A forgotten deposit returns $10 to you from the bank.',{kind:'money',amount:10}),
 card('treasure-16','Local enterprise grant','The bank awards your enterprise a $100 grant.',{kind:'money',amount:100}),
];
export const CARD_DECKS={Treasure:TREASURE_CARDS,Luck:LUCK_CARDS} as const;
