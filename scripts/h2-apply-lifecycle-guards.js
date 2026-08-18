const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const apiRoot = path.join(root, 'app', 'api');
const benign = new Set(['chat/directMarkRead.json','chat/markRead.json','chat/updateAvailability.json','notifications/markRead.json','notifications/markAllRead.json']);
const guard = '{"name":"requireTenantLifecycleWrite","module":"tenantLifecycle","action":"requireWrite","options":{"tenantId":"{{$_SESSION.TENANT_ID.default(0)}}","userId":"{{$_SESSION.USER_ID.default(0)}}","requireMembership":true},"output":false}';

function walk(directory) { return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):entry.name.endsWith('.json')?[path.join(directory,entry.name)]:[]); }
function flatten(value,out=[]){if(!value||typeof value!=='object')return out;if(Array.isArray(value))value.forEach(x=>flatten(x,out));else{if(value.module||value.action)out.push(value);Object.values(value).forEach(x=>flatten(x,out));}return out;}
function matching(text,start,open,close){let depth=0,string=false,escape=false;for(let i=start;i<text.length;i++){const ch=text[i];if(string){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch==='"')string=false;continue;}if(ch==='"'){string=true;continue;}if(ch===open)depth++;else if(ch===close&&--depth===0)return i;}throw new Error('Unmatched JSON container.');}
function insertGuard(text){const exec=text.indexOf('"exec"');if(exec<0)return text;const steps=text.indexOf('"steps"',exec);if(steps<0)return text;const colon=text.indexOf(':',steps),start=text.slice(colon+1).search(/\S/)+colon+1;if(text[start]==='[')return text.slice(0,start+1)+guard+','+text.slice(start+1);if(text[start]==='{'){const end=matching(text,start,'{','}');return text.slice(0,start)+'['+guard+','+text.slice(start,end+1)+']'+text.slice(end+1);}throw new Error('Unsupported exec.steps shape.');}

let changed=0,skipped=0;
for(const file of walk(apiRoot)){
  const relative=path.relative(apiRoot,file).replaceAll('\\','/');
  let text=fs.readFileSync(file,'utf8'),json;try{json=JSON.parse(text.replace(/^\uFEFF/,''));}catch{continue;}
  const method=String(json.settings?.options?.method||'get').toLowerCase(),steps=flatten(json.exec),mutation=/\b(INSERT\s+INTO|UPDATE\s+[`A-Za-z]|DELETE\s+FROM|TRUNCATE\s+TABLE|REPLACE\s+INTO)\b/i.test(text)||steps.some(step=>/^(insert|update|delete|upload|move|remove|send|transaction)$/i.test(String(step.action||'')));
  const mutating=method!=='get'||mutation;
  const platform=relative.startsWith('platform/'),security=relative.startsWith('login/')||relative.startsWith('security/')||relative==='platform/login.json'||relative==='platform/logout.json',system=relative.includes('/webhook/')||relative.includes('callback');
  if(!mutating||platform||security||system||benign.has(relative)||relative==='scenario/continue.json'){skipped++;continue;}
  if(text.includes('"module":"tenantLifecycle"')||text.includes('"module": "tenantLifecycle"')){skipped++;continue;}
  const updated=insertGuard(text);if(updated!==text){fs.writeFileSync(file,updated);changed++;}
}
console.log(JSON.stringify({changed,skipped},null,2));
