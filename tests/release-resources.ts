import {cleanOutput} from "../_extensions/course-site/infrastructure/files.ts";
import {join} from "stdlib/path";
const root=await Deno.makeTempDir({prefix:"publisher-release-"}),output=join(root,"_site");
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
async function write(path:string,text="данные"){await Deno.mkdir(path.substring(0,path.lastIndexOf("/")),{recursive:true});await Deno.writeTextFile(path,text)}
async function rejects(path:string,resources:string[]=[]){await write(join(output,path));let error;try{await cleanOutput(root,output,resources)}catch(e){error=e}assert(error,"Разрешена опасная очистка: "+path);assert(await Deno.stat(join(output,path)),"Удалён исходник");await Deno.remove(join(output,path));}
try {
 await write(join(root,"README.md"));await write(join(output,"README.md"));
 await cleanOutput(root,output,["README.md"]);
 // Необъявленный Markdown, скопированный native link/resource discovery:
 // это только доказательство восстанавливаемой копии, не privacy/currentness.
 const linked="test-support/shared/d086641fede1/character-queues.md";
 const original="Публичный Markdown\r\nБез изменения исходных bytes.\n";
 await write(join(root,linked),original);await write(join(output,linked),original);
 await cleanOutput(root,output);
 assert(await Deno.readTextFile(join(root,linked))===original,"Удалён или изменён исходный Markdown");
 let copiedRemoved=false;try{await Deno.stat(join(output,linked))}catch(e){if(e instanceof Deno.errors.NotFound)copiedRemoved=true;else throw e}
 assert(copiedRemoved,"Старая копия Markdown не очищена");
 console.log("PASS равная linked Markdown-копия очищена, source сохранён");
 await rejects("missing.md");
 await write(join(root,"different.md"),"другие bytes");await rejects("different.md");
 await Deno.mkdir(join(root,"directory.md"));await rejects("directory.md");
 await write(join(root,"symlink-target.md"));
 await Deno.symlink(join(root,"symlink-target.md"),join(root,"linked.md"));await rejects("linked.md");
 assert(await Deno.readTextFile(join(root,"symlink-target.md"))==="данные","Повреждена цель symlink");
 await Deno.mkdir(join(root,"ordinary"));await write(join(root,"ordinary/nested.md"));
 await Deno.symlink(join(root,"ordinary"),join(root,"linked-directory"));await rejects("linked-directory/nested.md");
 assert(await Deno.readTextFile(join(root,"ordinary/nested.md"))==="данные","Повреждён source за symlink каталога");
 for(const path of ["source.qmd","source.ipynb","source.Rmd","source.yaml","_quarto.yml",".git/config",".quarto/cache.txt","_freeze/cache.txt","_extensions/a.lua"])await rejects(path);
 for(const path of ["source.qmd","source.ipynb","source.Rmd","source.yaml","_quarto.yml"]){await write(join(root,path));await rejects(path)}
 await rejects("source.qmd",["README.md"]);
 for(const path of ["source.qmd","_quarto.yml"]){await write(join(root,path));await rejects(path,[path])}
 await write(join(root,"actual.md"));await Deno.symlink(join(root,"actual.md"),join(root,"link.md"));
 let error;try{await cleanOutput(root,output,["link.md"])}catch(e){error=e}assert(error,"Разрешён symlink ресурса");
 console.log("PASS объявленный README; исходники, служебные каталоги и symlink защищены");
}finally{await Deno.remove(root,{recursive:true})}
