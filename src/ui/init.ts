import { soundSettings } from '../sound-settings';

document.body.classList.add('hud-game-style','hud-playful');
const menu=document.getElementById('menu')!;
const menuStage=document.createElement('div');menuStage.className='ui-stage';
menuStage.append(...Array.from(menu.childNodes));menu.append(menuStage);
// Keep messages in the same coordinate system as the cargo note at every aspect ratio.
document.getElementById('ui-instruments')!.append(document.getElementById('chat')!);
const resize=()=>document.documentElement.style.setProperty('--ui-scale',String(Math.min(innerWidth/1600,innerHeight/900)));
resize();window.addEventListener('resize',resize);

soundSettings.watch(settings=>{
 for(const prefix of ['vol','set'])for(const kind of ['sfx','music'] as const){
  const output=document.querySelector<HTMLOutputElement>(`output[for="${prefix}-${kind}"]`);
  if(output)output.value=Math.round(settings[kind]*100)+'%';
 }
});

// Rings end at the holes in each moving surface; the return half stays behind the cover.
const pause=document.getElementById('pause')!;
let ringFrame=0;
function drawRings(){
 const board=pause.querySelector<HTMLElement>('.pause-board')!;
 const bounds=board.getBoundingClientRect(),scale=bounds.width/1160;
 if(!scale)return;
 for(const row of ['top','bottom']){
  const hole=(side:string)=>{const r=pause.querySelector(`[data-hole="${side}-${row}"]`)!.getBoundingClientRect();return{x:(r.left+r.width/2-bounds.left)/scale,y:(r.top+r.height/2-bounds.top)/scale};};
  const a=hole('left'),b=hole('right'),span=Math.max(0,b.x-a.x),rise=Math.min(31,span*.36);
  const group=pause.querySelector<SVGGElement>(`[data-ring="${row}"]`)!;
  group.style.opacity=String(Math.min(1,Math.max(0,(span-4)/12)));
  group.querySelectorAll('path').forEach(path=>path.setAttribute('d',`M${a.x} ${a.y} C${a.x} ${a.y-rise} ${b.x} ${b.y-rise} ${b.x} ${b.y}`));
 }
}
new MutationObserver(()=>{
 cancelAnimationFrame(ringFrame);
 if(pause.hidden)return;
 const start=performance.now();
 const tick=()=>{drawRings();if(!pause.hidden&&performance.now()-start<850)ringFrame=requestAnimationFrame(tick);};tick();
}).observe(pause,{attributes:true,attributeFilter:['hidden']});
window.addEventListener('resize',()=>{if(!pause.hidden)drawRings();});
const tabs=[...pause.querySelectorAll<HTMLElement>('.pause-tabs button')];
tabs.forEach((tab,i)=>tab.addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 event.preventDefault();event.stopPropagation();
 const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 tabs[next].click();
}));
pause.addEventListener('keydown',event=>{
 if(event.key!=='Tab')return;
 const visible=[...pause.querySelectorAll<HTMLElement>('button,input')].filter(e=>e.offsetParent!==null&&!e.closest('[inert]')&&e.tabIndex>=0);
 const first=visible[0],last=visible.at(-1);
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
});
