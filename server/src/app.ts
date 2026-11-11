import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { RoomManager, type Connection } from './rooms.js';
import { ONLINE_EVENTS, SERVER_IDENTITY, type CommandReply } from '../../shared/src/index.js';
interface FailureContext {socketId?:string;code?:number;origin?:string;transport?:string;requestId?:string;commandType?:string;error:string;roomCode?:string;durationMs?:number;ok?:boolean;reason?:string;actionType?:string}
interface ServerOptions {manager?:RoomManager;origins?:string[];logger?:{info?:(message:string,context:FailureContext)=>void;error:(message:string,context:FailureContext)=>void}}
export function createGameServer(options:ServerOptions={}) {
 const app=express();app.disable('x-powered-by');app.get('/health',(_req,res)=>res.json({ok:true,...SERVER_IDENTITY}));
 const http=createServer(app),manager=options.manager??new RoomManager(),logger=options.logger??console;
 const diagnostic=(message:string,context:FailureContext)=>{try{logger.info?.(message,context);}catch{}};
 const origins=options.origins??[];
 const io=new Server(http,{maxHttpBufferSize:16_384,pingInterval:5000,pingTimeout:5000,cors:{origin:origins.length?origins:false},allowRequest:(req,done)=>{
  const origin=req.headers.origin;let sameOrigin=false;try{sameOrigin=!!origin&&new URL(origin).host===req.headers.host;}catch{}
  done(null,!origin||sameOrigin||origins.includes(origin));
 }});
 io.engine.on('connection_error',error=>{
  try{logger.error('[Property Tycoon] Socket.IO connection failed',{error:error.message,code:error.code,origin:error.req.headers.origin,transport:String((error.req as typeof error.req & {_query?:{transport?:string}})._query?.transport??'unknown')});}
  catch{console.error('[Property Tycoon] Socket.IO connection failed; error logger unavailable.');}
 });
 // Install all application listeners before the caller starts the HTTP listener.
 io.on('connection',socket=>{
  diagnostic('[Property Tycoon] Socket connected',{socketId:socket.id,error:''});
  const conn:Connection={id:socket.id};let windowStart=Date.now(),requests=0;
  socket.on(ONLINE_EVENTS.identify,(ack:unknown)=>{if(typeof ack==='function')ack(SERVER_IDENTITY);});
  socket.on(ONLINE_EVENTS.command,async(request:unknown,ack:unknown)=>{
   const envelope=request&&typeof request==='object'?request as Record<string,unknown>:{};
   const command=envelope.command&&typeof envelope.command==='object'?envelope.command as Record<string,unknown>:{};
   const started=Date.now();
   const commandType=['create','join','resume','leave','ready','token','capacity','remove','start','action'].includes(String(command.type))?String(command.type):'unknown';
   const action=command.action&&typeof command.action==='object'?command.action as Record<string,unknown>:{};
   const actionType=typeof action.type==='string'&&/^[A-Z_]{1,32}$/.test(action.type)?action.type:undefined;
   diagnostic('[Property Tycoon] Command received',{socketId:socket.id,roomCode:conn.roomCode,commandType,actionType,error:''});
   let replied=false;
   const reply=(value:CommandReply)=>{
    if(replied)return;replied=true;
    diagnostic('[Property Tycoon] Command acknowledgment',{socketId:socket.id,roomCode:conn.roomCode,commandType,actionType,durationMs:Date.now()-started,ok:value.ok,error:''});
    if(typeof ack==='function')ack(value);
    else socket.emit(ONLINE_EVENTS.error,value);
   };
   const fail=(error:unknown,code:'INVALID_REQUEST'|'COMMAND_REJECTED')=>{
    const message=error instanceof Error?error.message:'Command rejected.';
    // Log metadata only: requests and room session secrets must not enter logs.
    try{logger.error('[Property Tycoon] Command failed',{socketId:socket.id,roomCode:conn.roomCode,commandType,actionType,durationMs:Date.now()-started,error:message});}
    catch{console.error('[Property Tycoon] Command logging failed.');}
    finally{reply({ok:false,error:message,code});}
   };
   if(typeof ack!=='function'){fail(new Error('Include an acknowledgment callback with every command.'),'INVALID_REQUEST');return;}
   try{
    if(Date.now()-windowStart>60_000){windowStart=Date.now();requests=0;}if(++requests>180)throw new Error('Too many requests. Wait a moment.');
    const oldCode=conn.roomCode;
    // Await command and adapter operations so asynchronous failures also receive a reply.
    const result=await manager.command(conn,envelope.id,envelope.command);
    if(!socket.connected){const room=manager.disconnect(conn);if(room)io.to(room.code).emit(ONLINE_EVENTS.room,room);return;}
    if(oldCode&&oldCode!==conn.roomCode)await socket.leave(oldCode);
    if(conn.roomCode)await socket.join(conn.roomCode);
    if(result.replacedSocket&&result.replacedSocket!==socket.id)io.sockets.sockets.get(result.replacedSocket)?.disconnect(true);
    const roomCode=conn.roomCode??oldCode;const room=roomCode?manager.roomSnapshot(roomCode):null;if(room)io.to(room.code).emit(ONLINE_EVENTS.room,room);
    reply({ok:true,room:result.room,...(result.session?{session:result.session}:{})});
   }catch(error){fail(error,'COMMAND_REJECTED');}
  });
  socket.on('disconnect',reason=>{diagnostic('[Property Tycoon] Socket disconnected',{socketId:socket.id,roomCode:conn.roomCode,reason,error:''});const room=manager.disconnect(conn);if(room)io.to(room.code).emit(ONLINE_EVENTS.room,room);});
 });
 const cleanup=setInterval(()=>manager.sweep(),60_000);cleanup.unref();
 return {app,http,io,manager,close:()=>new Promise<void>(resolve=>{clearInterval(cleanup);io.close(()=>resolve());})};
}
