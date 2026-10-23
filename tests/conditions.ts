import {pathToFileURL} from 'node:url';
const p=Deno.env.get('SITE_CONDITIONS_PROVIDERS')??new URL('../../',import.meta.url).pathname;
const core=await import(pathToFileURL(`${p}/quarto-course/_extensions/course-core/body-export/links.ts`).href);
const qrc=await import(pathToFileURL(`${p}/quarto-reference-catalog/_extensions/reference-catalog/entrypoints/body-links.ts`).href);
const download=await import(pathToFileURL(`${p}/quarto-project-download/_extensions/project-download/domain/zip.ts`).href);
const production=await import('../_extensions/course-site/application/compose.ts');
const {collectConditions}=await import('../_extensions/course-site/application/conditions.ts');
const root=await Deno.makeTempDir();
const html='<!DOCTYPE html><html lang="ru"><head><title>Условие</title></head><body><div id="exr-one"><p>Начало <span class="qrc-link" data-qrc-ref="theory:sec-one" data-qrc-deferred="true" data-qrc-custom="true">своя подпись</span>.</p><pre>code &lt;value&gt;</pre><a href="https://example.org/ordinary">обычная</a></div></body></html>';
try {
 await Deno.writeTextFile(root+'/theory.html','<h1 id="sec-one">Теория</h1>'); await Deno.writeTextFile(root+'/task.html',html);
 const catalog={schema:'quarto-reference-catalog',generator:{quarto:'1.11.5'},targets:{'tasks:exr-one':{namespace:'tasks',id:'exr-one',page:'task.html',fragment:'exr-one',label:'Условие',labelHtml:'Условие',numberHtml:'',number:''},'theory:sec-one':{namespace:'theory',id:'sec-one',page:'theory.html',fragment:'sec-one',label:'Раздел',title:'Теория',labelHtml:'Раздел',numberHtml:'',number:''}}};
 await Deno.writeTextFile(root+'/reference-catalog.json',JSON.stringify(catalog));
 const original=download.zip([{name:'index.html',bytes:new TextEncoder().encode(html)},{name:'README.md',bytes:new TextEncoder().encode('unchanged')}]);await Deno.writeFile(root+'/one.zip',original);
 const spec={siteRoot:root,baseUrl:'https://example.org/course/',catalogFile:'reference-catalog.json',sourcePages:{'tasks/task.qmd':'task.html'},archives:[{path:'one.zip',id:'exr-one',source:'tasks/task.qmd',namespace:'tasks'}]};
 const fn=(production as any).stageConditions;
 const result=fn?await fn(spec,{publicLinks:core.publicLinks,createBodyLinks:qrc.createBodyLinks,zip:download.zip}):[{path:'one.zip',bytes:original}];
 await Deno.writeFile(root+'/result.zip',result[0].bytes);
 const x=await new Deno.Command('python3',{args:['-c','import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);print(z.read("index.html").decode());assert z.read("README.md")==b"unchanged"',root+'/result.zip'],stdout:'piped',stderr:'piped'}).output();if(!x.success)throw Error(new TextDecoder().decode(x.stderr));const text=new TextDecoder().decode(x.stdout);
 if(!text.includes('href="https://example.org/course/theory.html#sec-one"')||text.includes('data-qrc-deferred'))throw Error('Отложенная ссылка conditions ZIP не стала статическим href');
 if(!text.includes('своя подпись')||!text.includes('https://example.org/ordinary')||!text.includes('lang="ru"')||!text.includes('<title>Условие</title>'))throw Error('Потеряна подпись/обычная ссылка');
 console.log('PASS deferred/custom/ordinary/binary');
 if(text.includes('id="title-block-header"'))throw Error('Writer добавил body title header');
 const pandoc=Deno.env.get('QUARTO_PANDOC')||'/opt/quarto/bin/tools/x86_64/pandoc';
 const nativeText=async(value:string,format:string)=>{const c=new Deno.Command(pandoc,{args:['-f','html','-t',format,'--wrap=none'],stdin:'piped',stdout:'piped',stderr:'piped'}).spawn();const write=(async()=>{const w=c.stdin.getWriter();await w.write(new TextEncoder().encode(value));await w.close();})();const o=await c.output();await write;if(!o.success||o.stderr.length)throw Error('native text check');return new TextDecoder().decode(o.stdout);};
 if(await nativeText(html,'plain')!==await nativeText(text,'plain'))throw Error('Writer изменил body text');
 const pre=(ast:any)=>{const found:string[]=[];const walk=(v:any)=>{if(v?.t==='CodeBlock')found.push(v.c[1]);if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')Object.values(v).forEach(walk);};walk(ast.blocks);return found;};
 if(JSON.stringify(pre(JSON.parse(await nativeText(html,'json'))))!==JSON.stringify(pre(JSON.parse(await nativeText(text,'json')))))throw Error('Writer изменил preformatted blocks');
 console.log('PASS native body text/pre/title/lang preservation');

 const modules={publicLinks:core.publicLinks,createBodyLinks:qrc.createBodyLinks,zip:download.zip};
 const refuse=async(label:string,run:()=>Promise<unknown>)=>{try{await run();}catch{console.log('PASS refusal '+label);return;}throw Error('Не отказал: '+label);};
 await refuse('source mapping',()=>fn({...spec,sourcePages:{'tasks/task.qmd':'theory.html'}},modules));
 await refuse('source hash',()=>fn({...spec,archives:[{...spec.archives[0],sha256:'0'.repeat(64)}]},modules));
 const saved=await Deno.readTextFile(root+'/reference-catalog.json');
 delete (catalog.targets as any)['theory:sec-one'];await Deno.writeTextFile(root+'/reference-catalog.json',JSON.stringify(catalog));
 await refuse('missing target',()=>fn(spec,modules));await Deno.writeTextFile(root+'/reference-catalog.json',saved);
 await Deno.writeTextFile(root+'/theory.html','<h1 id="wrong">нет</h1>');await refuse('missing actual anchor',()=>fn(spec,modules));await Deno.writeTextFile(root+'/theory.html','<h1 id="sec-one">Теория</h1>');
 await refuse('writer failure',()=>fn(spec,{...modules,zip:()=>{throw Error('writer failure');}}));
 const drift={...modules,zip:(entries:any[])=>{Deno.writeTextFileSync(root+'/theory.html','changed');return download.zip(entries);}};
 await refuse('input drift',()=>fn(spec,drift));await Deno.writeTextFile(root+'/theory.html','<h1 id="sec-one">Теория</h1>');
 await Deno.remove(root+'/theory.html');await Deno.symlink(root+'/task.html',root+'/theory.html');await refuse('target symlink',()=>fn(spec,modules));await Deno.remove(root+'/theory.html');await Deno.writeTextFile(root+'/theory.html','<h1 id="sec-one">Теория</h1>');
 // Повторная упаковка собственного результата не дублирует текст/ссылки.
 await Deno.writeFile(root+'/one.zip',result[0].bytes);const repeated=await fn(spec,modules);if(repeated[0].resolved.length!==0)throw Error('Повторное разрешение статической ссылки');
 console.log('PASS repeat finalization');

 await Deno.mkdir(root+'/owner/_generated/project-download',{recursive:true});
 const receipt={schema:'project-download-artifacts-v1',audience:'student',profiles:['student'],sourceRunHash:'historical',archives:[{kind:'conditions',exerciseId:'exr-one',source:'task.qmd',name:'exr-one-conditions.zip',audience:'student',sha256:'hash'},{kind:'starter',name:'starter.zip'}]};
 await Deno.writeTextFile(root+'/owner/_generated/project-download/artifacts-receipt.json',JSON.stringify(receipt));
 const record={project:{path:root+'/owner',mount:'tasks'},record:{outputDir:root+'/local',profiles:['student'],nativeOutputs:[root+'/local/task.html'],files:[root+'/local/_downloads/exr-one-conditions.zip']},config:{course:{view:'student'},'reference-catalog':{namespace:'tasks'}},nativeRuns:[{documents:[{source:'task.qmd',document:{output:'task.html'},projects:[{id:'exr-one'}]}]}]};
 const selected=await collectConditions(root,[record],'https://example.org/course/');if(selected.archives.length!==1||selected.sourcePages['tasks/task.qmd']!=='tasks/task.html')throw Error('Неверный closed selection');
 record.nativeRuns[0].documents[0].projects=[];await refuse('receipt without model association',()=>collectConditions(root,[record],'https://example.org/course/'));
 console.log('PASS generic Site collection selection');

 const manifest={conditions:spec,modules:{core:`${p}/quarto-course/_extensions/course-core/body-export/links.ts`,qrc:`${p}/quarto-reference-catalog/_extensions/reference-catalog/entrypoints/body-links.ts`,download:`${p}/quarto-project-download/_extensions/project-download/domain/zip.ts`},inputs:[],provenance:{test:true}};
 await Deno.writeTextFile(root+'/manifest.json',JSON.stringify(manifest));await Deno.mkdir(root+'/foreign');await Deno.writeTextFile(root+'/foreign/keep','чужой файл');
 const host=await new Deno.Command(Deno.execPath(),{args:['run','--cached-only','-A',new URL('../_extensions/course-site/entrypoints/finalize-conditions.ts',import.meta.url).pathname,root+'/manifest.json',root+'/foreign'],stdout:'piped',stderr:'piped'}).output();
 if(host.success||!new TextDecoder().decode(host.stderr).includes('Output уже существует')||await Deno.readTextFile(root+'/foreign/keep')!=='чужой файл')throw Error('Host output conflict не закрыт');console.log('PASS host foreign output refusal');
 const badHtml=html.replace('data-qrc-ref="theory:sec-one"','data-qrc-ref="theory:sec-one" qrc-ref="theory:sec-one"');
 await Deno.writeFile(root+'/one.zip',download.zip([{name:'index.html',bytes:new TextEncoder().encode(badHtml)}]));await refuse('ambiguous transport',()=>fn(spec,modules));
 await Deno.writeFile(root+'/one.zip',original);
 const unsupported=html.replace('data-qrc-custom="true"','data-qrc-custom="true" data-qrc-style="unknown"');await Deno.writeFile(root+'/one.zip',download.zip([{name:'index.html',bytes:new TextEncoder().encode(unsupported)}]));await refuse('unsupported style',()=>fn(spec,modules));
 await Deno.writeFile(root+'/one.zip',original);
 await new Deno.Command('python3',{args:['-c','import zipfile,sys;z=zipfile.ZipFile(sys.argv[1],"w");z.writestr("../escape",b"x");z.writestr("index.html",b"x");z.close()',root+'/one.zip']}).output();await refuse('unsafe ZIP',()=>fn(spec,modules));


}finally{await Deno.remove(root,{recursive:true});}
