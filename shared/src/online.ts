import type { GameAction, GameState, TokenId } from './types.js';
import type {CardPresentation} from './presentation.js';
/** Wire intentions omit entropy and identity. Only the server constructs GameAction. */
export type GameIntent = GameAction extends infer A ? A extends GameAction ? Omit<A,'actorId'|'dice'|'cardDraw'|'entropy'> : never : never;
export interface RoomPlayer {id:string;name:string;token:TokenId;ready:boolean;connected:boolean;offlineSince?:number|null;offlineForMs?:number;retired?:boolean}
export interface PublicRoom {code:string;hostId:string;capacity:number;players:RoomPlayer[];game:GameState|null;paused:string|null;animationRemainingMs:number;presentation?:CardPresentation|null;cardReadyInMs?:number}
export interface RoomSession {code:string;playerId:string;secret:string}
export type OnlineCommand =
 | {type:'create';name:string;token:TokenId;capacity:number;reducedMotion?:boolean}
 | {type:'join';code:string;name:string;token:TokenId;reducedMotion?:boolean}
 | {type:'resume';code:string;secret:string;reducedMotion?:boolean}
 | {type:'quit'} | {type:'leave'} | {type:'ready';ready:boolean} | {type:'token';token:TokenId}
 | {type:'capacity';capacity:number} | {type:'remove';playerId:string} | {type:'start'}
 | {type:'continue-card';revision:number;eventId:number}
 | {type:'action';action:GameIntent};
// Presentation acknowledgments cannot apply a game action or financial effect.
export interface CommandRequest {id:string;command:OnlineCommand}
export type CommandReply = {ok:true;room:PublicRoom|null;session?:RoomSession}|{ok:false;error:string;code?:'INVALID_REQUEST'|'COMMAND_REJECTED'};

export const DEFAULT_SERVER_PORT = 3101;
export const ONLINE_EVENTS = {identify:'tycoon:identify',command:'command',room:'room',error:'command-error'} as const;
export const SERVER_IDENTITY = {service:'property-tycoon',protocol:4,namespace:'/'} as const;
export type ServerIdentity = typeof SERVER_IDENTITY;
export function isServerIdentity(value:unknown):value is ServerIdentity {
 if(!value||typeof value!=='object')return false;
 const candidate=value as Record<string,unknown>;
 return candidate.service===SERVER_IDENTITY.service&&candidate.protocol===SERVER_IDENTITY.protocol&&candidate.namespace===SERVER_IDENTITY.namespace;
}
/** Reject absent/foreign replies instead of treating a transport connection as a working game service. */
export function isCommandReply(value:unknown):value is CommandReply {
 if(!value||typeof value!=='object')return false;
 const reply=value as Record<string,unknown>;
 if(reply.ok===false)return typeof reply.error==='string';
 if(reply.ok!==true)return false;
 if(reply.room!==null){
  if(!reply.room||typeof reply.room!=='object')return false;
  const room=reply.room as Record<string,unknown>;
  if(typeof room.code!=='string'||typeof room.hostId!=='string'||!Array.isArray(room.players)||typeof room.capacity!=='number')return false;
 }
 if(reply.session!==undefined){
  if(!reply.session||typeof reply.session!=='object')return false;
  const session=reply.session as Record<string,unknown>;
  if(typeof session.code!=='string'||typeof session.playerId!=='string'||typeof session.secret!=='string')return false;
 }
 return true;
}
