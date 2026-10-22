"""Acervo assistido: descoberta pública, aprovação e edição local de clipes.
Sem extração de DRM/CAPTCHA, downloads automáticos de vídeos sem licença, ou seleção
baseada apenas na data do upload como se fosse data de transmissão na TV.
"""
import json, os, re, shutil, subprocess, threading, hashlib, urllib.parse, urllib.request
from pathlib import Path

_LOCK=threading.Lock()
RESULTS={}
MAX_RESULTS=15
TYPES={'vinhetas','promos','chamadas','anuncios','especiais'}
MAX_FILE=220*1024*1024

def _json(url,timeout=6):
    req=urllib.request.Request(url,headers={'User-Agent':'CN-Timeline/1.0 (personal media curator)'})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw=resp.read(500000)
    return json.loads(raw)

def _slug(v):
    from unicodedata import normalize, combining
    v=''.join(c for c in normalize('NFD',str(v)) if not combining(c))
    return re.sub(r'[^a-z0-9]+','_',v.lower()).strip('_')[:70] or 'clipe'

def _license_ok(url):
    value=(url or '').lower()
    # Aprovação humana continua obrigatória: metadados de terceiros não provam titularidade.
    return any(x in value for x in ('creativecommons.org/licenses/by/', 'creativecommons.org/publicdomain/zero/', 'creativecommons.org/publicdomain/mark/'))

