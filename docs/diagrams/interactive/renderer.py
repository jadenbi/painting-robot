"""Project-specific SVG layout renderer. No Archify template dependency."""
from html import escape

defs = '<defs>' + ''.join(
    '<marker id="arrowhead' + suffix + '" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" class="m' + suffix + '"/></marker>'
    for suffix in ('', '-emphasis', '-dashed', '-security')
) + '</defs>'

class SVG:
    def __init__(self,w,h):
        self.w,self.h=w,h
        self.background=[]; self.arrows=[]; self.boxes=[]; self.labels=[]
    def text(self,x,y,text,cls='t-muted',size=12,anchor='start',target=None,weight=None):
        weight_attr=f' font-weight="{weight}"' if weight else ''
        item=f'<text x="{x}" y="{y}" class="{cls}" font-size="{size}" text-anchor="{anchor}"{weight_attr}>{escape(text)}</text>'
        (target if target is not None else self.labels).append(item)
    def rect(self,x,y,w,h,cls='c-external',target=None,rx=8):
        (target if target is not None else self.boxes).append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" class="{cls}" stroke-width="1.5"/>')
    def node(self,id,type,label,sub,x,y,w=200,h=76,tag=None):
        self.boxes.append(f'<g data-node="{escape(id)}" tabindex="0" role="button" aria-label="{escape(label)}">')
        self.rect(x,y,w,h,'c-mask');self.rect(x,y,w,h,'c-'+type)
        self.text(x+w/2,y+28,label,'t-primary',15,'middle',self.boxes,600)
        self.text(x+w/2,y+49,sub,'t-muted',11,'middle',self.boxes)
        if tag:self.text(x+w/2,y+67,tag,'t-'+type,10,'middle',self.boxes)
        self.boxes.append('</g>')
    def arrow(self,id,points,label=None,variant='default',at=None):
        suffix='' if variant=='default' or variant=='return' else '-'+variant
        path='M'+' L'.join(f'{x},{y}' for x,y in points)
        self.arrows.append(f'<g data-edge="{escape(id)}" tabindex="0" role="button" aria-label="{escape(label or id)}"><path d="{path}" class="a{suffix or "-default"}" stroke-width="1.7" fill="none" marker-end="url(#arrowhead{suffix})"/>')
        if label:
            self.text(*at,label,'t-muted',12,'middle',self.arrows)
        self.arrows.append('</g>')
    def legend(self,y):
        self.text(30,y,'图例','t-primary',12,weight=600)
        for x,type,label in [(95,'frontend','交互入口'),(245,'backend','本地计算'),(395,'cloud','API'),(545,'messagebus','通信与队列'),(745,'external','实际执行')]:
            self.rect(x,y-11,18,12,'c-'+type)
            self.text(x+26,y,label,size=11)
    def finish(self):
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" role="img">'+defs+'\n'+'\n'.join(self.background+self.arrows+self.boxes+self.labels)+'</svg>'

def architecture(data):
    s=SVG(1000,830)
    nodes={n['id']:n for n in data['components']}
    for e in data['connections']:
        a,b=nodes[e['from']],nodes[e['to']]
        ax,ay=a['pos']; aw,ah=a['size']; bx,by=b['pos']; bw,bh=b['size']
        if e['id']=='free-edit-call':
            points=[(ax+aw/2,ay),(ax+aw/2,95),(bx,95)]; at=(620,84)
        elif e['id']=='skill-call':
            points=[(ax+aw/2,ay),(bx+bw/2,by+bh)];at=(893,190)
        elif ax==bx:
            points=[(ax+aw/2,ay+ah),(bx+bw/2,by)];at=(ax+aw/2+60,(ay+ah+by)/2)
        elif ay==by and ax<bx:
            points=[(ax+aw,ay+ah/2),(bx,by+bh/2)];at=((ax+aw+bx)/2,ay+ah/2-10)
        else:
            points=[(ax,ay+ah/2),(bx+bw,by+bh/2)];at=((ax+bx+bw)/2,ay+ah/2-10)
        s.arrow(e['id'],points,e.get('label'),e.get('variant','default'),at)
    for n in data['components']:s.node(n['id'],n['type'],n['label'],n['sublabel'],*n['pos'],*n['size'],n.get('tag'))
    s.legend(790)
    return s.finish()

def workflow(data):
    s=SVG(1170,890)
    lanes={lane['id']:i for i,lane in enumerate(data['lanes'])}
    nodes={}
    for lane in data['lanes']:
        y=25+lanes[lane['id']]*158
        s.rect(20,y,1130,128,'c-region',s.background,rx=12)
        # Wrap the lane title for the sidebar.
        label=lane['label'];parts={'图片准备与确认':['图片准备','与确认'],'可选 skill':['可选 skill'],'路径拟合与编辑':['路径拟合','与编辑'],'计划与 ABB 执行':['计划与','ABB 执行']}.get(label,[label])
        for i,line in enumerate(parts):s.text(35,y+48+i*22,line,'t-primary',13,target=s.background,weight=600)
    for n in data['nodes']:
        x=145+n['col']*200;y=50+lanes[n['lane']]*158
        nodes[n['id']]={**n,'pos':(x,y),'size':(150,76)}
    for e in data['edges']:
        a,b=nodes[e['from']],nodes[e['to']]
        ax,ay=a['pos'];bx,by=b['pos'];aw,bw=150,150; ah,bh=76,76
        if e['id']=='skill-disabled':
            points=[(ax+75,ay+76),(ax+75,by+38),(bx,by+38)]; at=(ax+115,by+25)
        elif ax==bx:
            points=[(ax+75,ay+76),(bx+75,by)];at=(ax+120,(ay+76+by)/2)
        elif ay==by and ax<bx:
            points=[(ax+150,ay+38),(bx,by+38)];at=((ax+150+bx)/2,ay+26)
        elif ay==by:
            points=[(ax,ay+38),(bx+150,by+38)];at=((ax+bx+150)/2,ay+26)
        else:
            raise ValueError('Unplanned workflow edge '+e['id'])
        s.arrow(e['id'],points,e.get('label'),e.get('variant','default'),at)
    for n in nodes.values():s.node(n['id'],n['type'],n['label'],n['sublabel'],*n['pos'],150,76)
    s.legend(858)
    return s.finish()

def sequence(data):
    s=SVG(1280,980)
    centers={'pc':220,'network':640,'motion':1060}
    for segment in data['segments']:
        s.rect(35,segment['from']-5,1210,segment['to']-segment['from']+10,'c-region',s.background,12)
        s.text(52,segment['from']+6,segment['label'],'t-primary',13,target=s.background,weight=600)
    for p in data['participants']:
        x=centers[p['id']]
        intervals=[(110,150)]+[(segment['from']+25,segment['to']) for segment in data['segments']]
        lines=' '.join(f'M{x},{start} L{x},{end}' for start,end in intervals)
        s.background.append(f'<path d="{lines}" class="a-default" stroke-width="1" stroke-dasharray="6 6" fill="none"/>')
    for p in data['participants']:
        s.node(p['id'],p['type'],p['label'],p['sublabel'],centers[p['id']]-120,32,240,76)
    for m in data['messages']:
        y=m['y']+15 if m['id'] in {'small-upload','large-upload'} else m['y']
        s.arrow(m['id'],[(centers[m['from']],y),(centers[m['to']],y)],m['label'],m.get('variant','default'),((centers[m['from']]+centers[m['to']])/2,y-12))
    s.text(45,944,'包 ACK / MSG_LAST ≠ 物理运动完成；确认失败时停止续发。','t-primary',13,weight=600)
    return s.finish()

