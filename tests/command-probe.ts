import {join} from 'node:path';
export async function commandProbe(root:string,executable:string,logPath:string):Promise<string> {
 const dir=join(root,'_test-command-probe');await Deno.mkdir(dir,{recursive:true});
 const program=join(dir,'record.ts'), launcher=join(dir,'quarto');
 await Deno.writeTextFile(program,`const [tool,log,...args]=Deno.args;
const child=new Deno.Command(tool,{args,stdin:'inherit',stdout:'inherit',stderr:'inherit'}).spawn();
const result=await child.status;
await Deno.writeTextFile(log,JSON.stringify({kind:args[0],args,cwd:Deno.cwd(),exitCode:result.code})+'\\n',{append:true});
Deno.exit(result.code);`);
 const quote=(s:string)=>"'"+s.replaceAll("'","'\\''")+"'";
 await Deno.writeTextFile(launcher,'#!/bin/sh\nexec '+quote(Deno.execPath())+' run --no-config --no-lock -A '+quote(program)+' '+quote(executable)+' '+quote(logPath)+' "$@"\n');
 await Deno.chmod(launcher,0o700);return launcher;
}
