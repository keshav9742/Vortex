/* TRACE background: pointer-reactive particles, links and navy scanner glow. */
(() => {
  const GLOW = true;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.add('trace-background-active');
  let canvas = document.getElementById('trace-bg');
  if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'trace-bg'; document.body.prepend(canvas); }
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none';
  const ctx = canvas.getContext('2d');
  const glow = GLOW ? document.createElement('div') : null;
  if (glow) { glow.style.cssText = 'position:fixed;left:-200px;top:-200px;width:400px;height:400px;border-radius:50%;pointer-events:none;z-index:1;background:radial-gradient(circle,rgba(39,91,170,.22),transparent 62%)'; document.body.prepend(glow); }
  let w=0,h=0,mouseX=-999,mouseY=-999,scroll=0,raf=0,hidden=false;
  let particles=[];
  function resize(){ w=canvas.width=innerWidth; h=canvas.height=innerHeight; particles=Array.from({length:Math.min(150,Math.floor(w*h/9000))},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.28,vy:(Math.random()-.5)*.28})); }
  function pointer(e){ mouseX=e.clientX; mouseY=e.clientY; if(glow) glow.style.transform=`translate(${mouseX}px,${mouseY}px)`; }
  function frame(){
    ctx.clearRect(0,0,w,h); const hue=205+scroll*35;
    for(const p of particles){ p.x+=p.vx; p.y+=p.vy; if(p.x<0||p.x>w)p.vx*=-1; if(p.y<0||p.y>h)p.vy*=-1; const dx=p.x-mouseX,dy=p.y-mouseY,d=Math.hypot(dx,dy); if(d<150&&d>0){p.x+=dx/d*1.1;p.y+=dy/d*1.1;ctx.strokeStyle=`rgba(36,78,145,${(1-d/150)*.5})`;ctx.beginPath();ctx.moveTo(mouseX,mouseY);ctx.lineTo(p.x,p.y);ctx.stroke()} ctx.fillStyle=`hsla(${hue},78%,72%,.75)`;ctx.fillRect(p.x,p.y,2,2)}
    for(let i=0;i<particles.length;i++)for(let j=i+1;j<particles.length;j++){const a=particles[i],b=particles[j],d=Math.hypot(a.x-b.x,a.y-b.y);if(d<120){ctx.strokeStyle=`hsla(${hue},78%,70%,${(1-d/120)*.23})`;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}}
  }
  function loop(){if(hidden)return;frame();raf=requestAnimationFrame(loop)}
  addEventListener('resize',resize);addEventListener('pointermove',pointer,{passive:true});addEventListener('scroll',()=>{scroll=scrollY/((document.documentElement.scrollHeight-innerHeight)||1)},{passive:true});
  document.addEventListener('visibilitychange',()=>{hidden=document.hidden;if(!hidden&&!REDUCED)loop()});resize();if(REDUCED)frame();else loop();
})();
