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
// 前三科跳過:每次畫面重畫後取第一個「跳過」
for(let k=0;k<3;k++){ btn('跳過').ls.click(); }
out.push('跳過後按鈕狀態: 公布成績單 disabled='+btn('公布成績單')?.disabled+' / 提示='+(btn('才能公布')?'有':'無'));
// 應考社會(第四張卡的「應考」)
const takes=find(app,n=>n.tag==='button'&&text(n)==='應考'); takes[takes.length-1].ls.click();
out.push('INTRO: '+text(app).slice(0,70));
btn('開始作答').ls.click();
for(let g=0;g<3;g++){ const o=find(app,n=>n.cls==='opt'); out.push('社會題 '+(g+1)+': '+text(find(app,n=>n.tag==='h2')[0])+' | 選項數 '+o.length); o[0].ls.click(); }
out.push('FINISH: '+text(app).replace(/\s+/g,' ').slice(0,110));
btn('確定交卷').ls.click();
out.push('HUB2 公布成績單 disabled='+btn('公布成績單').disabled);
btn('公布成績單').ls.click();
out.push('REPORT: '+text(app).replace(/\s+/g,' ').slice(0,260));
btn('帶著成績單出發').ls.click();
out.push('NEXT: '+text(app).replace(/\s+/g,' ').slice(0,120));
out.join('\n');
