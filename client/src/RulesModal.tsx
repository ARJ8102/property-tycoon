import { useEffect, useRef } from 'react';

const sections = [
 ['Objective', ['Build a portfolio, collect rent and remain solvent. Cash ranking is a live leaderboard; it does not determine turn order or victory.']],
 ['Starting money and setup', ['Every player starts at Launch Plaza with $1,500 and a unique token. Starting there does not award money. Offline supports one human and 1–3 bots. Online supports 2–8 humans in a private room; everyone readies up before the host starts.']],
 ['Initial turn-order competition', ['Each player rolls two dice. Higher totals go first. Ties reroll only within their tied block; settled places stay fixed. The offline human or online host confirms Start Game. These setup rolls do not move pieces or change cash. Eliminated players are skipped in the finalized order.']],
 ['Normal movement and dice', ['Roll two six-sided dice and move forward by their sum. Resolve every purchase, rent, tax, card, auction or debt before continuing. You may manage eligible assets before rolling and after landing. End Turn passes control when no extra roll is owed.']],
 ['Doubles', ['Matching dice grant another roll in the same turn after the landing is fully resolved. Three consecutive normal doubles send you directly to Lockup: the third roll does not move normally or earn Launch Plaza money. A nonmatching roll, turn end or forced Lockup visit clears the streak. Doubles used to escape Lockup never grant an extra roll.']],
 ['Launch Plaza', ['Forward travel passing or landing on Launch Plaza pays $200 once per crossing. A card directing you there pays $200 through that movement. Backward travel and direct transfers to Lockup never earn this payment.']],
 ['Buying properties', ['When you land on an unowned city, transit line or utility, buy at its listed price if you can pay. Declining starts an auction; it does not simply leave the title available.']],
 ['Property auctions', ['The bank auctions the title to all active players, including the player who declined. In the displayed bidding order, bid a positive whole-dollar amount above the highest bid and no greater than your cash, or pass permanently out of this auction. The highest remaining bidder wins and pays the bank atomically. If everyone passes before any bid, the title stays unowned. Loans, financing and property management are unavailable while bidding. A disconnected authorized bidder pauses the online match; their bid is not forfeited.']],
 ['City rent and complete groups', ['An owner collects the exact rent schedule shown in property details: unimproved, Development Levels 1–4 or Landmark. Unimproved rent doubles with complete color-group ownership. Developed and Landmark rents do not double. Mortgaged properties collect no rent.']],
 ['Transit lines and utilities', ['Transit lines cost $200 each; rent is $25/$50/$100/$200 for 1/2/3/4 lines owned. A nearest-transit Luck card doubles that normal rent. Aqua and Power cost $150 each. Ordinary utility rent is 4 × the landing dice total for one utility or 10 × for both. A nearest-utility Luck card uses two fresh dice at 10 × their total when another player owns the destination. Mortgages still suppress rent. An unowned card destination offers the normal purchase.']],
 ['Developments and Landmarks', ['Own a complete city group with no mortgages before building evenly. There are four ordinary development levels, then one Landmark at the listed cost. Build at most once on each property per turn; several different properties can each receive one build. Landmarks count as a build. Selling or transferring a title does not clear its current-turn build flag, and extra doubles rolls do not reset it. Sell the highest development rank first, evenly, for half its original cost. Selling a Landmark restores Level 4 and refunds half its Landmark cost. Repair cards count each ordinary level individually, but count a Landmark once without its four replaced levels.']],
 ['Mortgages and unmortgaging', ['A bare property mortgages for 50% of purchase price. No city in its color group may retain improvements. Ordinary redemption costs the principal plus 10% interest, rounded up to whole dollars. Mortgaged titles remain owned and do not collect rent. Bankruptcy inheritance has an additional immediate-interest procedure described below.']],
 ['Trading', ['The eligible player may propose an immediate exchange of owned titles and cash with another active player. Both must approve; the engine rechecks funds and ownership on acceptance and transfers everything together. Sell all improvements in a color group before trading its cities. Mortgages stay attached. During debt resolution, a liquidation trade must sell your property for a net cash payment and returns you to the outstanding debt afterward. Bots use their strategies and may reject.']],
 ['Treasure cards', ['Treasure has 16 original cards: bank payments and grants, a Launch Plaza journey, direct Lockup, a held release card, $10 collected from each active opponent, and repairs at $40 per ordinary development/$115 per Landmark. Each draw is recorded with its complete text and financial effect.']],
 ['Luck cards', ['Luck has 16 original cards: forward city/transit journeys, two separately drawable nearest-transit journeys, a nearest-utility assessment, three-space backward travel, bank payments and grants, direct Lockup, a held release card, $50 paid to each active opponent, and repairs at $25 per development/$100 per Landmark. Both decks are shuffled independently, draw without replacement, and reshuffle their discards when empty. Held release cards stay outside their decks until used or surrendered, then return to the bottom of their originating deck. Upcoming order is private online.']],
 ['Busted and Lockup', ['Busted sends you directly to Lockup without a Launch Plaza payment. A normal visit to Lockup has no penalty. Forced Lockup clears an extra roll. Detained owners still collect rent and may trade, mortgage or develop when otherwise eligible; detention does not freeze their assets.']],
 ['Three ways to leave Lockup', ['At the beginning of a detained turn, pay $50 or consume a held Get Out of Trouble card, then roll normally; or attempt doubles. A successful doubles attempt releases you and moves that total once without an extra roll. An unsuccessful attempt ends the turn. After the third failure, pay $50 and move using that same roll; if necessary resolve the fee debt first. Bankruptcy cancels this deferred movement.']],
 ['Debt settlement and liquidation', ['Insufficient cash creates a pending debt showing debtor, creditor and amount. Normal progression pauses without making cash negative. Sell developments/Landmarks for half cost under even-selling rules, mortgage eligible bare properties, or negotiate a property-for-cash trade. Once funded, Pay debt transfers the entire obligation exactly once. A speculative, unaccepted trade is not guaranteed funding. Bankruptcy becomes available only when cash plus permitted property liquidation cannot cover the obligation; it is never triggered solely by a low cash balance.']],
 ['Bankruptcy owed to a player', ['Remaining improvements are liquidated at half cost. Remaining cash, titles and held release cards transfer to the creditor; mortgage status stays attached. The creditor immediately owes the bank 10% of each transferred mortgage principal, rounded up. If necessary, that fee creates its own debt. After paying it, choose to redeem each inherited mortgage immediately for its principal or keep it mortgaged. Keeping it means another 10% interest is charged on eventual ordinary redemption. The debtor is eliminated.']],
 ['Bankruptcy owed to the bank', ['Improvements are liquidated at half cost and remaining cash goes to the bank. Held release cards return to the bottom of their originating decks. Each returned title has its mortgage cleared and is auctioned separately to the remaining active players. The eliminated player cannot bid. Finish those auctions before continuing or declaring the winner.']],
 ['Prohibited loans and agreements', ['There are no bank loans, player-to-player loans, negative cash transfers, rent-immunity promises or future-payment consideration. Trade forms and server validation support only immediate owned-title and nonnegative whole-dollar cash transfers. Unapproved promises have no game effect.']],
 ['Winning and online continuity', ['The last solvent player wins after pending debts, inherited mortgage decisions and bankruptcy auctions finish. If no player remains solvent, the table closes without a winner. Online dice, decks, bids, money and ownership are server-authoritative. An active player, auction bidder, debtor, required trade participant or inheritor disconnecting pauses the match until they reclaim their seat. Offline refresh discards the local game; online refresh restores a saved session while the server remains running. Server restarts or sleeping lose in-memory rooms.']],
] as const;

