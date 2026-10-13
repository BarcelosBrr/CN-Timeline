"""Servidor local read-only do Cartoon Timeline; Python >= 3.10, sem dependências.
Arquivos locais, URLs diretas autorizadas e catálogo opt-in de players em iframe.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit, quote
from concurrent.futures import ThreadPoolExecutor, as_completed
import argparse
import json
import mimetypes
import re
import struct
import unicodedata
import subprocess
import urllib.request
import urllib.error
import threading
import time
import socketserver
import ipaddress
from functools import lru_cache

BASE = Path(__file__).resolve().parent
MEDIA = BASE / 'media'
DATA = BASE / 'data'
PUBLIC = BASE / 'public'
EXT = {'.mp4', '.webm', '.m4v', '.mov', '.ogv'}
REMOTE_EXT = {'.mp4', '.webm', '.m4v', '.ogv'}
TYPES = {
    'episodios': 'episode', 'episodes': 'episode', 'desenhos': 'episode',
    'filmes': 'movie', 'movies': 'movie', 'vinhetas': 'bumper', 'bumpers': 'bumper',
    'anuncios': 'ad', 'propagandas': 'ad', 'ads': 'ad', 'chamadas': 'call', 'chamadas_de_desenhos': 'call', 'promos': 'promo', 'curtas': 'short', 'shorts': 'short',
    'especiais': 'special', 'specials': 'special', 'toontubers': 'short', 'outra_semana': 'short',
}
FALLBACK = {'episode': 11 * 60, 'movie': 90 * 60, 'bumper': 8,
            'ad': 25, 'promo': 20, 'call': 10, 'short': 100, 'special': 22 * 60}
SHOW_ALIASES = {
    'o_incrivel_mundo_de_gumball': 'O Incrível Mundo de Gumball',
    'gumball': 'O Incrível Mundo de Gumball',
    'apenas_um_show': 'Apenas um Show', 'ursos_sem_curso': 'Ursos sem Curso',
    'hora_de_aventura': 'Hora de Aventura', 'irmao_do_jorel': 'Irmão do Jorel',
    'jovens_titas_em_acao': 'Jovens Titãs em Ação',
    'steven_universo': 'Steven Universo', 'ben_10': 'Ben 10',
    'clarencio_o_otimista': 'Clarêncio, o Otimista',
}
BLOCK_ALIASES = {
    'cinecartoon':'cine','cine_cartoon':'cine','herois':'herois',
    'hahaha':'hahaha','votatoon':'votatoon','brazuca':'brazuca',
    'toontubers':'toontubers','outra_semana_no_cartoon':'outra',
    'maratona':'maratona', 'toonami':'toonami','cartoon_zaum':'cartoonzaum'
}

def canon_show(value):
    normalized = unicodedata.normalize('NFKD', str(value).lower())
    normalized = ''.join(c for c in normalized if not unicodedata.combining(c))
    slug = re.sub(r'[^a-z0-9]+', '_', normalized).strip('_')
    return SHOW_ALIASES.get(slug, slug.replace('_',' ').title())


def native_mp4_duration(path):
    """Lê o átomo mvhd do MP4/MOV, sem bibliotecas extras no Windows."""
    try:
        with path.open('rb') as f:
            total = path.stat().st_size
            def scan(end, find_moov=False):
                while f.tell()+8 <= end:
                    begin = f.tell()
                    header = f.read(8)
                    size, name = struct.unpack('>I4s', header)
                    hlen = 8
                    if size == 1:
                        if f.tell()+8 > end: break
                        size = struct.unpack('>Q', f.read(8))[0]; hlen=16
                    elif size == 0:
                        size = end-begin
                    if size < hlen or begin+size > end: break
                    if name == b'moov':
                        result = scan(begin+size)
                        if result: return result
                    if name == b'mvhd':
                        data = f.read(min(size-hlen, 40))
                        if len(data)>=32:
                            if data[0] == 1 and len(data)>=32:
                                scale = struct.unpack_from('>I', data,20)[0]
                                duration = struct.unpack_from('>Q', data,24)[0]
                            elif data[0] == 0 and len(data)>=20:
                                scale = struct.unpack_from('>I',data,12)[0]
                                duration = struct.unpack_from('>I',data,16)[0]
                            else: scale=0;duration=0
                            if scale and 0 < duration/scale <= 30000: return duration/scale
                    f.seek(begin+size)
                return None
            return scan(total)
    except (OSError,ValueError,struct.error,ZeroDivisionError):
        return None



def read_json(filename):
    try:
        result = json.loads((DATA / filename).read_text(encoding='utf-8'))
        return result
    except (OSError, ValueError):
        return {}


@lru_cache(maxsize=10000)
def _duration_cached(filename, mtime_ns, size):
    path = Path(filename)
    try:
        p = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=nokey=1:noprint_wrappers=1', str(path)],
            capture_output=True, text=True, timeout=5)
        duration = float(p.stdout.strip())
        return round(duration, 3) if 0 < duration < 30000 else native_mp4_duration(path) if path.suffix.lower() in ('.mp4','.m4v','.mov') else None
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return native_mp4_duration(path) if path.suffix.lower() in ('.mp4','.m4v','.mov') else None


def duration_of(path):
    info=path.stat()
    return _duration_cached(str(path), info.st_mtime_ns, info.st_size)


def event_in(path):
    if re.search(r'halloween|bruxas|terror', path, re.I):
        return 'halloween'
    if re.search(r'natal|christmas|xmas', path, re.I):
        return 'christmas'
    if re.search(r'pascoa|páscoa|easter', path, re.I):
        return 'easter'
    if re.search(r'ferias|férias|julho|vacation', path, re.I):
        return 'vacation'
    if re.search(r'acao.de.gracas|ação.de.graças|thanksgiving', path, re.I):
        return 'thanksgiving'
    return 'normal'


def infer_file(path, parts, kind):
    """Convenções: tipo/ANO/nome.mp4; episodio/serie/SS_EE_titulo_ANO.mp4."""
    stem = path.stem.lower()
    years = [int(p) for p in parts if re.fullmatch(r'20(?:1[5-9]|2[01])', p)]
    info = {'years':years, 'show':None, 'block':None, 'releasePrecision':None}
    if kind == 'episode':
        showdir = parts[1] if len(parts)>2 else 'serie_desconhecida'
        info['show'] = canon_show(showdir)
        match = re.fullmatch(r'(\d{1,2})_(\d{1,3})_(.+)_(20\d{2})',stem)
        if match:
            season,ep,title,release = match.groups()
            info.update(season=int(season),episode=int(ep), releaseDate=f'{release}-01-01',
                        releasePrecision='year', name=f'{info["show"]} · T{int(season):02d}E{int(ep):02d} · {title.replace("_", " ").title()}')
        else:
            legacy=re.fullmatch(r'[sS](\d+)[eE](\d+)',stem,re.I)
            if legacy:info.update(season=int(legacy.group(1)),episode=int(legacy.group(2)))
    elif kind in ('promo','call'):
        if stem.startswith('vem_ai_quadro_'):
            block_slug=re.sub(r'_\d+$','',stem[len('vem_ai_quadro_'):])
            info.update(block=BLOCK_ALIASES.get(block_slug,block_slug),promoType='chamada_quadro',
                        name='Vem aí · '+block_slug.replace('_',' ').title())
        elif stem.startswith('vem_ai_'):
            name=re.sub(r'_\d+$','',stem[len('vem_ai_'):])
            info.update(show=canon_show(name),promoType='vem_ai')
        elif stem.startswith('promo_'):
            name=re.sub(r'_\d+$','',stem[len('promo_'):])
            info.update(show=canon_show(name),promoType='serie')
    elif kind == 'short':
        block_slug=parts[1].lower() if len(parts)>2 else 'curtas'
        info['block']=BLOCK_ALIASES.get(block_slug, block_slug)
    return info


def make_catalog():
    changes = read_json('catalogo.json')
    if not isinstance(changes, dict): changes = {}
    entries = []
    for path in sorted(MEDIA.rglob('*')):
        if not path.is_file() or path.suffix.lower() not in EXT: continue
        relative = path.relative_to(MEDIA).as_posix()
        parts = path.relative_to(MEDIA).parts
        meta = changes.get(relative, {})
        if not isinstance(meta,dict): meta={}
        kind = next((TYPES[p.lower()] for p in parts if p.lower() in TYPES), 'episode')
        auto = infer_file(path,parts,kind)
        measured = duration_of(path)
        provided = meta.get('duration')
        try: provided=float(provided) if provided is not None else None
        except (ValueError,TypeError): provided=None
        duration=measured or (provided if provided and provided>0 else None)
        # Sem duração comprovável, não se pode encaixar vídeo com segurança.
        known = duration is not None
        info = {
            'id': 'local:' + relative, 'name':path.stem.replace('_',' '),
            'path': '/media/' + quote(relative, safe='/'), 'source': 'local',
            'kind': kind, 'show':None, 'years':[], 'event': event_in(relative),
            'duration':round(duration,3) if duration else 0,
            'durationVerified':bool(measured),'enabled':known and 'pendentes' not in parts,
        }
        info.update({k:v for k,v in auto.items() if v is not None})
        for k in ('name','kind','show','years','event','releaseDate','firstAiredBR',
                  'validFrom','validUntil','era','promoType','block','popularity',
                  'enabled','classification','season','episode','verified','releasePrecision'):
            if k in meta:info[k]=meta[k]
        # Duração medida é preferível à declaração JSON para evitar cortes.
        if not known:info['enabled']=False
        entries.append(info)
    # Somente URLs diretas de mídia, sem extrair player ou retransmitir sites terceiros.
    external = read_json('fontes_externas.json')
    if isinstance(external, dict):
        external = external.get('media', [])
    if isinstance(external, list):
        for index, meta in enumerate(external):
            if not isinstance(meta, dict) or not meta.get('authorized'):
                continue
            url = str(meta.get('url', '')).strip()
            parsed = urlsplit(url)
            if parsed.scheme not in ('http', 'https') or parsed.hostname in ('localhost', '127.0.0.1'):
                continue
            if Path(parsed.path.lower()).suffix not in REMOTE_EXT:
                continue
            try:
                duration = float(meta['duration'])
            except (ValueError, KeyError, TypeError):
                continue
            kind = meta.get('kind', 'episode')
            if kind not in FALLBACK or not 1 <= duration <= 30000:
                continue
            entries.append({
                'id': 'remote:' + str(index), 'source': 'external', 'path': url,
                'name': str(meta.get('name') or f'Vídeo externo {index + 1}'),
                'kind': kind, 'show': meta.get('show'), 'years': meta.get('years', []),
                'event': meta.get('event', 'normal'), 'duration': duration, 'durationVerified':False,
                **{k:meta[k] for k in ('releaseDate','firstAiredBR','validFrom','validUntil','era','promoType','block','popularity','enabled','classification','season','episode','verified') if k in meta},
            })
    # Integração Pomfy opt-in: apenas iframe documentado, SEM buscar streams,
    # inspecionar player de terceiros, fazer proxy ou remover proteções.
    pomfy = read_json('pomfy.json')
    if isinstance(pomfy, dict) and pomfy.get('enabled') is True:
        records = pomfy.get('media', [])
        if isinstance(records, list):
            for index, meta in enumerate(records):
                if not isinstance(meta, dict) or meta.get('authorized') is not True or meta.get('enabled') is False:
                    continue
                kind = meta.get('kind')
                if kind not in ('episode', 'movie'):
                    continue
                # bool não é ID válido (bool é subtipo de int em Python).
                try:
                    tmdb_id = int(str(meta.get('tmdbId', '')))
                    duration = float(meta.get('duration', 0))
                except (TypeError, ValueError, OverflowError):
                    continue
                if tmdb_id <= 0 or not (60 <= duration <= 30000):
                    continue
                show = str(meta.get('show') or '').strip()
                name = str(meta.get('name') or '').strip()
                released = meta.get('firstAiredBR') or meta.get('releaseDate')
                if not name or not released or not re.fullmatch(r'20\d{2}-\d{2}-\d{2}', str(released)):
                    continue
                if kind == 'episode':
                    if not show:
                        continue
                    try:
                        season = int(str(meta.get('season', '')))
                        episode = int(str(meta.get('episode', '')))
                    except (TypeError, ValueError):
                        continue
                    if not (1 <= season <= 999 and 1 <= episode <= 9999):
                        continue
                    path = f'https://api.pomfy.stream/serie/{tmdb_id}/{season}/{episode}'
                else:
                    season = episode = None
                    path = f'https://api.pomfy.stream/filme/{tmdb_id}'
                # Duração manual é apenas ESTIMATIVA para a grade: iframe não
                # oferece seek, ended ou sincronização segundo-a-segundo.
                entry = {
                    'id': f'pomfy:{kind}:{tmdb_id}:{season or 0}:{episode or 0}',
                    'source': 'pomfy', 'embedProvider': 'pomfy', 'path': path,
                    'name': name, 'kind': kind, 'show': show or None,
                    'duration': round(duration, 3), 'durationVerified': False,
                    'durationSource': 'manual', 'seekable': False,
                    'syncMode': 'manual', 'releaseDate': str(released),
                    'years': meta.get('years', []) if isinstance(meta.get('years', []), list) else [],
                    'event': meta.get('event', 'normal'),
                    'tmdbId': tmdb_id,
                }
                for field in ('firstAiredBR', 'validFrom', 'validUntil', 'block',
                              'popularity', 'releasePrecision'):
                    if field in meta:
                        entry[field] = meta[field]
                entries.append(entry)
    # Metadados automáticos via TVmaze: a API de terceiros fornece data original
    # do episódio e número da temporada. NÃO comprova estreia brasileira.
    auto = read_json('pomfy_automatico.json')
    config = read_json('pomfy_series.json')
    if isinstance(config,dict) and config.get('enabled') and isinstance(auto,dict):
        existing={x['id'] for x in entries}
        for x in auto.get('media',[]):
            if isinstance(x,dict) and x.get('embedProvider')=='pomfy' and x.get('path') and x.get('releaseDate') and x.get('id') not in existing:
                entries.append(x)
    # Conteúdos Stremio são metadados agendáveis; o stream só é consultado
    # quando a atração vai ao ar (sem carregar o vídeo em memória/HD).
    config = read_json('stremio.json')
    generated = read_json('stremio_episodios.json')
    if isinstance(config,dict) and config.get('enabled') and isinstance(generated,dict):
        known={x['id'] for x in entries}
        for x in generated.get('media',[]):
            if isinstance(x,dict) and x.get('source')=='stremio' and x.get('id') not in known:
                entries.append(x)
    observed=read_json('duracoes_observadas.json') or {}
    movie_states=read_json('stremio_filmes_verificados.json') or {}
    movie_status=movie_states.get('films',{})
    availability=read_json('stremio_series_verificadas.json') or {}
    shows=availability.get('shows',{})
    # A grade só inclui séries verificadas; um stream confirmado de outro episódio
    # não prova todos os episódios, portanto o player ainda valida cada seleção.
    for entry in entries:
        if entry.get('source')=='stremio' and entry.get('kind')=='episode':
            verified=shows.get(str(entry.get('imdbId')))
            # A existência de metadados é independente da disponibilidade momentânea
            # do addon. Não esconder episódios durante sincronização / HTTP 408/429.
            entry['enabled']=bool(entry.get('enabled',True))
            entry['streamVerifiedByShow']=bool(verified and verified.get('available'))
            entry['availabilityPending']=not bool(verified and verified.get('available'))
        measured=observed.get(entry.get('id'))
        if isinstance(measured,(int,float)) and 10<=measured<=30000:
            entry['duration']=round(measured,3)
            entry['durationVerified']=True
            entry['durationSource']='reprodução HTML5 observada'
    for movie in (read_json('filmes_cine_cartoon.json') or {}).get('titles',[]):
        if not isinstance(movie,dict):continue
        imdb=str(movie.get('imdbId',''))
        state=movie_status.get(imdb)
        if not isinstance(state,dict) or state.get('available') is not True:continue
        release=int(movie.get('releaseYear',0))
        if release<1900 or release>2021:continue
        duration=observed.get('stremio:movie:'+imdb,movie.get('duration'))
        try:duration=float(duration)
        except (TypeError,ValueError):continue
        if not 1200<=duration<=18000:continue
        entries.append({'id':'stremio:movie:'+imdb,'source':'stremio','kind':'movie',
          'path':'stremio:movie:'+imdb,'imdbId':imdb,'name':movie['name'],
          'show':'Cine Cartoon','duration':duration,'durationVerified':('stremio:movie:'+imdb) in observed,
          'durationSource':'observada' if ('stremio:movie:'+imdb) in observed else 'metadados (estimativa)',
          'releaseDate':str(release)+'-01-01','releaseYear':release,'filmLastYear':release+3,
          'firstCNAiredYear':movie.get('firstCNAiredYear',release),
          'firstCNAiredDate':movie.get('firstCNAiredDate'),
          'firstCNAiredYear':int(movie.get('firstCNAiredYear') or release),
          'years':[],'block':'cine','enabled':True,'streamCatalogChecked':True,'event':'normal',
          'seasonTags':['halloween'] if movie.get('eventHint')=='halloween' else []})
    return entries


AUTO_LOCK = threading.Lock()
def sync_pomfy_episodes():
    config = read_json('pomfy_series.json')
    if not isinstance(config,dict) or not config.get('enabled'):
        return {'ok':False,'message':'Ative data/pomfy_series.json para sincronizar.'}
    shows = config.get('series',[])
    if not isinstance(shows,list):return {'ok':False,'message':'Configuração inválida.'}
    records = []
    errors=[]
    with AUTO_LOCK:
        for sh in shows[:25]:
            if not isinstance(sh,dict) or sh.get('enabled') is False:continue
            try:
                tvmaze_id=int(sh['tvmazeId']);tmdb_id=int(sh['tmdbId'])
                if not (1 <= tvmaze_id < 10000000 and 1 <= tmdb_id < 10000000):continue
                show=str(sh['show'])[:100]
                # URL fixa; IDs inteiros impedem chamadas de rede arbitrárias.
                req=urllib.request.Request(f'https://api.tvmaze.com/shows/{tvmaze_id}/episodes',headers={'User-Agent':'CartoonTimeline/0.7 (local personal archive)'})
                with urllib.request.urlopen(req,timeout=12) as response:
                    episodes=json.load(response)
                if not isinstance(episodes,list):continue
                for ep in episodes[:1500]:
                    if not isinstance(ep,dict) or not isinstance(ep.get('airdate'),str):continue
                    date=ep['airdate']
                    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',date):continue
                    if date > '2021-12-31':continue
                    try:
                        season=int(ep.get('season') or 0);number=int(ep.get('number') or 0)
                        if season<1 or number<1:continue
                        mins=float(ep.get('runtime') or sh.get('episodeMinutes') or 11)
                    except (TypeError,ValueError):continue
                    if not 2 <= mins <= 90:mins=11
                    name=str(ep.get('name') or f'Episódio {number}')[:150]
                    # earliestBR limita a PRIMEIRA aparição da série; não é uma data
                    # brasileira verificada de cada episódio.
                    earliest=str(sh.get('earliestBR') or '2015-01-01')
                    start=max(date,earliest)
                    if start>'2021-12-31':continue
                    records.append({'id':f'pomfy:auto:{tmdb_id}:{season}:{number}',
                        'kind':'episode','source':'pomfy','embedProvider':'pomfy',
                        'show':show,'name':f'{show} · T{season:02d}E{number:02d} · {name}',
                        'season':season,'episode':number,'tmdbId':tmdb_id,
                        'path':f'https://api.pomfy.stream/serie/{tmdb_id}/{season}/{number}',
                        'duration':round(mins*60,3),'durationVerified':False,
                        'durationSource':'TVmaze / estimativa','releaseDate':start,
                        'originalAirdate':date,'airdatePrecision':'original (não BR)',
                        'popularity':1.8 if date>='2018-01-01' else 1,
                        'event':'normal','years':[], 'seekable':False,'syncMode':'iframe (não controlável)'})
            except Exception as error:
                errors.append(f'{str(sh.get("show","Série"))[:60]}: {type(error).__name__}')
        if records:
            target=DATA/'pomfy_automatico.json'
            temp=DATA/'pomfy_automatico.tmp'
            temp.write_text(json.dumps({'version':1,'updatedAt':time.strftime('%Y-%m-%dT%H:%M:%S'), 'media':records},ensure_ascii=False,indent=2),encoding='utf-8')
            temp.replace(target)
    return {'ok':len(records)>0,'count':len(records),'errors':errors,'message':f'{len(records)} episódios catalogados usando datas originais; não verifica disponibilidade no Pomfy.' if records else 'Nenhum episódio atualizado; revise acesso à TVmaze.'}


# v0.8.5 - Adaptador Stremio baseado no protocolo oficial. As fontes externas
# podem não conceder licença para reprodução; use apenas conteúdo autorizado.
# Este adaptador NÃO extrai páginas, não burla CAPTCHA/DRM e não inicia torrents.
STREAM_CACHE = {}
STREAM_LOCK = threading.Lock()
MAX_JSON = 1_500_000
ADDON_BACKOFF = {} # temporary HTTP 408/429/network failure backoff; never disables addons permanently
ADDON_BACKOFF_LOCK = threading.Lock()

def stremio_sources():
    config=read_json('stremio.json')
    if not isinstance(config,dict) or not config.get('enabled'):
        return []
    sources=config.get('addons',[])
    found=[]
    for source in sources[:10] if isinstance(sources,list) else []:
        if not isinstance(source,dict) or source.get('enabled') is False:continue
        uri=str(source.get('manifest','')).strip()
        parsed=urlsplit(uri)
        if parsed.scheme!='https' or parsed.username or parsed.password or parsed.query or not parsed.path.endswith('/manifest.json'):
            continue
        if not parsed.hostname or parsed.hostname in {'localhost','127.0.0.1'}:continue
        found.append({'name':str(source.get('name','Addon'))[:32],'manifest':uri,'base':uri[:-len('manifest.json')]})
    return found

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

FETCHER=urllib.request.build_opener(NoRedirect())
MANIFEST_CACHE = {}
MANIFEST_LOCK = threading.Lock()

def safe_json_get(url,timeout=6):
    # Manifests rarely change minute-to-minute. Without this cache a new
    # episode caused 1–3 network round trips before even trying its MP4.
    is_manifest=url.endswith('/manifest.json')
    if is_manifest:
        with MANIFEST_LOCK:
            cached=MANIFEST_CACHE.get(url)
            if cached and time.monotonic()-cached[0]<600:
                return cached[1]
    request=urllib.request.Request(url,headers={'User-Agent':'CartoonTimeline/0.8.85 (+localhost; stremio addon protocol)','Accept':'application/json'})
    with FETCHER.open(request,timeout=timeout) as response:
        if response.status != 200:raise ValueError('HTTP '+str(response.status))
        if int(response.headers.get('Content-Length','0') or 0)>MAX_JSON:raise ValueError('Resposta excessiva')
        raw=response.read(MAX_JSON+1)
        if len(raw)>MAX_JSON:raise ValueError('Resposta excessiva')
    parsed=json.loads(raw.decode('utf-8'))
    if is_manifest:
        with MANIFEST_LOCK:MANIFEST_CACHE[url]=(time.monotonic(),parsed)
    return parsed

def stream_manifest_ok(manifest,type_name,imdb):
    types=manifest.get('types',[])
    if types and type_name not in types:return False
    resources=manifest.get('resources',[])
    for r in resources:
        if r=='stream':return not manifest.get('idPrefixes') or any(imdb.startswith(x) for x in manifest.get('idPrefixes',[]))
        if isinstance(r,dict) and r.get('name')=='stream':
            if r.get('types') and type_name not in r['types']:continue
            prefix=r.get('idPrefixes',manifest.get('idPrefixes',[]))
            if prefix and not any(imdb.startswith(x) for x in prefix):continue
            return True
    return False

def playable_url(u):
    """URLs publicas de midia HTML5: aceita HTTP na LAN ou HTTPS.

    Validar a URL nao atesta que o servidor entregue um arquivo MP4 valido.
    Nunca buscar/proxiar o video no servidor: apenas devolve o endereco ao navegador.
    """
    try:
        parts=urlsplit(u)
        if parts.scheme not in ('http','https') or parts.username or parts.password or not parts.hostname:return False
        host=parts.hostname.lower().rstrip('.')
        if host in ('localhost','0.0.0.0') or host.endswith(('.local','.internal','.localhost')):return False
        try:
            address=ipaddress.ip_address(host)
            if not address.is_global:return False
        except ValueError:pass
        if parts.port and parts.port not in (80,443,8080,8443):return False
        # A URL direta sera usada em <video>, nao em iframe ou navegador externo.
        # Nao aceitar paginas de players ou endpoints sem extensao conhecida.
        if not parts.path.lower().endswith(('.mp4','.m4v','.webm','.ogv','.m3u8')):return False
        return True
    except (TypeError,ValueError):return False

def stream_is_html5_candidate(stream):
    if not isinstance(stream,dict) or not isinstance(stream.get('url'),str):return False
    hints=stream.get('behaviorHints') or {}
    if not isinstance(hints,dict):hints={}
    # O proprio addon marca fontes que requerem player especializado/cabecalhos.
    if hints.get('proxyHeaders'):return False
    if not playable_url(stream['url']):return False
    if hints.get('notWebReady') is True:
        # O protocolo Stremio marca HTTP como notWebReady mesmo quando e MP4.
        # Em localhost servido via HTTP vale testar um MP4 direto (sem proxy).
        uri=urlsplit(stream['url'])
        return uri.scheme=='http' and uri.path.lower().endswith('.mp4')
    return True


def resolve_stremio(imdb,season=None,episode=None,kind='episode',exclude_providers=None):
    sources=stremio_sources()
    if not sources:return {'ok':False,'reason':'Adaptador desativado ou sem addons','attempts':[]}
    if not re.fullmatch(r'tt\d{5,12}',str(imdb)):
        return {'ok':False,'reason':'IMDb ID inválido','attempts':[]}
    if kind=='episode':
        try:
            season=int(season);episode=int(episode)
        except (TypeError,ValueError):return {'ok':False,'reason':'Temporada/episódio inválidos','attempts':[]}
        if not 1<=season<=99 or not 1<=episode<=9999:return {'ok':False,'reason':'Temporada/episódio fora da faixa','attempts':[]}
        video_id=f'{imdb}:{season}:{episode}'
        stype='series'
    elif kind=='movie':video_id=str(imdb);stype='movie'
    else:return {'ok':False,'reason':'Tipo inválido','attempts':[]}
    excluded=set(x for x in (exclude_providers or []) if isinstance(x,str))
    key=(stype,video_id,tuple(sorted(excluded)))
    now=time.monotonic()
    with STREAM_LOCK:
        cached=STREAM_CACHE.get(key)
        if cached and now-cached[0]<(240 if cached[1].get('ok') else 6):return cached[1]
    attempts=[]
    for addon in sources:
        if addon['name'] in excluded:continue
        with ADDON_BACKOFF_LOCK:
            backed_off = ADDON_BACKOFF.get(addon['name'], 0) > time.monotonic()
        if backed_off:
            attempts.append({'addon':addon['name'],'status':'Aguardando recuperação após erro temporário'})
            continue
        try:
            # A manifest endpoint occasionally returns 403 even when stream endpoint
            # remains online. Do not turn this into a hard reject: the addon is
            # explicitly configured by the user and the stream URL is fixed here.
            try:
                manifest=safe_json_get(addon['manifest'],timeout=3)
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
                manifest=None
            if isinstance(manifest,dict) and not stream_manifest_ok(manifest,stype,imdb):
                attempts.append({'addon':addon['name'],'status':'Não aceita este ID/tipo'});continue
            endpoint=addon['base']+'stream/'+stype+'/'+quote(video_id,safe=':')+'.json'
            payload=safe_json_get(endpoint,timeout=8)
            streams=payload.get('streams',[]) if isinstance(payload,dict) else []
            if not isinstance(streams,list):streams=[]
            directs=[s for s in streams if stream_is_html5_candidate(s)]
            # Devolve todos os candidatos da fonte prioritaria. O browser tenta
            # cada um antes de passar ao proximo addon.
            candidates=[]
            seen=set()
            for st in directs[:20]:
                url=st['url']
                if url in seen:continue
                seen.add(url)
                fmt='hls' if urlsplit(url).path.lower().endswith('.m3u8') else 'video'
                label=str(st.get('name',''))+' '+str(st.get('title',''))
                found=re.search(r'(?i)\b(2160|1080|720|480|360)p?\b|\b(4k|sd)\b',label)
                quality=((found.group(1) or found.group(2)).lower() if found else 'unknown')
                candidates.append({'url':url,'format':fmt,'quality':quality})
            # Prefere 720p para reduzir travamentos; conserva a ordem original
            # quando o addon não informa qualidade. HLS ajusta bitrate sozinho.
            ranking={'720':0,'1080':1,'unknown':2,'480':3,'sd':3,'360':4,'2160':5,'4k':5}
            candidates.sort(key=lambda c:ranking.get(c.get('quality'),2))
            if candidates:
                first=candidates[0]
                answer={'ok':True,'provider':addon['name'],'url':first['url'],
                    'format':first['format'],'candidates':candidates,'attempts':attempts,
                    'note':'HTTP no site HTTP local; HTTPS no site HTTPS. Codec, CORS, autorizacao, Range e disponibilidade ainda precisam funcionar no navegador.'}
                with STREAM_LOCK:STREAM_CACHE[key]=(now,answer)
                return answer
            torrent=sum(bool(s.get('infoHash')) for s in streams if isinstance(s,dict))
            hints_blocked=sum(bool(isinstance(s,dict) and (s.get('behaviorHints') or {}).get('notWebReady')) for s in streams if isinstance(s,dict))
            attempts.append({'addon':addon['name'],'status':f'{len(streams)} fonte(s), {torrent} torrent(s), {hints_blocked} nao preparadas para web, nenhum MP4/HLS direto compativel' if streams else 'Sem fontes'})
        except Exception as exc:
            if isinstance(exc, (urllib.error.HTTPError, TimeoutError, urllib.error.URLError)):
                code=getattr(exc,'code',0)
                with ADDON_BACKOFF_LOCK:
                    ADDON_BACKOFF[addon['name']]=time.monotonic()+(120 if code in (408,429) else 35)
            attempts.append({'addon':addon['name'],'status':type(exc).__name__+(' HTTP '+str(getattr(exc,'code')) if getattr(exc,'code',None) else '')})
    result={'ok':False,'reason':'Nenhuma fonte HTML5 reproduzível; torrents requerem serviço de streaming próprio.','attempts':attempts}
    with STREAM_LOCK:STREAM_CACHE[key]=(now,result)
    return result

def stremio_status():
    results=[]
    for addon in stremio_sources():
        try:
            item=safe_json_get(addon['manifest'])
            results.append({'name':addon['name'],'online':True,'manifestName':str(item.get('name',''))[:80],'types':item.get('types',[]),'stream':any(r=='stream' or isinstance(r,dict) and r.get('name')=='stream' for r in item.get('resources',[]))})
        except Exception as e:
            results.append({'name':addon['name'],'online':False,'error':type(e).__name__})
    return {'sources':results}

def tvmaze_series_info(sh):
    """Resolve títulos sem supor IDs: nome, ano original e IMDb precisam conferir.

    Nunca usa uma correspondência aproximada de busca como se fosse certeza.
    """
    if sh.get('tvmazeId') and sh.get('imdbId'):
        return int(sh['tvmazeId']),str(sh['imdbId'])
    query=str(sh.get('searchName') or '').strip()
    lookup=(read_json('stremio_series_ids.json') or {}).get(query)
    if isinstance(lookup,dict) and lookup.get('tvmazeId') and re.fullmatch(r'tt\d+',str(lookup.get('imdbId',''))):
        return int(lookup['tvmazeId']),str(lookup['imdbId'])
    if not query:return None
    hits=safe_json_get('https://api.tvmaze.com/search/shows?q='+quote(query,safe=''),timeout=8)
    if not isinstance(hits,list):return None
    def normal(x):
        return re.sub(r'[^a-z0-9]+','',unicodedata.normalize('NFKD',str(x).lower()).encode('ascii','ignore').decode())
    target=normal(query)
    for hit in hits[:12]:
        show=hit.get('show') if isinstance(hit,dict) else None
        if not isinstance(show,dict) or normal(show.get('name'))!=target:continue
        expected=sh.get('originalPremiereYear')
        if expected and str(show.get('premiered',''))[:4]!=str(expected):continue
        imdb=(show.get('externals') or {}).get('imdb')
        if imdb and re.fullmatch(r'tt\d{5,12}',str(imdb)) and isinstance(show.get('id'),int):
            try:
                with JSON_WRITE_LOCK:
                    cached=read_json('stremio_series_ids.json') or {}
                    cached[query]={'tvmazeId':show['id'],'imdbId':str(imdb)}
                    json_atomic('stremio_series_ids.json',cached)
            except Exception:pass
            return show['id'],str(imdb)
    return None


def episode_season_tags(title):
    name=unicodedata.normalize('NFKD',title.lower()).encode('ascii','ignore').decode()
    dictionary={
      'halloween': ('halloween','spooky','fright','ghost','vampire','monster','haunted','scary','zombie','witch','terror','assombrad'),
      'christmas': ('christmas','xmas','santa','reindeer','christmas eve','natal','holiday special'),
      'easter': ('easter','pascoa','chocolate egg','egg hunt','coelhinho'),
      'vacation': ('summer vacation','summer camp','beach holiday','ferias','vacation'),
      'thanksgiving': ('thanksgiving','turkey day')}
    return [event for event,words in dictionary.items() if any(w in name for w in words)]

def _parse_cinemeta_episodes(sh, imdb):
    """Fallback de metadados Stremio. Nunca obtém nem baixa mídia protegida.

    Sem released válido, o episódio NÃO entra na grade, para evitar futuro.
    """
    payload=safe_json_get(f'https://v3-cinemeta.strem.io/meta/series/{imdb}.json',timeout=6)
    obj=payload.get('meta',{}) if isinstance(payload,dict) else {}
    videos=obj.get('videos',[]) if isinstance(obj,dict) else []
    if not isinstance(videos,list):raise ValueError('Cinemeta: lista de episódios ausente')
    records=[]
    for video in videos[:1600]:
        if not isinstance(video,dict):continue
        released=str(video.get('released') or '')[:10]
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',released) or released>'2021-12-31':continue
        try:
            season=int(video.get('season') or 0);number=int(video.get('episode') or 0)
            if season<1 or number<1:continue
            runtime=float(video.get('runtime') or sh.get('episodeMinutes') or 11)
        except (ValueError,TypeError):continue
        if runtime>90:runtime/=60  # providers sometimes report seconds
        if not 2<=runtime<=90:runtime=float(sh.get('episodeMinutes') or 11)
        first=max(released,str(sh.get('earliestBR') or '2015-01-01'))
        if first>'2021-12-31':continue
        title=str(video.get('title') or video.get('name') or '')[:100]
        records.append({'id':f'stremio:{imdb}:{season}:{number}',
          'kind':'episode','source':'stremio','path':f'stremio:{imdb}:{season}:{number}',
          'show':str(sh.get('show') or '')[:100],
          'name':f'{sh.get("show")} · T{season:02d}E{number:02d} · {title or "Episódio"}',
          'imdbId':imdb,'season':season,'episode':number,'duration':runtime*60,
          'durationVerified':False,'durationSource':'Cinemeta (estimativa)',
          'releaseDate':first,'originalAirdate':released,'releasePrecision':'original-não-BR',
          'years':[],'event':'normal','seasonTags':episode_season_tags(title),
          'enabled':True,'popularity':1.4})
    return records

def sync_stremio_episodes():
    """Non-destructive incremental sync; keeps previous records on offline/partial failure."""
    config=read_json('stremio_series.json')
    if not isinstance(config,dict) or not config.get('enabled'):
        return {'ok':False,'message':'Habilite data/stremio_series.json'}
    previous=(read_json('stremio_episodios.json') or {}).get('media',[])
    by_id={ep.get('id'):ep for ep in previous if isinstance(ep,dict) and ep.get('id')}
    overrides={}
    for x in (read_json('episodios_tematicos.json') or {}).get('episodes',[]):
        if not isinstance(x,dict):continue
        try:
            tags=[t for t in x.get('tags',[]) if t in ('halloween','christmas','easter','vacation','thanksgiving')]
            overrides[(str(x['imdbId']),int(x['season']),int(x['episode']))]=tags
        except (KeyError,ValueError,TypeError):pass
    enabled=[x for x in config.get('series',[]) if isinstance(x,dict) and x.get('enabled') is not False][:60]
    # Popular series first; these already have documented IDs in the configuration.
    enabled.sort(key=lambda x: 0 if x.get('tvmazeId') and x.get('imdbId') else 1)
    errors=[];unresolved=[];resolved=0;completed=0
    SYNC_STATE['totalSeries']=len(enabled)
    SYNC_STATE['seriesProcessed']=0
    def sync_one(sh):
        show=str(sh.get('show','Série'))[:100]
        tvmaze_error=None
        # O IMDb explícito pode ser usado no Cinemeta mesmo que a TVmaze falhe.
        imdb=str(sh.get('imdbId') or '')
        try:
            pair=tvmaze_series_info(sh)
            if pair:
                tvmaze_id,imdb=pair
                episodes=safe_json_get(f'https://api.tvmaze.com/shows/{tvmaze_id}/episodes',timeout=6)
                if isinstance(episodes,list):
                    result=[]
                    for ep in episodes[:1500]:
                        if not isinstance(ep,dict):continue
                        date=str(ep.get('airdate') or '')
                        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',date) or date>'2021-12-31':continue
                        try:
                            season=int(ep.get('season') or 0);number=int(ep.get('number') or 0)
                            minutes=float(ep.get('runtime') or sh.get('episodeMinutes') or 11)
                        except (ValueError,TypeError):continue
                        if season<1 or number<1:continue
                        if not 2<=minutes<=90:minutes=float(sh.get('episodeMinutes') or 11)
                        first=max(date,str(sh.get('earliestBR') or '2015-01-01'))
                        if first>'2021-12-31':continue
                        title=str(ep.get('name') or '')
                        result.append({'id':f'stremio:{imdb}:{season}:{number}',
                            'kind':'episode','source':'stremio','path':f'stremio:{imdb}:{season}:{number}',
                            'show':show,'name':f'{show} · T{season:02d}E{number:02d} · {title[:120] or "Episódio"}',
                            'imdbId':imdb,'season':season,'episode':number,'duration':minutes*60,
                            'durationVerified':False,'durationSource':'TVmaze (estimativa)',
                            'releaseDate':first,'originalAirdate':date,'releasePrecision':'original-não-BR',
                            'years':[],'event':'normal',
                            'seasonTags':list(set(episode_season_tags(title)+overrides.get((imdb,season,number),[]))),
                            'enabled':True,'popularity':1.4})
                    if result:return show,result,None
            tvmaze_error='TVmaze indisponível ou sem episódios compatíveis'
        except Exception as exc:
            tvmaze_error=type(exc).__name__
        if re.fullmatch(r'tt\d{5,12}',imdb):
            try:
                records=_parse_cinemeta_episodes(sh,imdb)
                if records:return show,records,None
            except Exception as exc:
                return show,None,f'TVmaze: {tvmaze_error}; Cinemeta: {type(exc).__name__}'
        return show,None,tvmaze_error or 'IMDb não identificado com segurança'
    # Never hold AUTO_LOCK during network calls. Writes stay atomic and preserve old data.
    def commit():
        json_atomic('stremio_episodios.json',{'version':3,
           'updatedAt':time.strftime('%Y-%m-%dT%H:%M:%S'), 'media':list(by_id.values())})
    with ThreadPoolExecutor(max_workers=3,thread_name_prefix='CN-TVmaze') as executor:
        pending={executor.submit(sync_one,sh):sh for sh in enabled}
        for future in as_completed(pending):
            sh=pending[future];completed+=1
            try:show,records,error=future.result()
            except Exception as exc:show=sh.get('show','Série');records=None;error=type(exc).__name__
            if records is None:
                if error=='Título/IMDb sem correspondência segura':unresolved.append(show)
                else:errors.append(show+': '+str(error))
            else:
                if records:resolved+=1
                for ep in records:by_id[ep['id']]=ep
            SYNC_STATE['seriesProcessed']=completed
            SYNC_STATE['phase']=f'Importando metadados {completed}/{len(enabled)} · {len(by_id)} episódios'
            if completed<=3 or completed%4==0:commit()
    if by_id:commit()
    return {'ok':bool(by_id),'count':len(by_id),'seriesCount':resolved,'unresolved':unresolved,'errors':errors,
        'message':f'{len(by_id)} episódios guardados; {resolved} séries atualizadas nesta sincronização.' if by_id
           else 'Nenhuma mídia indexada. Sem acesso à TVmaze ou sem cache anterior; a grade histórica permanece visível como pendente.'}


# v0.8.8: sincronização não bloqueante e cache de disponibilidade.
SYNC_STATE={'running':False,'phase':'Aguardando','finishedAt':None,'lastError':None,'totalSeries':0,'seriesProcessed':0,'mode':'metadata-first'}
SYNC_GUARD=threading.Lock()

JSON_WRITE_LOCK=threading.RLock()
def json_atomic(filename,data):
    with JSON_WRITE_LOCK:
        p=DATA/filename
        tmp=p.with_name(p.name+'.tmp')
        tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
        tmp.replace(p)

def _recent(path,hours=12):
    return path.exists() and time.time()-path.stat().st_mtime<hours*3600

def _catalog_worker(force=False):
    try:
        SYNC_STATE.update(phase='Sincronizando episódios',lastError=None)
        episodes_file=DATA/'stremio_episodios.json'
        if force or not _recent(episodes_file,24) or (read_json('stremio_episodios.json') or {}).get('bootstrap'):
            result=sync_stremio_episodes()
            if not result.get('ok'):SYNC_STATE['lastError']=result.get('message')
        generated=read_json('stremio_episodios.json') or {}
        all_eps=generated.get('media') or []
        indexed={}
        for ep in all_eps:
            imdb=ep.get('imdbId')
            if imdb and ep.get('season') and ep.get('episode'):
                indexed.setdefault(imdb,[]).append(ep)
        # Verificação não bloqueia o catálogo: é feita no momento em que a
        # programação precisa do episódio. Testar 38 séries e 20 filmes aqui
        # demorava minutos e deixava o usuário vendo "0 acervos".
        SYNC_STATE['phase']='Metadados prontos; fontes verificadas sob demanda'
        SYNC_STATE['phase']='Concluído'
    except Exception as exc:
        SYNC_STATE['lastError']=f'{type(exc).__name__}: {exc}'
        SYNC_STATE['phase']='Falha parcial; mantém cache existente'
    finally:
        SYNC_STATE.update(running=False,finishedAt=time.time())

def background_sync(force=False):
    if force:
        with STREAM_LOCK:STREAM_CACHE.clear()
        with ADDON_BACKOFF_LOCK:ADDON_BACKOFF.clear()
    with SYNC_GUARD:
        if SYNC_STATE['running']:return False
        SYNC_STATE['running']=True
        threading.Thread(target=_catalog_worker,args=(force,),daemon=True,name='CN-Catalog-Sync').start()
        return True

def report_observed_duration(asset_id,duration):
    if not isinstance(asset_id,str) or len(asset_id)>180 or not re.fullmatch(r'[a-zA-Z0-9_:./-]+',asset_id):return False
    try: duration=float(duration)
    except (ValueError,TypeError):return False
    if not 10<=duration<=30000:return False
    with AUTO_LOCK:
        observed=read_json('duracoes_observadas.json') or {}
        # Só aceitar registros do catálogo; evita gravações sem referência.
        ids={x.get('id') for x in make_catalog()}
        if asset_id not in ids:return False
        if abs(float(observed.get(asset_id,0))-duration)>.25:
            observed[asset_id]=round(duration,3)
            json_atomic('duracoes_observadas.json',observed)
    return True

class LocalServer(ThreadingHTTPServer):
    # Evita reverse DNS desnecessário durante a inicialização.
    def server_bind(self):
        socketserver.TCPServer.server_bind(self)
        self.server_name = self.server_address[0]
        self.server_port = self.server_address[1]


class Handler(SimpleHTTPRequestHandler):
    def _json_result(self,result,status=200):
        raw=json.dumps(result,ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(raw)))
        self.end_headers();self.wfile.write(raw)

    def do_POST(self):
        route=unquote(urlsplit(self.path).path)
        if route not in ('/api/stremio/sync','/api/stremio/resolve','/api/duration/observe'):
            self.send_error(404);return
        origin=self.headers.get('Origin','')
        host=self.headers.get('Host','')
        if origin and origin.rstrip('/') not in (f'http://{host}',f'https://{host}'):
            self.send_error(403);return
        if route=='/api/stremio/sync':
            launched=background_sync(force=True)
            return self._json_result({'ok':True,'started':launched,'message':'Sincronização em segundo plano iniciada' if launched else 'Sincronização em andamento'})
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=1024:raise ValueError('Requisição inválida')
            args=json.loads(self.rfile.read(length).decode('utf-8'))
            if not isinstance(args,dict):raise ValueError('Objeto inválido')
        except (ValueError,TypeError,UnicodeError):return self._json_result({'ok':False,'reason':'Argumentos inválidos'},400)
        if route=='/api/duration/observe':
            ok=report_observed_duration(args.get('id'),args.get('duration'))
            return self._json_result({'ok':ok},200 if ok else 400)
        result=resolve_stremio(args.get('imdbId'),args.get('season'),args.get('episode'),args.get('kind','episode'),args.get('excludeProviders',[]))
        return self._json_result(result,200)

    def do_GET(self):
        route = unquote(urlsplit(self.path).path)
        if route == '/api/sync/status':
            return self._json_result({**SYNC_STATE, 'episodes':len((read_json('stremio_episodios.json') or {}).get('media',[])),
              'verifiedShows':sum(bool(x.get('available')) for x in (read_json('stremio_series_verificadas.json') or {}).get('shows',{}).values()),
              'verifiedMovies':sum(bool(x.get('available')) for x in (read_json('stremio_filmes_verificados.json') or {}).get('films',{}).values()),
              'configuredSeries':len((read_json('stremio_series.json') or {}).get('series',[])),
              'historicalFallback':True,'metadataCatalogReady':bool((read_json('stremio_episodios.json') or {}).get('media',[])),
              'verificationMode':'on-demand'})
        if route == '/api/stremio/status':
            return self._json_result(stremio_status())
        if route == '/api/catalog':
            raw = json.dumps({'media': make_catalog()}, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if route == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return
        root, relative = (MEDIA, route[7:]) if route.startswith('/media/') else (PUBLIC, route.lstrip('/') or 'index.html')
        path = (root / relative).resolve()
        if not path.is_relative_to(root.resolve()):
            self.send_error(403)
            return
        if not path.is_file():
            self.send_error(404)
            return
        mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        size = path.stat().st_size
        start, end = 0, size - 1
        byte_range = re.fullmatch(r'bytes=(\d*)-(\d*)', self.headers.get('Range', ''))
        if byte_range:
            first, last = byte_range.groups()
            if first:
                start = int(first)
                end = min(int(last), end) if last else end
            elif last:
                start = max(0, size - int(last))
            if start > end or start >= size:
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{size}')
                self.end_headers()
                return
        remaining = end - start + 1
        self.send_response(206 if byte_range else 200)
        self.send_header('Content-Type', mime)
        self.send_header('Accept-Ranges', 'bytes')
        if byte_range:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(remaining))
        self.end_headers()
        try:
            with path.open('rb') as stream:
                stream.seek(start)
                while remaining:
                    part = stream.read(min(256 * 1024, remaining))
                    if not part:
                        break
                    self.wfile.write(part)
                    remaining -= len(part)
        except (BrokenPipeError, ConnectionResetError):
            pass


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=3000)
    parser.add_argument('--host', default='0.0.0.0', help='0.0.0.0 permite acesso pela rede local')
    args = parser.parse_args()
    MEDIA.mkdir(exist_ok=True)
    DATA.mkdir(exist_ok=True)
    server = LocalServer((args.host, args.port), Handler)
    print(f'CN TIMELINE | http://localhost:{args.port} | rede: {args.host}:{args.port} | mídia: {MEDIA}', flush=True)
    background_sync(force=False)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nEncerrando servidor...')
    finally:
        server.server_close()
