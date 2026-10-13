"""Build standalone project diagrams from JSON. Uses Python standard library only."""
from pathlib import Path
from html import escape
import json
import math
import re
import xml.etree.ElementTree as ET
from renderer import architecture, workflow, sequence

ROOT = Path(__file__).resolve().parent
SLUGS = ('architecture','workflow','communication')
STATIC = ROOT.parent.parent/'images' if ROOT.name=='interactive' else ROOT

def normalized(data):
    return {
        'kind': data['diagram_type'],
        'nodes': data.get('components', data.get('nodes', data.get('participants', []))),
        'edges': data.get('connections', data.get('edges', data.get('messages', []))),
        'scenes': data['scenes'],
    }

def validate(data):
    if data.get('format') != 'xiaohua-diagram-v1':
        raise ValueError('Unsupported project diagram format')
    graph = normalized(data)
    nodes = graph['nodes']; edges = graph['edges']
    ids = [n['id'] for n in nodes]; edge_ids = [e['id'] for e in edges]
    if not ids or len(set(ids)) != len(ids) or len(set(edge_ids)) != len(edge_ids):
        raise ValueError('Missing or duplicate diagram IDs')
    for edge in edges:
        if edge['from'] not in ids or edge['to'] not in ids:
            raise ValueError('Invalid edge endpoint: '+edge['id'])
    for node in nodes:
        for coordinate in node.get('pos',[]) + node.get('size',[]):
            if not isinstance(coordinate,(int,float)) or not math.isfinite(coordinate):
                raise ValueError('Invalid geometry: '+node['id'])
    rectangles=[]
    if graph['kind']=='architecture':
        rectangles=[(n['id'],*n['pos'],*n['size']) for n in nodes]
    if graph['kind']=='workflow':
        lanes={n['id']:i for i,n in enumerate(data['lanes'])}
        for node in nodes:
            if node['lane'] not in lanes or node['col'] not in range(5):
                raise ValueError('Invalid workflow placement: '+node['id'])
            rectangles.append((node['id'],145+node['col']*200,50+lanes[node['lane']]*158,150,76))
    for i,(id1,x,y,w,h) in enumerate(rectangles):
        if min(x,y)<0 or min(w,h)<=0: raise ValueError('Invalid node rectangle: '+id1)
        for id2,bx,by,bw,bh in rectangles[i+1:]:
            if x<bx+bw and bx<x+w and y<by+bh and by<y+h:
                raise ValueError('Overlapping nodes: '+id1+' / '+id2)
    by_id={e['id']:e for e in edges}
    for scene in data['scenes']:
        if not scene['edges'] or any(id not in by_id for id in scene['edges']):
            raise ValueError('Invalid scene: '+scene['id'])
        chain=[by_id[id] for id in scene['edges']]
        if graph['kind']=='sequence':
            if any(a['y']>b['y'] for a,b in zip(chain,chain[1:])):raise ValueError('Message order: '+scene['id'])
        elif any(a['to']!=b['from'] for a,b in zip(chain,chain[1:])):
            raise ValueError('Disconnected scene: '+scene['id'])
    return graph

def static_svg(svg, css):
    variables=dict(re.findall(r'(--[\w-]+):([^;}]+)',css.split('[data-theme=dark]')[0]))
    rules=[]
    for selector,decl in re.findall(r'(\.[ctam]-?[a-z-]*)\{([^}]+)\}',css):
        rules.append(selector+'{'+re.sub(r'var\((--[\w-]+)\)',lambda m:variables[m.group(1)],decl)+'}')
    styles="svg text{font-family:'Microsoft YaHei','Noto Sans CJK SC',sans-serif}"+''.join(rules)
    return svg.replace('role="img">','role="img"><style>'+styles+'</style><rect width="100%" height="100%" class="c-mask"/>',1)

