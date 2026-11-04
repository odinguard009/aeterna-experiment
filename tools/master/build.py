import json,re,os,glob,sys,collections,unicodedata,gzip,hashlib
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..'); sys.path.insert(0,os.path.join(R,'tools'))
import fetch_fandom_std as F
from textclean import clean_effect
CACHE=os.path.join(R,'data/master/cache')
def gz(fn):
    return gzip.open(os.path.join(CACHE,fn),'rt',encoding='utf-8')
def norm(i): return re.sub(r'\s+','',i).upper()
def setof(i):
    m=re.match(r'^(.*?)-',i); return m.group(1) if m else i
# ---- repo
repo={}
for tag,d in (('stg','data/import'),('lib','data/cards')):
    for f in sorted(glob.glob(R+'/'+d+'/saga-*.json')):
        if f.endswith('manual.json'): continue
        j=json.load(open(f,encoding='utf-8')); j=j if isinstance(j,list) else j.get('cards',[])
        for c in j:
            k=norm(c['id']); e=repo.setdefault(k,{'id':c['id'],'lib':None,'stg':None}); e[tag]=c
# ---- official
off={}
for fn in ('official-off_detail.jsonl.gz','official-off_detail2.jsonl.gz','official-off_detail3.jsonl.gz'):
    for l in gz(fn):
        r=json.loads(l)
        for c in r['cards']:
            k=norm(c['no'])
            off.setdefault(k,[]).append({'key':r['key'],**c})
TYPE={'スピリット':'Spirit','アルティメット':'Ultimate','ブレイブ':'Brave','ネクサス':'Nexus','マジック':'Magic','コア':'Core','ソウルコア':'Soul Core'}
COL={'赤':'red','紫':'purple','緑':'green','白':'white','黄':'yellow','青':'blue','神':'god','金':'gold','無':'none'}
def offrec(vs):
    # primary = variant whose card_no2 == card_no (or first)
    p=next((v for v in vs if v['key'][0]==v['key'][1]),vs[0])
    f=p['f']; cats=f.get('カテゴリー','')
    colors=re.findall('|'.join(COL),f.get('属性','')) if isinstance(f.get('属性'),str) else []
    cost=re.search(r'\d+',str(f.get('コスト','')) )
    red=f.get('軽減コスト') if isinstance(f.get('軽減コスト'),list) else []
    bp=[x for x in f.get('BP/コア',[])] if isinstance(f.get('BP/コア'),list) else []
    return {'name_jp':p['name'],'rarity':p['rarity'],'type_jp':cats,'type':TYPE.get(cats,cats),'color':[COL[c] for c in colors],
      'cost':int(cost.group()) if cost else None,'reduction_jp':red,'family_jp':f.get('系統'),'bp_core':bp,'text_jp':f.get('能力・効果',''),
      'block_icon':f.get('ブロックアイコン'),'collab_icon':f.get('作品アイコン'),'products':sorted({x for v in vs for x in v['prods']}),
      'image':p['img'],'variants':[{'card_no2':v['key'][1],'image':v['img'],'rarity':v['rarity'],'name_jp':v['name']} for v in vs if v is not p]}
# ---- fandom
rows=json.load(gz('fandom-rows.json.gz')); fcards=json.load(gz('fandom-pages.json.gz'))   # {title: [final title, infobox fields]}
fd={}
for r in rows: fd.setdefault(r['id'],[]).append(r)
def fdpage(title):
    v=fcards.get(title)
    if not v or not v[1]: return None
    f=v[1]
    if not f: return {'title':title,'final':v[0],'infobox':False}
    sets=[]
    for k in sorted(k for k in f if re.match(r'^set\d+$',k)):
        n=k[3:]; sets.append({'set':f[k],'rarity':f.get('rarity'+n),'block':f.get('block'+n)})
    return {'title':title,'final':v[0],'infobox':True,'name':F.card_name(v[0]),'name_jp':F.strip_links(re.sub(r'\{\{\s*ruby\s*\|([^{}|]*)\|[^{}]*\}\}',r'\1',f.get('jpname','') or f.get('kanji',''),flags=re.I)).strip(),
      'type':F.strip_links(f.get('type','')).strip(),'color':F.strip_links(f.get('color','')).strip(),'cost':f.get('cost'),
      'family':[F.strip_links(f[k]).strip() for k in sorted(k for k in f if re.match(r'^family\d*$',k))],
      'keyword':F.strip_links(f.get('keyword','')).strip(),'effect_en':clean_effect(f.get('effect')),
      'effect_jp':F.clean_text(f.get('jpeffect')),'sets':sets,
      'levels':F.levels(f.get('level')),'reduction':F.icons(f.get('reductions') or f.get('reduction')),'symbols':F.icons(f.get('symbols') or f.get('symbol'),ex=True)}
