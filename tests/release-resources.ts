import {cleanOutput} from "../_extensions/course-site/infrastructure/files.ts";
import {join} from "stdlib/path";
const root=await Deno.makeTempDir({prefix:"publisher-release-"}),output=join(root,"_site");
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
async function write(path:string,text="данные"){await Deno.mkdir(path.substring(0,path.lastIndexOf("/")),{recursive:true});await Deno.writeTextFile(path,text)}
async function rejects(path:string,resources:string[]=[]){await write(join(output,path));let error;try{await cleanOutput(root,output,resources)}catch(e){error=e}assert(error,"Разрешена опасная очистка: "+path);assert(await Deno.stat(join(output,path)),"Удалён исходник");await Deno.remove(join(output,path));}
try {
 await write(join(root,"README.md"));await write(join(output,"README.md"));
 await cleanOutput(root,output,["README.md"]);
 for(const path of ["source.qmd","_quarto.yml",".git/config",".quarto/cache.txt","_freeze/cache.txt","_extensions/a.lua"])await rejects(path);
 await rejects("source.qmd",["README.md"]);
 for(const path of ["source.qmd","_quarto.yml"]){await write(join(root,path));await rejects(path,[path])}
 await write(join(root,"actual.md"));await Deno.symlink(join(root,"actual.md"),join(root,"link.md"));
 let error;try{await cleanOutput(root,output,["link.md"])}catch(e){error=e}assert(error,"Разрешён symlink ресурса");
 console.log("PASS объявленный README; исходники, служебные каталоги и symlink защищены");
}finally{await Deno.remove(root,{recursive:true})}