def search(year,kind,term,api_key=None):
    if int(year) not in range(2015,2022) or kind not in TYPES:raise ValueError('Ano ou categoria inválidos')
    term=str(term or '').strip()[:90]
    category_terms={
      'vinhetas':['bumper','bumpers','ident','idents','vinheta','vinhetas','cn id'],
      'promos':['promo','promos','promotional','new episodes','novos episodios'],
      'chamadas':['promo','promoção','vem ai','coming up','next up','chamada'],
      'anuncios':['commercial','commercials','advertisement','advertising','anuncio','anuncios'],
      'especiais':['special','marathon','maratona','halloween','christmas','natal']}
    query=('Cartoon Network Brasil '+str(year)+' '+kind+' '+term+' '+' '.join(category_terms[kind])).strip()
    # Fonte de descoberta pública sem API key; NUNCA classifica por data de upload.
    archive='https://archive.org/advancedsearch.php?'+urllib.parse.urlencode({
        'q':'(title:(cartoon network) OR description:(cartoon network) OR title:(cnbrarchive) OR description:(cnbrarchive)) AND mediatype:movies',
        'fl[]':['identifier','title','year','licenseurl','description'], 'rows':500,'page':1,'output':'json'},doseq=True)
    found=[]
    try:
        info=_json(archive)
        for doc in info.get('response',{}).get('docs',[]):
            label=str(doc.get('title',''))
            id=str(doc.get('identifier',''))
            if not re.fullmatch(r'[A-Za-z0-9._-]{1,130}',id):continue
            haystack=(label+' '+str(doc.get('description',''))).lower()
            terms=[x for x in _slug(term).split('_') if len(x)>2]
            normalized=_slug(haystack)
            brand_match=any(x in normalized for x in ('cartoon_network','cn_brasil','cnbrarchive','cartoon_brasil'))
            if not brand_match:continue
            category_match=any(_slug(t) in normalized for t in category_terms[kind])
            if not category_match and kind not in ('chamadas','promos'):continue
            if terms and not any(t in normalized for t in terms):continue
            licenseurl=str(doc.get('licenseurl') or '')
            archive_year=str(doc.get('year') or '')
            year_match=str(year) in (archive_year+' '+haystack)
            item={'id':id,'title':label,'url':'https://archive.org/details/'+id,
                  'license':licenseurl,'mayImport':_license_ok(licenseurl),
                  'yearRequested':int(year),'kind':kind,
                  'historicalStatus':'PENDENTE — '+('referência menciona o ano escolhido, mas veiculação precisa ser confirmada' if year_match else 'ano de veiculação ainda não confirmado'),
                  'source':'Internet Archive'}
            found.append(item)
            if len(found)>=MAX_RESULTS*3:break
    except Exception as e:
        # A API alternativa (se configurada) ainda pode responder.
        archive_error=f'Internet Archive indisponível: {type(e).__name__}'
    # Referências editoriais verificadas por título e data de publicação.
    # Não garantem a data de veiculação, não concedem autorização de download.
    EDITORIAL={
      2017:[
        ('vinhetas','Cartoon Network Brasil: BUMPERS — Site CN OUT/2017',
          'https://www.youtube.com/watch?v=cf7DrNuNejU','Arquivo publicado em 19/12/2017; material do site, veiculação na TV não confirmada'),
        ('vinhetas','Pacote gráfico Dimensional (identidade iniciada em 2017 no Brasil)',
          'https://www.youtube.com/watch?v=Vb58T6Uhnto','Compilação publicada em 2018; contém trechos de 2018, NÃO importar indiscriminadamente em 2017'),
        ('promos','Outro Ano no Cartoon — DEZ/2017',
          'https://www.youtube.com/watch?v=4pC3vzbcWk4','Arquivado em 04/12/2017; verificar o trecho e a exibição antes de classificar')
      ],
      2018:[('vinhetas','Pacote gráfico Dimensional — peças de fevereiro a outubro de 2018',
        'https://www.youtube.com/watch?v=Vb58T6Uhnto','Compilação publicada em 23/10/2018; cortes precisam de confirmação individual')],
      2019:[('promos','Cartoon Network Brasil: Novos Episódios FEV/2019',
        'https://www.youtube.com/watch?v=haPBVnlUw_c','Arquivo publicado em 27/02/2019; verificar a veiculação original')],
      2020:[('promos','Toonami Powered by Crunchyroll AGO/2020',
        'https://www.youtube.com/watch?v=_2x3Z9ONneg','Arquivo publicado em 24/08/2020; conteúdo ligado à programação da época')],
      2021:[('chamadas','Vem aí — Toontubers no Ctrl (Dimensional)',
        'https://www.youtube.com/watch?v=NxEMTxKK60Y','Registro de identidade Dimensional com referência a 2021; data exata de veiculação não confirmada')]
    }
    needles=[x for x in _slug(term).split('_') if len(x)>=3] if term else []
    for category,title,url,note in EDITORIAL.get(int(year),[]):
        if len(found)>=MAX_RESULTS:break
        if category!=kind:continue
        if needles and not any(n in _slug(title+' '+note) for n in needles):continue
        if any(x.get('url')==url for x in found):continue
        item={'id':'curated:'+hashlib.sha256(url.encode()).hexdigest()[:14],
          'title':title,'url':url,'license':'Titularidade reservada; referência para consulta, não download',
          'mayImport':False,'yearRequested':int(year),'kind':kind,
          'historicalStatus':note,'source':'Referência histórica editorial'}
        found.append(item)
    if api_key and len(found)<MAX_RESULTS:
        try:
            url='https://www.googleapis.com/youtube/v3/search?'+urllib.parse.urlencode({
                'part':'snippet','type':'video','maxResults':MAX_RESULTS-len(found),
                'videoLicense':'creativeCommon','q':query,'key':api_key})
            payload=_json(url)
            for row in payload.get('items',[]):
                video_id=str(row.get('id',{}).get('videoId',''))
                if not re.fullmatch(r'[a-zA-Z0-9_-]{11}',video_id):continue
                found.append({'id':'youtube:'+video_id,
                    'title':row.get('snippet',{}).get('title','Vídeo de referência'),
                    'url':'https://www.youtube.com/watch?v='+video_id,
                    'license':'YouTube: licença da busca indicada como Creative Commons; conferir titularidade',
                    'mayImport':False,'yearRequested':int(year),'kind':kind,
                    'historicalStatus':'PENDENTE — somente descoberta, download não autorizado pelo projeto',
                    'source':'YouTube Data API'})
                if len(found)>=MAX_RESULTS:break
        except Exception:pass
    with _LOCK:
        for x in found:RESULTS[x['id']]=(x)
        # Limitar o cache de sessões anteriores
        while len(RESULTS)>100:RESULTS.pop(next(iter(RESULTS)))
    # Ordena títulos que mencionam o ano e termos da categoria primeiro.
    def score(item):
        text=_slug(item['title']+' '+item.get('historicalStatus',''))
        return (2 if str(year) in text else 0)+sum(1 for t in category_terms[kind] if _slug(t) in text)
    found.sort(key=score,reverse=True)
    found=found[:MAX_RESULTS]
    return {'items':found,'limit':MAX_RESULTS,'query':query,'error':archive_error if not found and 'archive_error' in locals() else None,
            'discoveryLinks':['https://archive.org/search?query='+urllib.parse.quote(query),
                              'https://www.youtube.com/results?search_query='+urllib.parse.quote(query),
                              'https://www.google.com/search?q='+urllib.parse.quote(query+' vinhetas bumpers arquivo')],
            'warning':'Revisar licença, material de origem e ano de transmissão antes de importar.'}

def list_compilations(media):
    root=(media/'pendentes'/'compilacoes').resolve()
    root.mkdir(parents=True,exist_ok=True)
    return [{'file':p.name,'sizeMB':round(p.stat().st_size/1048576,1)} for p in sorted(root.iterdir())
            if p.is_file() and p.suffix.lower() in {'.mp4','.webm','.mov','.mkv'}][:100]

def _destination(media,kind,year,title):
    if kind not in TYPES or int(year) not in range(2015,2022):raise ValueError('Categoria/ano inválido')
    folder=media/kind/str(year); folder.mkdir(parents=True,exist_ok=True)
    stem=_slug(title)
    for index in range(1,999):
        dest=folder/(f'{stem}_{index:02d}.mp4')
        if not dest.exists():return dest
    raise ValueError('Muitos clipes com o mesmo nome')