fdp={t:fdpage(t) for t in fcards}
ids=set(repo)|set(off)|set(fd)
print('ids',len(ids),'repo',len(repo),'off',len(off),'fd',len(fd),file=sys.stderr)
master={}
for k in sorted(ids):
    m={'number':k,'sources':{'aeterna_library':bool(repo.get(k,{}).get('lib')),'aeterna_staging':bool(repo.get(k,{}).get('stg')),'fandom':k in fd,'official':k in off}}
    rp=(repo.get(k,{}).get('lib') or repo.get(k,{}).get('stg'))
    if rp: m['aeterna']={x:rp.get(x) for x in ('id','name','name_jp','type','color','cost','reduction','symbols','families','levels','text','rarity','saga','block','fxComplete') if x in rp}
    if k in off: m['official']=offrec(off[k])
    if k in fd:
        m['fandom']={'rows':[{x:r[x] for x in ('set','side','title','color','type','rarity')} for r in fd[k]]}
        pg=[fdp.get(r['title']) for r in fd[k]]; m['fandom']['pages']=[p for p in pg if p]
    master[k]=m

# ================= stage 2: classify =================
m=master
def nt(s): return re.sub(r'\s+','',unicodedata.normalize('NFKC',s or ''))
BASE={'スピリット':'Spirit','アルティメット':'Ultimate','ブレイヴ':'Brave','ブレイブ':'Brave','ネクサス':'Nexus','マジック':'Magic'}
def tmap(t):
    contract=t.startswith('契約'); token=t.startswith('トークン')
    b=t.replace('契約','').replace('トークン','')
    return BASE.get(b,b),contract,token
def setof(n): 
    x=re.match(r'^([A-Z0-9]+?)-',n); return x.group(1) if x else n
def order(n):
    s=setof(n); mm=re.match(r'^(26R)?([A-Z]+?)(\d+)$',s)
    pre=mm.group(2) if mm else s; num=int(mm.group(3)) if mm else 0
    rank={'BS':0,'SD':1,'26RBS':0,'26RSD':1,'BSC':2,'CB':3,'PB':4}.get(('26R' if mm and mm.group(1) else '')+pre,5)
    return (1 if mm and mm.group(1) else 0, rank, num, n)
def kindof(n):
    r=n.split('-',1)[1] if '-' in n else n
    if re.match(r'^X',r) or re.match(r'^TX',r): return 'X'
    if re.match(r'^RV|^RX',r) or 'RV' in r: return 'Revival'
    if re.match(r'^CP|^CX',r): return 'Collab promo'
    if re.match(r'^XX',r): return 'XX'
    if re.match(r'^TCP',r): return 'Rebirth promo'
    return 'normal'
