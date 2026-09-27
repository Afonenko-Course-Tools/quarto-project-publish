import { activeProfiles, profileArguments } from "../_extensions/project-publish/infrastructure/profiles.ts";
const equal = (a: unknown,b: unknown)=>{if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);};
equal(activeProfiles(""), []);
equal(activeProfiles("student"), ["student"]);
equal(activeProfiles("full,html"), ["full", "html"]);
equal(profileArguments(["full", "html"]), ["--profile", "full,html"]);
for (const invalid of ["../full", "full,full", "full/student"]) {
  let failed=false; try {activeProfiles(invalid);} catch {failed=true;}
  if(!failed) throw new Error(`Accepted invalid profile ${invalid}`);
}
console.log("PASS active profile argument propagation");