def trim_local(media,data):
    if not data.get('rightsConfirmed'):raise ValueError('Confirme os direitos de uso do arquivo')
    name=str(data.get('file',''))
    if Path(name).name!=name:raise ValueError('Nome de arquivo inválido')
    origin=(media/'pendentes'/'compilacoes'/name).resolve()
    root=(media/'pendentes'/'compilacoes').resolve()
    if origin.parent!=root or not origin.is_file():raise ValueError('Compilação não encontrada em media/pendentes/compilacoes')
    start=float(data.get('start',0));end=float(data.get('end',0))
    if not(0<=start<end<=200000 and end-start<=600):raise ValueError('Trecho inválido; máximo 10 minutos')
    ffmpeg=shutil.which('ffmpeg')
    if not ffmpeg:raise ValueError('FFmpeg não instalado ou não encontrado no PATH')
    dest=_destination(media,data.get('kind'),data.get('year'),data.get('title','vinheta'))
    temp=dest.with_suffix('.partial.mp4')
    try:
        subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-ss',str(start),'-i',str(origin),
                        '-t',str(end-start),'-map','0:v:0','-map','0:a?','-c:v','libx264','-crf','21',
                        '-preset','veryfast','-c:a','aac','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-movflags','+faststart','-y',str(temp)],
                       check=True,timeout=150)
        temp.replace(dest)
    finally:
        temp.unlink(missing_ok=True)
    return {'ok':True,'file':str(dest.relative_to(media)).replace('\\','/')}

def import_archive(media,data):
    if not data.get('rightsConfirmed') or not data.get('historicalVerified'):
        raise ValueError('Confirme os direitos de reutilização e a época real de transmissão')
    ident=str(data.get('identifier',''))
    with _LOCK: approved=RESULTS.get(ident)
    if not approved or not approved['mayImport']:raise ValueError('Candidato não autorizado para importação')
    meta=_json('https://archive.org/metadata/'+urllib.parse.quote(ident))
    licenseurl=str(meta.get('metadata',{}).get('licenseurl') or '')
    if not _license_ok(licenseurl):raise ValueError('Licença permissiva não confirmada na origem')
    files=meta.get('files',[])
    video=next((x for x in files if x.get('name','').lower().endswith(('.mp4','.webm')) and
                str(x.get('size','0')).isdigit() and 0<int(x['size'])<=MAX_FILE and
                '/' not in x['name'] and '\\' not in x['name']),None)
    if not video:raise ValueError('Sem vídeo compatível e dentro do limite de tamanho')
    # O vídeo é recebido em quarentena para triagem, nunca vai direto ao canal.
    temp_dir=media/'pendentes'/'compilacoes';temp_dir.mkdir(parents=True,exist_ok=True)
    path=temp_dir/(hashlib.sha256(ident.encode()).hexdigest()[:14]+'.mp4')
    url='https://archive.org/download/'+urllib.parse.quote(ident)+'/'+urllib.parse.quote(video['name'])
    req=urllib.request.Request(url,headers={'User-Agent':'CN-Timeline/1.01'})
    partial=path.with_suffix('.download')
    total=0
    try:
        with urllib.request.urlopen(req,timeout=25) as response,partial.open('wb') as fp:
            while True:
                chunk=response.read(256*1024)
                if not chunk:break
                total+=len(chunk)
                if total>MAX_FILE:raise ValueError('Arquivo ultrapassou o limite')
                fp.write(chunk)
        partial.replace(path)
    finally:partial.unlink(missing_ok=True)
    return {'ok':True,'file':path.name,'status':'QUARENTENA: selecione o trecho e confirme a categoria antes de usar na programação'}

def suggest_scene_cuts(media,filename):
    """Sugere NO MÁXIMO 5 trechos, por cortes visuais. NÃO confirma período histórico."""
    name=str(filename or '')
    if Path(name).name!=name:raise ValueError('Nome inválido')
    src=(media/'pendentes'/'compilacoes'/name).resolve()
    if src.parent!=(media/'pendentes'/'compilacoes').resolve() or not src.is_file():raise ValueError('Vídeo não encontrado')
    ffmpeg=shutil.which('ffmpeg')
    if not ffmpeg:raise ValueError('FFmpeg não instalado')
    # Examina só primeiros 15 minutos, em baixa resolução e amostragem esparsa.
    out=subprocess.run([ffmpeg,'-hide_banner','-nostdin','-loglevel','info','-t','900','-i',str(src),
        '-an','-vf',"scale=320:-2,fps=2,select='gt(scene,0.52)',showinfo",'-f','null','-'],
        stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True,timeout=75)
    points=[0.0]
    for val in re.findall(r'pts_time:([0-9.]+)',out.stderr):
        t=float(val)
        if t-points[-1]>=7:points.append(t)
        if len(points)>50:break
    spans=[]
    for i in range(len(points)-1):
        a,b=points[i],points[i+1]
        if 7<=b-a<=150:spans.append({'start':round(a,2),'end':round(b,2)})
        if len(spans)>=5:break
    return {'items':spans,'note':'Sugestões visuais não identificam automaticamente a era, o desenho nem a licença. Revise cada corte.'}
