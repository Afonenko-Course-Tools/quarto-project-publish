import {copy} from "stdlib/fs";
import {join} from "stdlib/path";
const root=await Deno.makeTempDir({prefix:"publisher-repeat-"});
try{
 await copy(new URL('../_extensions',import.meta.url).pathname,join(root,'_extensions'));
 await Deno.mkdir(join(root,'part'));
 await Deno.writeTextFile(join(root,'_quarto.yml'),`project:
  type: website
  output-dir: _site
  render: [index.qmd]
  resources: [README.md, "!part/**"]
  pre-render: _extensions/course-site/entrypoints/pre.ts
  post-render: _extensions/course-site/entrypoints/post.ts
format: html
subprojects: [part]
`);
 await Deno.writeTextFile(join(root,'part/_quarto.yml'),`project:
  type: website
  output-dir: _site
  render: [index.qmd]
  resources: [README.md]
  post-render: ../_extensions/course-site/entrypoints/collect.ts
format: html
`);
 for(const p of ['', 'part/']){
  await Deno.writeTextFile(join(root,p+'index.qmd'),'# Раздел\n\nREPEAT_COMPOSITION\n');
  await Deno.writeTextFile(join(root,p+'README.md'),'Объявленный ресурс '+p);
 }
 for(let i=0;i<2;i++){
 const r=await new Deno.Command(Deno.env.get('QUARTO')||'quarto',{args:['render','--fail-if-warnings'],cwd:root,stdout:'piped',stderr:'piped'}).output();
 if(!r.success)throw Error(new TextDecoder().decode(r.stdout)+new TextDecoder().decode(r.stderr));
 for(const p of ['', 'part/']){
  const html=await Deno.readTextFile(join(root,'_site',p+'index.html'));
  if(!html.includes('REPEAT_COMPOSITION'))throw Error('Потерян HTML');
  if(await Deno.readTextFile(join(root,'_site',p+'README.md'))!=='Объявленный ресурс '+p)throw Error('Потерян ресурс');
 }
 }
 console.log('PASS две композиции с явно объявленным README корня и дочернего проекта');
}finally{await Deno.remove(root,{recursive:true})}
