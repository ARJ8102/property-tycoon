import {useEffect,useState} from 'react';
import {actingPlayer,type GameAction,type GameState} from '@property-tycoon/shared';
import {useViewer} from './Viewer';
import {Modal} from './Modal';
import {money} from './format';
export function AuctionDialog({game,dispatch}:{game:GameState;dispatch:(action:GameAction)=>void}){
 const auction=game.auction!,bidder=actingPlayer(game),{canControl}=useViewer(game),[amount,setAmount]=useState(auction.highestBid+1);
 useEffect(()=>setAmount(auction.highestBid+1),[auction.propertyId,auction.highestBid]);
 const allowed=canControl(bidder.id),context={actorId:bidder.id,expectedRevision:game.revision};
 return <Modal title={`Auction · ${game.spaces[auction.propertyId]!.name}`}><p>The bank is auctioneer. Highest bid: <strong>{money(auction.highestBid)}</strong>{auction.highestBidderId?` by ${game.players.find(p=>p.id===auction.highestBidderId)!.name}`:' · No bids yet'}. Passing removes you from this auction.</p><p role="status"><strong>{bidder.name}</strong> may bid or pass. Cash: {money(bidder.cash)}.</p><p>Still participating: {auction.participants.map(id=>game.players.find(p=>p.id===id)!.name).join(', ')}.</p><form onSubmit={e=>{e.preventDefault();dispatch({...context,type:'BID',amount});}}><label className="field-label" htmlFor="auction-bid">Your bid</label><input id="auction-bid" type="number" min={auction.highestBid+1} max={bidder.cash} step="1" required disabled={!allowed} value={amount} onChange={e=>setAmount(e.target.valueAsNumber)}/><div className="action-row"><button type="submit" className="primary" disabled={!allowed||!Number.isSafeInteger(amount)||amount<=auction.highestBid||amount>bidder.cash}>Bid {Number.isFinite(amount)?money(amount):''}</button><button type="button" className="secondary" disabled={!allowed} onClick={()=>dispatch({...context,type:'PASS_AUCTION'})}>Pass auction</button></div></form></Modal>;
}
