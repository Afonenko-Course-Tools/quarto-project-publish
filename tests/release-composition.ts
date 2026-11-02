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
  resources: [README.md, "!part/**", "!test-support/**"]
  pre-render: _extensions/course-site/entrypoints/pre.ts
  post-render: _extensions/course-site/entrypoints/post.ts
format: html
subprojects: [{path: part, to: default}]
`);
 await Deno.writeTextFile(join(root,'part/_quarto.yml'),`project:
  type: website
  output-dir: _site
  render: [index.qmd]
  resources: [README.md, "!test-support/**"]
  post-render: ../_extensions/course-site/entrypoints/collect.ts
format: html
`);
 for(const p of ['', 'part/']){
  await Deno.writeTextFile(join(root,p+'index.qmd'),'# Раздел\n\nREPEAT_COMPOSITION\n\n[Связанный Markdown](test-support/shared/linked.md)\n');
  await Deno.writeTextFile(join(root,p+'README.md'),'Объявленный ресурс '+p);
  await Deno.mkdir(join(root,p+'test-support/shared'),{recursive:true});
  await Deno.writeTextFile(join(root,p+'test-support/shared/linked.md'),'Связанный Markdown '+p+'\r\n');
  for(const profile of ['student','full']){
    await Deno.writeTextFile(join(root,p+'_quarto-'+profile+'.yml'),'project:\n  output-dir: '+(p?'_output/':'_site-')+profile+'\n');
  }
 }
 for(const profile of ['student','full','student']){
 const r=await new Deno.Command(Deno.env.get('QUARTO')||'quarto',{args:['render','--profile',profile,'--fail-if-warnings'],cwd:root,stdout:'piped',stderr:'piped'}).output();
 if(!r.success)throw Error(new TextDecoder().decode(r.stdout)+new TextDecoder().decode(r.stderr));
 for(const p of ['', 'part/']){
  const html=await Deno.readTextFile(join(root,'_site-'+profile,p+'index.html'));
  if(!html.includes('REPEAT_COMPOSITION'))throw Error('Потерян HTML');
  if(!html.includes('href="test-support/shared/linked.md"'))throw Error('Потеряна ссылка Markdown');
  const expected='Связанный Markdown '+p+'\r\n';
  if(await Deno.readTextFile(join(root,p+'test-support/shared/linked.md'))!==expected)throw Error('Изменён исходный Markdown');
  if(await Deno.readTextFile(join(root,'_site-'+profile,p+'test-support/shared/linked.md'))!==expected)throw Error('Потеряна копия Markdown');
  if(await Deno.readTextFile(join(root,'_site-'+profile,p+'README.md'))!=='Объявленный ресурс '+p)throw Error('Потерян ресурс');
 }
 }
 console.log('PASS student/full/student: README и связанный Markdown корня/child, source bytes и ссылки сохранены');
}finally{await Deno.remove(root,{recursive:true})}
