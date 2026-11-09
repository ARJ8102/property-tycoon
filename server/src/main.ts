import {createGameServer} from './app.js';
import {serverConfig} from './config.js';

try{
 const config=serverConfig();
 const server=createGameServer({origins:config.origins});
 server.http.on('error',(error:NodeJS.ErrnoException)=>{
  console.error(`[Property Tycoon] Cannot listen on ${config.host}:${config.port}: ${error.code==='EADDRINUSE'?'port is already in use. Choose a free PORT and set the frontend DEV_SERVER_URL to match.':error.message}`);
  process.exit(1);
 });
 server.http.listen(config.port,config.host,()=>{
  const address=server.http.address();const port=typeof address==='object'&&address?address.port:config.port;
  console.log(`[Property Tycoon] Server listening on ${config.host}:${port} (${process.env.NODE_ENV??'development'}).`);
  console.log(`[Property Tycoon] Frontend origins: ${config.origins.join(', ')||'same-origin development proxy'}.`);
 });
 for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{void server.close().then(()=>process.exit(0));});
}catch(error){
 console.error(`[Property Tycoon] Startup configuration error: ${error instanceof Error?error.message:'Invalid server configuration.'}`);
 process.exit(1);
}