def rar(r): return unicodedata.normalize('NFKC',r or '')
out={}
for k,v in m.items():
    o=v.get('official') if isinstance(v.get('official'),dict) else None
    a=v.get('aeterna'); fp=(v.get('fandom') or {}).get('pages') or []
    fp=[p for p in fp if p.get('infobox')]
    r={'number':k,'id':(a or {}).get('id') or k}
    srcs=[s for s,b in (('aeterna_library',v['sources']['aeterna_library']),('aeterna_staging',v['sources']['aeterna_staging']),('fandom',v['sources']['fandom']),('official',v['sources']['official'])) if b]
    r['sources']=srcs
    r['library_status']='in_library' if v['sources']['aeterna_library'] else ('staging_only' if v['sources']['aeterna_staging'] else 'missing')
    r['set']=setof(k); r['kind']=kindof(k)
    if o:
        typ,contract,token=tmap(o['type_jp'])
        r.update(type=typ,contract=contract,token=token,color=o['color'],cost=o['cost'],rarity=rar(o['rarity']),name_jp=o['name_jp'],text_jp=o['text_jp'],
          family_jp=o['family_jp'],levels=[{'cores':int(re.sub(r'\D','',x[1]) or 0),'bp':int(re.sub(r'\D','',x[0]) or 0) if re.search(r'\d',x[0]) else None} for x in o['bp_core'] if len(x)>1 and (re.search(r'\d',x[0]) or re.search(r'\d',x[1]))],
          reduction_colors=o['reduction_jp'],products=o['products'],image=o['image'],art_variants=o['variants'],block_icon=o['block_icon'],collab_icon=o['collab_icon'])
    elif fp:
        p=fp[0]; mc=re.search(r'\d+',p.get('cost') or ''); r.update(cost=int(mc.group()) if mc else None,levels=[{'cores':l['cores'],'bp':l.get('bp')} for l in p.get('levels',[])],fandom_reduction=p.get('reduction') or {},fandom_symbols=p.get('symbols') or {},type=p['type'],color=[x.strip().lower() for x in re.split(r'[/,]',p['color']) if x.strip()],name_jp=p['name_jp'],text_jp=p['effect_jp'],rarity=(p['sets'][0]['rarity'] if p['sets'] else None),contract=False,token=False,note='official page not found; Fandom data only')
    elif a:
        r.update(type=a.get('type'),color=[a['color']] if a.get('color') else [],name_jp=a.get('name_jp'),text_jp='',cost=a.get('cost'),rarity=a.get('rarity'),contract=False,token=False,note='Aeterna data only (not on official list)')
    r['name_en']=(a or {}).get('name') or (fp[0]['name'] if fp else None)
    r['text_en']=(a or {}).get('text') or (fp[0]['effect_en'] if fp else None)
    r['families_en']=(a or {}).get('families') or (fp[0]['family'] if fp else None)
    if fp: r['fandom_title']=fp[0]['title']; r['fandom_sets']=[s['set'] for s in fp[0]['sets']]
    if a: r['aeterna']={x:a.get(x) for x in ('saga','block','fxComplete') if x in a}
    # conflicts
    cf=[]
    if a and o:
        if nt(a.get('name_jp'))!=nt(o['name_jp']): cf.append('name_jp: aeterna=%s official=%s'%(a.get('name_jp'),o['name_jp']))
        if a.get('type')!=r['type']: cf.append('type: aeterna=%s official=%s'%(a.get('type'),r['type']))
        if a.get('cost')!=o['cost']: cf.append('cost: aeterna=%s official=%s'%(a.get('cost'),o['cost']))
    if o and fp and nt(fp[0]['name_jp'])!=nt(o['name_jp']): cf.append('name_jp: fandom=%s official=%s'%(fp[0]['name_jp'],o['name_jp']))
    if cf: r['conflicts']=cf
    r['group_key']=('stub-'+k) if (not r.get('name_jp') and not r.get('type')) else hashlib.sha1(json.dumps([nt(r.get('name_jp')),nt(r.get('text_jp')),r.get('type'),r.get('cost'),sorted(r.get('color') or []),[(l.get('bp')) for l in r.get('levels',[])]],ensure_ascii=False).encode()).hexdigest()[:12]
    out[k]=r
groups=collections.defaultdict(list)
for k,r in out.items(): groups[r['group_key']].append(k)
for g,mem in groups.items():
    mem.sort(key=lambda n:(0 if out[n]['library_status']=='in_library' else 1,)+order(n)) if False else mem.sort(key=order)
    head=mem[0]
    for n in mem:
        r=out[n]; r['group_id']='G'+g; r['canonical_number']=head; r['group_size']=len(mem)
        if r['group_key'].startswith('stub-'): r['class']='stub'
        elif r.get('token'): r['class']='token'
        elif len(mem)==1 or n==head: r['class']='standalone'
        elif r['set']==out[head]['set']: r['class']='alt_art'
        else: r['class']='reprint'
# same name, different card
byname=collections.defaultdict(set)
for k,r in out.items():
    if r.get('name_jp'): byname[nt(r['name_jp'])].add(r['group_id'])
for k,r in out.items():
    n=len(byname.get(nt(r.get('name_jp')),()))
    if n>1: r['same_name_distinct_cards']=n
OUTP=os.path.join(R,'data/master/cards.json.gz')
json.dump(out,gzip.open(OUTP,'wt',encoding='utf-8',compresslevel=9),ensure_ascii=False,separators=(',',':'))
c=collections.Counter(r['class'] for r in out.values());print(c)
print('groups',len(groups),'with same-name-distinct',sum(1 for r in out.values() if 'same_name_distinct_cards' in r))
miss=[r for r in out.values() if r['library_status']=='missing']
print('missing',len(miss),collections.Counter(r['class'] for r in miss))
print('conflicts',sum(1 for r in out.values() if 'conflicts' in r))
print(collections.Counter(r['library_status'] for r in out.values()))
