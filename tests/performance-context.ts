import {strict as assert} from 'node:assert';
const root=await Deno.makeTempDir(),key=Symbol.for('course.performance.agent.v1');
const registry=globalThis as unknown as Record<symbol,unknown>;
const priorMode=Deno.env.get('COURSE_PERF_MODE'),priorTool=Deno.env.get('QUARTO');
const fn=(_spec:unknown,value:Function)=>value;
try {
 Deno.env.set('COURSE_PERF_MODE','summary');Deno.env.set('QUARTO',Deno.execPath());
 registry[key]={abiVersion:1,metrics:{wrapSync:fn,wrapAsync:fn,wrapWalk:fn,childEnv:(base:Record<string,string>)=>({...base,COURSE_PERF_PARENT_SPAN_ID:'observed-parent'})}};
 const {quarto}=await import('../_extensions/course-site/infrastructure/process.ts?context-test');
 const args=['eval',"console.log(JSON.stringify([Deno.env.get('COURSE_PERF_PARENT_SPAN_ID'),Deno.env.get('FUNCTIONAL'),Deno.env.get('QUARTO_PROFILE')]));"],env={FUNCTIONAL:'keep',QUARTO_PROFILE:'student'};
 assert.deepEqual(JSON.parse(await quarto(args,root,env)),['observed-parent','keep','student']);
 assert.deepEqual(env,{FUNCTIONAL:'keep',QUARTO_PROFILE:'student'});
 console.log('PASS явная передача наблюдаемого parent span и сохранение функционального env');
}finally{
 Reflect.deleteProperty(registry,key);priorMode===undefined?Deno.env.delete('COURSE_PERF_MODE'):Deno.env.set('COURSE_PERF_MODE',priorMode);priorTool===undefined?Deno.env.delete('QUARTO'):Deno.env.set('QUARTO',priorTool);await Deno.remove(root,{recursive:true});
}