def build(slug, data, css, js):
    graph=validate(data)
    svg={'architecture':architecture,'workflow':workflow,'sequence':sequence}[graph['kind']](data)
    tree=ET.fromstring(svg)
    for attr, records in [('data-node',graph['nodes']),('data-edge',graph['edges'])]:
        rendered=[node.get(attr) for node in tree.iter() if node.get(attr)]
        if sorted(rendered)!=sorted(n['id'] for n in records):raise ValueError('SVG/source mismatch: '+attr)
    cards=''.join('<section class="card"><h2>'+escape(c['title'])+'</h2><ul>'+''.join('<li>'+escape(item)+'</li>' for item in c['items'])+'</ul></section>' for c in data['cards'])
    options=''.join('<option value="'+escape(s['id'])+'">'+escape(s['label'])+'</option>' for s in data['scenes'])
    title=escape(data['meta']['title'])
    payload=json.dumps(data,ensure_ascii=False).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
    html=f'''<!doctype html>
<html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><style>{css}</style></head>
<body><header><div class="eyebrow">小画 / INTERACTIVE PROJECT MAP</div><h1>{title}</h1><p>skill / API · 可配置缓冲容量 · 支持节点探索与分步讲解</p></header>
<main class="page"><div class="toolbar" aria-label="图表工具栏">
<label>演示分支 <select id="scene">{options}</select></label><button id="previous" disabled>上一步</button><button id="next" class="primary">下一步</button><button id="play" aria-pressed="false">播放</button><span id="scene-label" aria-live="polite">准备演示</span><span class="spacer"></span>
<button id="zoom-out" aria-label="缩小">−</button><span id="zoom-label">100%</span><button id="zoom-in" aria-label="放大">＋</button><button id="fit">适合窗口</button><button id="reset">完整图</button><button id="theme" aria-pressed="false">深色</button><button id="stage" aria-pressed="false">演示模式</button><button id="export-svg">SVG</button><button id="export-png">PNG</button>
</div><div class="layout"><section class="canvas" aria-label="工程图"><div class="viewport" id="viewport">{svg}</div><div class="canvas-footer">点击节点或连线查看详情 · 拖动空白处移动 · Ctrl + 滚轮缩放 · Esc 返回完整图</div></section>
<aside class="side"><h2 id="detail-title">探索工程图</h2><p id="detail-description">选择模块查看连接；演示工具按预设分支逐步讲解。高亮表示文档中的关系，不表示机器人实时状态。</p><div id="detail-id"></div><div class="actions" id="reach-controls"><button id="upstream" disabled>上游</button><button id="downstream" disabled>下游</button></div><div id="relation-detail"></div>
<h3>查找模块</h3><input id="finder" type="search" placeholder="输入模块名称" aria-label="查找模块"><div id="results" class="results"></div>
<div id="route-controls"><h3>追踪有向路径</h3><select id="route-from" aria-label="路径起点"></select><select id="route-to" aria-label="路径终点"></select><button id="route">追踪路径</button></div><p id="sequence-note" hidden>通信图按消息时间顺序演示；参与者之间的多次往返不用于推断聚合路径。</p><div id="status" role="status" aria-live="polite"></div></aside></div>
<div class="cards">{cards}</div><p class="note">参考 Archify 3.x 的交互设计，本页为项目本地实现。图表由布局 JSON 生成，主题与阅读状态不会改动应用代码；静态导出保留完整图。开源来源及许可见同目录的 THIRD-PARTY-NOTICE.md。</p></main>
<script id="diagram-data" type="application/json">{payload}</script><script>{js}</script></body></html>'''
    (ROOT/f'{slug}.html').write_text(html,encoding='utf-8')
    export=static_svg(svg,css)
    STATIC.mkdir(exist_ok=True)
    (STATIC/f'{slug}.svg').write_text(export,encoding='utf-8')
    return {'diagram':slug,'nodes':len(graph['nodes']),'edges':len(graph['edges']),'scenes':len(graph['scenes']),'geometry':'node overlap and finite geometry checks passed','source_svg_identity':'passed'}

def main():
    css=(ROOT/'viewer.css').read_text(encoding='utf-8')
    js=(ROOT/'graph-core.js').read_text(encoding='utf-8')+'\n'+(ROOT/'viewer.js').read_text(encoding='utf-8')
    records=[]
    for slug in SLUGS:
        records.append(build(slug,json.loads((ROOT/f'{slug}.layout.json').read_text(encoding='utf-8')),css,js))
    (ROOT/'build-report.json').write_text(json.dumps({'implementation':'xiaohua local interactive diagrams','automated_checks':records,'browser_interaction':'not tested; restricted tool environment','archify_official_finalize':'not used'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(records,ensure_ascii=False))

if __name__=='__main__':main()
