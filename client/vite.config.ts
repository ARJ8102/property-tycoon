import {DEFAULT_SERVER_PORT} from '../shared/src/online';
import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({mode,command})=>{
 const env=loadEnv(mode,process.cwd(),'');
 const configured=env.VITE_SERVER_URL?.trim();
 if(command==='build'&&mode==='production'&&!configured)throw new Error('VITE_SERVER_URL is required for a production build. Set it to the public backend origin.');
 let serverUrl=configured;
 if(configured){
  let parsed:URL;
  try{parsed=new URL(configured);}catch{throw new Error('VITE_SERVER_URL must be a valid HTTP(S) backend origin.');}
  if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw new Error('VITE_SERVER_URL must be an HTTP(S) origin without credentials, a path, query or fragment.');
  serverUrl=parsed.origin;
 }
 return {
  plugins:[react(),tailwindcss()],
  define:{'import.meta.env.VITE_SERVER_URL':JSON.stringify(serverUrl??'')},
  server:command==='serve'?{proxy:{'/socket.io':{target:env.DEV_SERVER_URL||`http://127.0.0.1:${DEFAULT_SERVER_PORT}`,ws:true}}}:undefined,
 };
});
