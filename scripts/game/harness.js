// 用假 DOM 在 JXA(osascript -l JavaScript)裡跑 game.js,模擬一局。
// 用法:sed -e "s/@BIRTH@/1992-11-28/" -e "s/@PICKS@/0,1,2/" harness.js > /tmp/h.js && osascript -l JavaScript /tmp/h.js
ObjC.import('Foundation');
function readFile(p){return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p,$.NSUTF8StringEncoding,null));}
const root='/Users/c_a_t/claude_projects/taiwan-chronicle/';
const data=readFile(root+'data/game.json');
function mk(tag){const n={tag,attrs:{},kids:[],cls:'',ls:{},nodeType:1,
  setAttribute(k,v){this.attrs[k]=v}, addEventListener(t,f){this.ls[t]=f}, append(...c){this.kids.push(...c)},
  replaceChildren(...c){this.kids=c}};
  Object.defineProperty(n,'className',{get(){return this.cls},set(v){this.cls=v}});return n;}
function text(n){if(typeof n==='string')return n;return (n.kids||[]).map(text).join(' ');}
function find(n,pred,out=[]){if(typeof n==='string')return out;if(pred(n))out.push(n);(n.kids||[]).forEach(k=>find(k,pred,out));return out;}
const app=mk('main');
globalThis.document={getElementById:()=>app,createElement:mk,createTextNode:t=>String(t)};
globalThis.window={scrollTo(){}};
globalThis.fetch=()=>({then(){return {then(){return {catch(){}}}}}});
(0,eval)(readFile(root+'game.js')+';globalThis.__t={set(d){data=d},start};');
__t.set(JSON.parse(data));__t.start();
const out=[];
const BIRTH='@BIRTH@', PICKS=[@PICKS@];
const [BY,BM,BD]=BIRTH.split('-').map(Number);
const ys=find(app,n=>n.attrs.id==='by')[0], ms=find(app,n=>n.attrs.id==='bm')[0], ds=find(app,n=>n.attrs.id==='bd')[0];
ys.value=String(BY); ys.ls.change(); ms.value=String(BM); ms.ls.change(); ds.value=String(BD);
find(app,n=>n.tag==='form')[0].ls.submit({preventDefault(){}});
let i=0, guard=0;
while(!/^你回到/.test(text(app)) && guard<40){
  guard++;
  const o=find(app,n=>n.cls==='opt');
  if(o.length){
    const sc=find(app,n=>n.cls==='scene')[0];
    out.push('Q: '+text(find(app,n=>n.tag==='h2')[0])+(sc?' | '+text(sc).slice(0,36):''));
    out.push('   '+o.map(x=>text(x).slice(0,16)).join(' / '));
    const pk=PICKS[i]; o[Math.min(pk===undefined?0:pk,o.length-1)].ls.click(); i++;
  } else {
    const bt=find(app,n=>n.tag==='button'&&n.cls==='btn')[0];
    if(!bt){out.push('MSG: '+text(app).slice(0,120));break;}
    out.push('  ~~ '+text(find(app,n=>n.cls==='scene')[0]||'').slice(0,110));
    bt.ls.click();
  }
}
out.push('RESULT: '+text(app).replace(/\s+/g,' ').slice(0,2400));
out.join('\n');
