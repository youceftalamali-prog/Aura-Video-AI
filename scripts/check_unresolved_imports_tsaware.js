const fs = require('fs');
const path = require('path');
const roots = ['apps/api','apps/web','apps/admin','packages'];
const exts = ['.ts','.tsx','.js','.jsx','.d.ts'];
function allCandidates(base){
  const c = [];
  for(const e of exts) c.push(base+e);
  for(const e of exts) c.push(path.join(base,'index'+e));
  return c;
}
function resolveImport(file, imp){
  if(!imp.startsWith('.')) return null;
  const dir = path.dirname(file);
  let p = path.resolve(dir, imp);
  // If import has .js extension, try mapping to .ts/.tsx
  if(p.endsWith('.js')){
    const base = p.slice(0,-3);
    const candidates = allCandidates(base);
    for(const c of candidates) if(fs.existsSync(c)) return c;
    // also accept exact .js file
    if(fs.existsSync(p)) return p;
    return {file,imp,candidates};
  }
  // normal
  const candidates = allCandidates(p);
  for(const c of candidates) if(fs.existsSync(c)) return c;
  return {file,imp,candidates};
}
const unresolved = [];
function walk(dir){
  if(!fs.existsSync(dir)) return;
  for(const it of fs.readdirSync(dir)){
    const full = path.join(dir,it);
    try{
      const st = fs.statSync(full);
      if(st.isDirectory()){
        if(it==='node_modules') continue;
        walk(full);
      } else {
        if(/\.(ts|tsx|js|jsx)$/.test(full) && !/node_modules/.test(full)){
          const content = fs.readFileSync(full,'utf8');
          const re = /from\s+['\"]([^'\"]+)['\"]/g;
          let m;
          while((m=re.exec(content))){
            const imp = m[1];
            const r = resolveImport(full, imp);
            if(r && r.imp) unresolved.push(r);
          }
        }
      }
    }catch(e){/* ignore */}
  }
}
for(const r of roots) walk(r);
const out = {count:unresolved.length,examples:unresolved.slice(0,200)};
fs.writeFileSync('/tmp/unresolved-imports-tsaware.json', JSON.stringify(out,null,2));
console.log('WROTE /tmp/unresolved-imports-tsaware.json');
