import {cp, mkdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const extensionDir=path.dirname(fileURLToPath(import.meta.url));
const projectDir=path.resolve(extensionDir,'..');
const outputDir=path.join(extensionDir,'dist');

await rm(outputDir,{recursive:true,force:true});
await mkdir(path.join(outputDir,'app'),{recursive:true});
await cp(path.join(projectDir,'public','index.html'),path.join(outputDir,'app','index.html'));
await cp(path.join(projectDir,'public','app.js'),path.join(outputDir,'app','app.js'));
await cp(path.join(projectDir,'public','style.css'),path.join(outputDir,'app','style.css'));
for(const file of ['manifest.json','background.js','options.html','options.css','options.js']){
  await cp(path.join(extensionDir,file),path.join(outputDir,file));
}
console.log(`Built the Shopwise extension at ${outputDir}`);