export function RulesModal({ onClose }: { onClose: () => void }) {
 const dialogRef = useRef<HTMLDialogElement>(null);
 const closeRef = useRef<HTMLButtonElement>(null);
 useEffect(() => {
  const dialog = dialogRef.current!;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const previousOverflow = document.body.style.overflow;
  dialog.showModal();
  closeRef.current?.focus();
  document.body.style.overflow = 'hidden';
  return () => {
   dialog.close();
   document.body.style.overflow = previousOverflow;
   previousFocus?.focus();
  };
 }, []);
 return <dialog ref={dialogRef} className="rules-modal" aria-modal="true" aria-labelledby="rules-title" aria-describedby="rules-notice" onKeyDown={event => {
  if (event.key !== 'Tab') return;
  const targets = event.currentTarget.querySelectorAll<HTMLElement>('button, [tabindex="0"]');
  const first = targets[0];
  const last = targets[targets.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
 }} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
  if (event.target !== event.currentTarget) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
 }}>
  <header className="rules-header"><div><span className="eyebrow">PROPERTY TYCOON</span><h2 id="rules-title">Rules of the table</h2></div><button ref={closeRef} type="button" className="rules-close" onClick={onClose} aria-label="Close rules">×</button></header>
  <div className="rules-content" tabIndex={0} aria-label="Game rules">
   <p id="rules-notice" className="rules-notice"><strong>Property Tycoon · Rules of play</strong>The same rules apply offline and online. Property details show exact prices and rent schedules.</p>
   {sections.map(([title, items], index) => <section key={title}><h3>{index + 1}. {title}</h3><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></section>)}
  </div>
 </dialog>;
}
