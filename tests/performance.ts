import {strict as assert} from 'node:assert';
const root=await Deno.makeTempDir();const saved=Deno.env.get('QUARTO');
try {
 const fake=root+'/tool';await Deno.writeTextFile(fake,'#!/bin/sh\nprintf \'ok\\n\'\n');await Deno.chmod(fake,0o700);
 Deno.env.set('QUARTO',fake);Deno.env.set('COURSE_BUILD_TRACE',root+'/legacy.jsonl');Deno.env.set('COURSE_PERF_MODE','off');
 const original=performance.now.bind(performance);Object.defineProperty(performance,'now',{configurable:true,value:()=>{throw new Error('Off должен обходиться без часов телеметрии');}});
 try { const {quarto}=await import('../_extensions/course-site/infrastructure/process.ts');assert.equal(await quarto(['inspect','.'],root),'ok\n'); }
 finally {Object.defineProperty(performance,'now',{configurable:true,value:original});}
 await assert.rejects(()=>Deno.stat(root+'/legacy.jsonl'),Deno.errors.NotFound);
 console.log('PASS off: без таймеров и legacy файлов, вывод инструмента сохранён');
} finally {saved===undefined?Deno.env.delete('QUARTO'):Deno.env.set('QUARTO',saved);Deno.env.delete('COURSE_BUILD_TRACE');Deno.env.delete('COURSE_PERF_MODE');await Deno.remove(root,{recursive:true});}
