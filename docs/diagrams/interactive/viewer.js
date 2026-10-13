/* Project-specific interaction layer inspired by Archify 3.x viewer concepts.
   No official Archify runtime is copied or required. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id), core=globalThis.DiagramGraph;
  const data=JSON.parse($('diagram-data').textContent), graph=core.validate(core.normalize(data));
  const svg=$('viewport').querySelector('svg');
  const base=svg.getAttribute('viewBox').split(/\s+/).map(Number);
  const nodeElements=new Map([...svg.querySelectorAll('[data-node]')].map(el=>[el.dataset.node,el]));
  const edgeElements=new Map([...svg.querySelectorAll('[data-edge]')].map(el=>[el.dataset.edge,el]));
  let focused=null, currentScene=graph.scenes[0], index=-1, playing=null, camera=[...base];
  const sequence=graph.kind==='sequence';
  const status=text=>{$('status').textContent=text;};
  function stop() {if(playing!==null) clearInterval(playing);playing=null;$('play').textContent='播放';$('play').setAttribute('aria-pressed','false');}
  function clearHighlights() {
    for(const el of [...nodeElements.values(),...edgeElements.values()]) el.classList.remove('dim','match','selected');
  }
  function highlight(nodes,edges) {
    const ns=new Set(nodes), es=new Set(edges);
    for(const [id,el] of nodeElements) {el.classList.toggle('dim',!ns.has(id));el.classList.toggle('match',ns.has(id));el.classList.remove('selected');}
    for(const [id,el] of edgeElements) {el.classList.toggle('dim',!es.has(id));el.classList.toggle('match',es.has(id));el.classList.remove('selected');}
  }
  function relations(node) {
    const incoming=graph.edges.filter(e=>e.to===node), outgoing=graph.edges.filter(e=>e.from===node);
    const names=new Map(graph.nodes.map(n=>[n.id,n.label]));
    const container=$('relation-detail');container.replaceChildren();
    for(const [title,items,other] of [['进入关系',incoming,'from'],['离开关系',outgoing,'to']]) {
      const heading=document.createElement('h3');heading.textContent=title;container.append(heading);
      const list=document.createElement('ul');list.className='relation-list';
      for(const edge of items) {const li=document.createElement('li');li.textContent=names.get(edge[other])+(edge.label?' · '+edge.label:'');list.append(li);}
      if(!items.length){const li=document.createElement('li');li.textContent='图中未定义';list.append(li);}
      container.append(list);
    }
  }
  function focus(id) {
    const node=graph.nodes.find(n=>n.id===id);if(!node)return;
    stop();clearHighlights();focused=id;nodeElements.get(id).classList.add('selected');
    $('detail-title').textContent=node.label;$('detail-description').textContent=node.sublabel||'';$('detail-id').textContent=node.id;
    $('upstream').disabled=sequence;$('downstream').disabled=sequence;relations(id);
    status('已选中模块');
  }
  function focusEdge(id) {
    const edge=graph.edges.find(e=>e.id===id);if(!edge)return;
    stop();highlight([edge.from,edge.to],[id]);focused=null;edgeElements.get(id).classList.add('selected');
    $('detail-title').textContent=edge.label||'模块连接';
    $('detail-description').textContent=graph.nodes.find(n=>n.id===edge.from).label+' → '+graph.nodes.find(n=>n.id===edge.to).label;
    $('detail-id').textContent=id;$('relation-detail').replaceChildren();$('upstream').disabled=true;$('downstream').disabled=true;
    status(sequence?'这是消息关系，请结合所选分支的时间顺序查看。':'这是源码中定义的有向关系。');
  }
  function traceReach(direction) {
    if(!focused)return null;
    const found=core.reach(graph,focused,direction);highlight(found.nodes,found.edges);nodeElements.get(focused).classList.add('selected');
    status((direction==='upstream'?'上游':'下游')+'：'+(found.nodes.length-1)+' 个关联模块；表示已定义关系。');return found;
  }
  function traceRoute(from,to) {
    stop();focused=null;$('upstream').disabled=true;$('downstream').disabled=true;
    const found=core.route(graph,from,to);
    if(!found){clearHighlights();status('两点之间没有已定义的有向路径。');return null;}
    highlight(found.nodes,found.edges);$('detail-title').textContent='有向路径';$('detail-description').textContent=found.nodes.map(id=>graph.nodes.find(n=>n.id===id).label).join(' → ');
    $('detail-id').textContent='';$('relation-detail').replaceChildren();status(found.edges.length+' 条连接；按连接数选取一条最短路径，非机器人运动规划。');return found;
  }
  function sceneEdges(){return currentScene.edges.map(id=>graph.edges.find(e=>e.id===id));}
  function updateStepControls() {
    $('previous').disabled=index<=0;$('next').disabled=index>=currentScene.edges.length-1;
    $('scene-label').textContent=index<0?'共 '+currentScene.edges.length+' 步':(index+1)+' / '+currentScene.edges.length;
  }
  function setScene(id) {
    const scene=graph.scenes.find(s=>s.id===id);if(!scene)return;
    stop();currentScene=scene;$('scene').value=id;index=-1;focused=null;
    const edges=sceneEdges();highlight(edges.flatMap(e=>[e.from,e.to]),scene.edges);
    $('detail-title').textContent=scene.label;$('detail-description').textContent='点击下一步或播放，按该分支的顺序讲解。';$('detail-id').textContent='';$('relation-detail').replaceChildren();
    $('upstream').disabled=true;$('downstream').disabled=true;updateStepControls();status('已显示所选分支，其他内容保留为背景。');
  }
  function step(delta=1) {
    index=Math.max(0,Math.min(currentScene.edges.length-1,index+delta));
    const edge=sceneEdges()[index];highlight([edge.from,edge.to],[edge.id]);
    $('detail-title').textContent=edge.label||'步骤 '+(index+1);$('detail-description').textContent=graph.nodes.find(n=>n.id===edge.from).label+' → '+graph.nodes.find(n=>n.id===edge.to).label;
    $('detail-id').textContent=edge.id;focused=null;$('upstream').disabled=true;$('downstream').disabled=true;$('relation-detail').replaceChildren();updateStepControls();
    status(currentScene.label+' · 第 '+(index+1)+' 步');if(index===currentScene.edges.length-1)stop();return edge.id;
  }
  function play() {
    if(playing!==null){stop();return;}
    if(index===currentScene.edges.length-1)index=-1;
    step(1);
    if(index<currentScene.edges.length-1){playing=setInterval(()=>step(1),1800);$('play').textContent='暂停';$('play').setAttribute('aria-pressed','true');}
  }
  function reset() {
    stop();focused=null;index=-1;clearHighlights();$('detail-title').textContent='探索工程图';$('detail-description').textContent='选择模块查看连接；演示工具按预设分支逐步讲解。高亮表示文档中的关系，不表示机器人实时状态。';$('detail-id').textContent='';$('relation-detail').replaceChildren();
    $('upstream').disabled=true;$('downstream').disabled=true;updateStepControls();status('已恢复完整图。');
  }
  function applyCamera() {svg.setAttribute('viewBox',camera.join(' '));$('zoom-label').textContent=Math.round(base[2]/camera[2]*100)+'%';}
  function zoom(factor) {
    const scale=Math.min(4,Math.max(.5,base[2]/camera[2]*factor)), w=base[2]/scale,h=base[3]/scale;
    camera=[camera[0]+(camera[2]-w)/2,camera[1]+(camera[3]-h)/2,w,h];applyCamera();
  }
  function fit(){camera=[...base];applyCamera();}
  function exportSVGText() {
    const clone=svg.cloneNode(true);clone.setAttribute('viewBox',base.join(' '));clone.setAttribute('width',base[2]);clone.setAttribute('height',base[3]);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    for(const el of clone.querySelectorAll('.dim,.match,.selected')) el.classList.remove('dim','match','selected');
    for(const el of clone.querySelectorAll('[tabindex]')) {el.removeAttribute('tabindex');el.removeAttribute('role');}
    const computed=getComputedStyle(document.documentElement), variables=[...document.querySelector('style').textContent.matchAll(/(--[\w-]+):/g)].map(m=>m[1]);
    clone.setAttribute('style',[...new Set(variables)].map(key=>key+':'+computed.getPropertyValue(key)).join(';'));
    const style=document.createElementNS('http://www.w3.org/2000/svg','style');
    const css=document.querySelector('style').textContent;style.textContent=css.slice(css.indexOf('.c-mask'),css.indexOf('[data-node],[data-edge]'));
    clone.insertBefore(style,clone.firstChild);
    const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');bg.setAttribute('width','100%');bg.setAttribute('height','100%');bg.setAttribute('fill',computed.getPropertyValue('--panel'));clone.insertBefore(bg,style.nextSibling);
    return new XMLSerializer().serializeToString(clone);
  }
  function download(blob,extension) {
    const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=data.meta.output.replace(/\.html$/,'.'+extension);document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportSVG(){stop();download(new Blob([exportSVGText()],{type:'image/svg+xml;charset=utf-8'}),'svg');status('已导出完整 SVG。');}
  async function exportPNG() {
    stop();$('export-png').disabled=true;
    const url=URL.createObjectURL(new Blob([exportSVGText()],{type:'image/svg+xml;charset=utf-8'}));
    try {
      const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('SVG 图形无法加载'));img.src=url;});
      const canvas=document.createElement('canvas');canvas.width=base[2]*2;canvas.height=base[3]*2;const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法创建图片画布');ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('无法编码 PNG')),'image/png'));download(blob,'png');status('已导出完整 PNG，2 倍分辨率。');
    } catch(err){status('导出失败：'+err.message);} finally{URL.revokeObjectURL(url);$('export-png').disabled=false;}
  }
  for(const [id,el] of nodeElements){el.addEventListener('click',()=>focus(id));el.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();focus(id);}});}
  for(const [id,el] of edgeElements){el.addEventListener('click',()=>focusEdge(id));el.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();focusEdge(id);}});}
  function finder(){const results=$('results');results.replaceChildren();for(const node of core.search(graph,$('finder').value)){const button=document.createElement('button');button.textContent=node.label;button.addEventListener('click',()=>focus(node.id));results.append(button);}}
  $('finder').addEventListener('input',finder);finder();
  for(const id of ['route-from','route-to'])for(const node of graph.nodes){const option=document.createElement('option');option.value=node.id;option.textContent=node.label;$(id).append(option);}
  $('route-from').value=graph.nodes[0].id;$('route-to').value=graph.nodes[graph.nodes.length-1].id;
  $('route-controls').hidden=sequence;$('reach-controls').hidden=sequence;$('sequence-note').hidden=!sequence;
  $('upstream').addEventListener('click',()=>traceReach('upstream'));$('downstream').addEventListener('click',()=>traceReach('downstream'));
  $('route').addEventListener('click',()=>traceRoute($('route-from').value,$('route-to').value));
  $('scene').addEventListener('change',()=>setScene($('scene').value));$('previous').addEventListener('click',()=>{stop();step(-1);});$('next').addEventListener('click',()=>{stop();step(1);});$('play').addEventListener('click',play);
  $('zoom-in').addEventListener('click',()=>zoom(1.25));$('zoom-out').addEventListener('click',()=>zoom(.8));$('fit').addEventListener('click',fit);$('reset').addEventListener('click',()=>{reset();fit();});
  $('theme').addEventListener('click',()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';$('theme').textContent=dark?'浅色':'深色';$('theme').setAttribute('aria-pressed',String(dark));});
  $('stage').addEventListener('click',()=>{const active=document.body.classList.toggle('stage');$('stage').textContent=active?'退出演示':'演示模式';$('stage').setAttribute('aria-pressed',String(active));});
  $('export-svg').addEventListener('click',exportSVG);$('export-png').addEventListener('click',exportPNG);
  let drag=null;
  $('viewport').addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('[data-node],[data-edge]'))return;drag={x:e.clientX,y:e.clientY,camera:[...camera]};$('viewport').setPointerCapture(e.pointerId);});
  $('viewport').addEventListener('pointermove',e=>{if(!drag)return;const rect=svg.getBoundingClientRect(), units=Math.max(drag.camera[2]/rect.width,drag.camera[3]/rect.height);camera=[drag.camera[0]-(e.clientX-drag.x)*units,drag.camera[1]-(e.clientY-drag.y)*units,...drag.camera.slice(2)];applyCamera();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])$('viewport').addEventListener(event,()=>{drag=null;});
  $('viewport').addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();zoom(e.deltaY<0?1.15:1/1.15);},{passive:false});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('beforeprint',()=>{stop();reset();fit();});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){document.body.classList.remove('stage');$('stage').textContent='演示模式';$('stage').setAttribute('aria-pressed','false');reset();fit();return;}
    if(e.target.closest('input,select,textarea'))return;
    if(e.key==='ArrowRight'){e.preventDefault();stop();step(1);}else if(e.key==='ArrowLeft'){e.preventDefault();stop();step(-1);}else if(e.key.toLowerCase()==='f')$('stage').click();
  });
  reset();
  globalThis.XiaohuaDiagram={focus,traceReach,traceRoute,setScene,step,reset,exportSVGText,fit,zoom};
})();
