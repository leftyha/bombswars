/* anime-lite.js
   Pequeño tweener local estilo anime.js para evitar CDN y mantener el paquete ligero.
   Soporta targets, duration, easing, update, complete y propiedades numéricas.
*/
(function(){
  const easings={
    linear:t=>t,
    easeOutQuad:t=>1-(1-t)*(1-t),
    easeOutCubic:t=>1-Math.pow(1-t,3),
    easeInOutQuad:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2
  };
  window.anime=function(opts){
    const targets=Array.isArray(opts.targets)?opts.targets:[opts.targets||{}];
    const duration=opts.duration||600;
    const easing=easings[opts.easing]||easings.easeOutCubic;
    const start=performance.now();
    const props=Object.keys(opts).filter(k=>!["targets","duration","easing","update","complete"].includes(k));
    const from=targets.map(t=>{
      const o={};
      props.forEach(p=>o[p]=Number(t[p])||0);
      return o;
    });
    let stopped=false;
    function tick(now){
      if(stopped)return;
      const raw=Math.min(1,(now-start)/duration);
      const k=easing(raw);
      targets.forEach((t,i)=>{
        props.forEach(p=>{
          const to=Array.isArray(opts[p])?opts[p][1]:opts[p];
          t[p]=from[i][p]+(Number(to)-from[i][p])*k;
        });
      });
      opts.update&&opts.update({progress:raw*100});
      if(raw<1)requestAnimationFrame(tick);else opts.complete&&opts.complete();
    }
    requestAnimationFrame(tick);
    return {pause(){stopped=true},play(){stopped=false;requestAnimationFrame(tick)}};
  };
})();