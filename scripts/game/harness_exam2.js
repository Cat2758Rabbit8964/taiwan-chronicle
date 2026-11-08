// 考試流程測試:用假 DOM 與假計時器,跳過三科、應考社會科、成績單、進入故事。
ObjC.import('Foundation');
function readFile(p){return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p,$.NSUTF8StringEncoding,null));}
const root='/Users/c_a_t/claude_projects/taiwan-chronicle/';
function mk(tag){const n={tag,attrs:{},kids:[],cls:'',ls:{},nodeType:1,style:{},disabled:false,value:'',
  setAttribute(k,v){this.attrs[k]=v}, addEventListener(t,f){this.ls[t]=f}, append(...c){this.kids.push(...c)},
  prepend(...c){this.kids.unshift(...c)}, replaceChildren(...c){this.kids=c}, focus(){}, getContext(){return new Proxy({}, {get:()=>()=>{}, set:()=>true});}};
  Object.defineProperty(n,'className',{get(){return this.cls},set(v){this.cls=v}});
  Object.defineProperty(n,'textContent',{get(){return text(this)},set(v){this.kids=[String(v)]}});return n;}
function text(n){if(typeof n==='string')return n;return (n.kids||[]).map(text).join(' ');}
function find(n,pred,out=[]){if(typeof n==='string')return out;if(pred(n))out.push(n);(n.kids||[]).forEach(k=>find(k,pred,out));return out;}
const app=mk('main');
globalThis.document={getElementById:()=>app,createElement:mk,createTextNode:t=>String(t),addEventListener(){},removeEventListener(){}};
globalThis.window={scrollTo(){}};
globalThis.setInterval=()=>1; globalThis.clearInterval=()=>{}; globalThis.setTimeout=(f)=>{f();return 1};
globalThis.fetch=()=>({then(){return {then(){return {catch(){}}}}}});
const src=readFile(root+'exam.js')+'\n'+readFile(root+'game.js')+';globalThis.__t={set(d,e){data=d;exam=e},start};';
(0,eval)(src);
__t.set(JSON.parse(readFile(root+'data/game.json')),JSON.parse(readFile(root+'data/exam.json')));__t.start();
const out=[];
const btn=(label)=>find(app,n=>n.tag==='button'&&text(n).includes(label))[0];
const [BY,BM,BD]='@BIRTH@'.split('-').map(Number);
const ys=find(app,n=>n.attrs.id==='by')[0], ms=find(app,n=>n.attrs.id==='bm')[0], ds=find(app,n=>n.attrs.id==='bd')[0];
ys.value=String(BY); ys.ls.change(); ms.value=String(BM); ms.ls.change(); ds.value=String(BD);
find(app,n=>n.tag==='form')[0].ls.submit({preventDefault(){}});
out.push('HUB: '+text(app).slice(0,60));

const takes=()=>find(app,n=>n.tag==='button'&&text(n)==='應考'||text(n)==='補考'&&n.tag==='button');
// 語文:直接交卷(0 題答對)
find(app,n=>n.tag==='button'&&text(n)==='應考')[0].ls.click(); btn('開始作答').ls.click();
out.push('語文畫面: '+text(app).replace(/\s+/g,' ').slice(0,80));
btn('交卷').ls.click(); out.push('語文結果: '+text(app).replace(/\s+/g,' ').slice(0,60)); btn('確定交卷').ls.click();
// 數學:猜 1234 後交卷
find(app,n=>n.tag==='button'&&text(n)==='應考')[0].ls.click(); btn('開始作答').ls.click();
const inp=find(app,n=>n.tag==='input')[0]; inp.value='1234'; btn('猜').ls.click();
out.push('數學紀錄: '+find(app,n=>n.tag==='li').map(text).join(','));
btn('交卷').ls.click(); out.push('數學結果: '+text(app).replace(/\s+/g,' ').slice(0,80)); btn('補考').ls.click(); out.push('補考重新開始: '+text(app).slice(0,30)); btn('交卷').ls.click(); btn('確定交卷').ls.click();
// 自然:直接交卷
find(app,n=>n.tag==='button'&&text(n)==='應考')[0].ls.click(); btn('開始作答').ls.click();
btn('交卷').ls.click(); out.push('自然結果: '+text(app).replace(/\s+/g,' ').slice(0,80)); btn('確定交卷').ls.click();
out.push('HUB: '+text(app).replace(/\s+/g,' ').slice(0,200));
out.join('\n');
