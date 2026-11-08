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
globalThis.setInterval=()=>1; globalThis.clearInterval=()=>{}; globalThis.setTimeout=()=>1; globalThis.clearTimeout=()=>{};
globalThis.fetch=()=>({then(){return {then(){return {catch(){}}}}}});
const src=readFile(root+'exam.js')+'\n'+readFile(root+'game.js')+';globalThis.__t={set(d,e){data=d;exam=e},start}; globalThis.__x={evalExpr,reachable,sameNumbers};';
(0,eval)(src);
__t.set(JSON.parse(readFile(root+'data/game.json')),JSON.parse(readFile(root+'data/exam.json')));__t.start();
const out=[];
const btn=(label)=>find(app,n=>n.tag==='button'&&text(n).includes(label))[0];
const [BY,BM,BD]='@BIRTH@'.split('-').map(Number);
const ys=find(app,n=>n.attrs.id==='by')[0], ms=find(app,n=>n.attrs.id==='bm')[0], ds=find(app,n=>n.attrs.id==='bd')[0];
ys.value=String(BY); ys.ls.change(); ms.value=String(BM); ms.ls.change(); ds.value=String(BD);
find(app,n=>n.tag==='form')[0].ls.submit({preventDefault(){}});
out.push('HUB: '+text(app).slice(0,60));

const ev=(x)=>{const r=__x.evalExpr(x);return r?(r.value[1]===1?r.value[0]:r.value[0]+'/'+r.value[1])+' [用到 '+r.used.join(',')+']':'不合法'};
out.push('算式 (3+4)×2-1 = '+ev('(3+4)×2-1'));
out.push('算式 8÷(3-8÷3) = '+ev('8÷(3-8÷3)'));
out.push('算式 3+ = '+ev('3+')+' ; 3++4 = '+ev('3++4')+' ; 3a = '+ev('3a')+' ; 1/0 = '+ev('1/0'));
const rs=[...__x.reachable([3,4,2,1])]; out.push('3,4,2,1 可湊出的 1–100 整數數量: '+rs.length+' (含13? '+rs.includes(13)+')');
// 進入數學 B 卷
const takes=find(app,n=>n.tag==='button'&&text(n)==='應考'); takes[1].ls.click();
out.push('INTRO: '+text(app).replace(/\s+/g,' ').slice(0,60)+' ... 按鈕: '+find(app,n=>n.tag==='button').map(text).join(' | '));
btn('B 卷').ls.click();
out.push('B卷畫面: '+text(app).replace(/\s+/g,' ').slice(0,140));
const inp=find(app,n=>n.tag==='input')[0]; inp.value='1+2'; inp.ls.input&&inp.ls.input();
btn('送出').ls.click(); btn('送出').ls.click();
btn('交卷').ls.click(); btn('再按一次').ls.click();
out.push('回考場: '+text(find(app,n=>n.cls==='card examcol')[1]).replace(/\s+/g,' '));
btn('查看考試結果').ls.click(); out.push('B卷結果: '+text(app).replace(/\s+/g,' ').slice(0,230)); btn('回考場').ls.click();
// 自然:養貓(假 canvas)
find(app,n=>n.tag==='button'&&text(n)==='應考')[1].ls.click(); out.push('自然簡介: '+text(app).replace(/\s+/g,' ').slice(0,100)); btn('開始作答').ls.click();
out.push('養貓畫面: '+text(app).replace(/\s+/g,' ').slice(0,60)); btn('交卷').ls.click(); btn('再按一次').ls.click();
btn('查看考試結果') ; out.push('HUB: '+text(find(app,n=>n.cls==='examgrid')[0]).replace(/\s+/g,' ').slice(0,160));
out.join('\n');
