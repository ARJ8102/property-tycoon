import {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=mkdtempSync(join(tmpdir(),'tycoon-ignore-'));
const ignored=['node_modules/package/index.js','client/node_modules/package/index.js','client/dist/assets/app.js','server/dist/server/src/main.js','shared/.test-build/engine.js','build/output.js','.env','.env.production','client/.env.local','server/.env.production.local','.aws/credentials','server/private.key','server/private.pem'];
const included=['client/.env.example','server/.env.example','client/.env.production.example','client/src/main.tsx','render.yaml'];
try{
 execFileSync('git',['init','--quiet',root]);copyFileSync(new URL('../.gitignore',import.meta.url),join(root,'.gitignore'));
 for(const file of [...ignored,...included]){const path=join(root,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,'fixture\n');}
 const output=execFileSync('git',['-C',root,'check-ignore','--no-index','--stdin'],{input:[...ignored,...included].join('\n')+'\n',encoding:'utf8'}).trim().split('\n');
 assert.deepEqual(new Set(output),new Set(ignored));console.log('PASS dependency/build/env/private-key files are ignored; source and env examples remain includable.');
}finally{rmSync(root,{recursive:true,force:true});}
