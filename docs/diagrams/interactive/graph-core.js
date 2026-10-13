/* Pure graph operations shared by the viewer and offline tests. */
(function (root) {
  'use strict';
  function normalize(data) {
    return {kind: data.diagram_type, nodes: data.components || data.nodes || data.participants || [], edges: data.connections || data.edges || data.messages || [], scenes: data.scenes || []};
  }
  function validate(graph) {
    const ids = new Set(), edgeIds = new Set();
    for (const n of graph.nodes) { if (!n.id || ids.has(n.id)) throw Error('节点编号重复或为空'); ids.add(n.id); }
    for (const e of graph.edges) {
      if (!e.id || edgeIds.has(e.id) || !ids.has(e.from) || !ids.has(e.to)) throw Error('连线编号或端点无效');
      edgeIds.add(e.id);
    }
    const scenes = new Set();
    for (const scene of graph.scenes) {
      if (!scene.id || scenes.has(scene.id) || !scene.edges.length || scene.edges.some(id => !edgeIds.has(id))) throw Error('演示场景无效');
      scenes.add(scene.id);
      const edges = scene.edges.map(id => graph.edges.find(e => e.id === id));
      if (graph.kind === 'sequence') {
        if (edges.some((e,i) => i > 0 && e.y < edges[i-1].y)) throw Error('时序消息顺序无效');
      } else if (edges.some((e,i) => i > 0 && e.from !== edges[i-1].to)) throw Error('演示路径不连续');
    }
    return graph;
  }
  function route(graph, source, target) {
    if (graph.kind === 'sequence') throw Error('时序图请按消息顺序演示');
    if (![source,target].every(id => graph.nodes.some(n => n.id === id))) return null;
    const queue=[{node:source,nodes:[source],edges:[]}], seen=new Set([source]);
    while (queue.length) {
      const current=queue.shift();
      if (current.node===target) return {nodes:current.nodes,edges:current.edges};
      for (const edge of graph.edges.filter(e => e.from===current.node)) {
        if (seen.has(edge.to)) continue;
        seen.add(edge.to); queue.push({node:edge.to,nodes:[...current.nodes,edge.to],edges:[...current.edges,edge.id]});
      }
    }
    return null;
  }
  function reach(graph, origin, direction) {
    if (graph.kind === 'sequence') throw Error('时序图请按消息顺序演示');
    if (!['upstream','downstream'].includes(direction) || !graph.nodes.some(n => n.id===origin)) throw Error('关系查询无效');
    const queue=[origin], nodes=new Set([origin]), edges=new Set();
    while (queue.length) {
      const id=queue.shift();
      for (const edge of graph.edges) {
        if ((direction==='downstream'?edge.from:edge.to)!==id) continue;
        const next=direction==='downstream'?edge.to:edge.from;
        edges.add(edge.id);
        if (!nodes.has(next)) {nodes.add(next);queue.push(next);}
      }
    }
    return {nodes:[...nodes],edges:[...edges]};
  }
  function search(graph, term) {
    const q=term.trim().toLocaleLowerCase();
    return graph.nodes.filter(n => [n.id,n.label,n.sublabel||''].some(t => t.toLocaleLowerCase().includes(q)));
  }
  const api={normalize,validate,route,reach,search};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  else root.DiagramGraph=api;
})(typeof globalThis!=='undefined'?globalThis:this);
