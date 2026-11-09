import {DEFAULT_SERVER_PORT} from '../../shared/src/online.js';

function origin(value:string,label:string):string {
 let parsed:URL;
 try{parsed=new URL(value);}catch{throw new Error(`${label} must be a valid HTTP(S) frontend origin.`);}
 if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw new Error(`${label} must be an HTTP(S) origin without credentials, a path, query or fragment.`);
 return parsed.origin;
}
/** Keep production configuration explicit while retaining the existing local proxy setup. */
export function serverConfig(env:NodeJS.ProcessEnv=process.env){
 const production=env.NODE_ENV==='production';
 const port=Number(env.PORT??DEFAULT_SERVER_PORT);
 if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT must be an integer from 0 to 65535.');
 const frontend=env.FRONTEND_URL?.trim();
 if(production&&!frontend)throw new Error('FRONTEND_URL is required in production; set it to the public frontend origin.');
 const origins=[...(frontend?[origin(frontend,'FRONTEND_URL')]:[]),...(env.CLIENT_ORIGINS??'').split(',').map(s=>s.trim()).filter(Boolean).map(s=>origin(s,'CLIENT_ORIGINS'))];
 return {port,host:production?'0.0.0.0':env.HOST??'0.0.0.0',origins:[...new Set(origins)]};
}
