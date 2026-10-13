#!/usr/bin/env python3
"""Cartoon Timeline v1.02.1: automatic one-step safe upgrade (no separate catalog utility)."""
from pathlib import Path
from datetime import datetime
import json,shutil,sys,unicodedata,re
source=Path(__file__).resolve().parent
if len(sys.argv)<2:
 print('Uso: python atualizar.py "C:\\caminho\\CartoonTimeline"');sys.exit(2)
target=Path(sys.argv[1]).expanduser().resolve()
if not (target/'server.py').exists():
 print('ERRO: pasta selecionada nao contem server.py');sys.exit(2)
if target==source:print('Esta pasta ja e a versao 1.02.1.');sys.exit(0)
backup=target.parent/(target.name+'_backup_v102_'+datetime.now().strftime('%Y%m%d_%H%M%S'))
def read(path):
 try:return json.loads(path.read_text(encoding='utf-8'))
 except (OSError,ValueError):return {}
def norm(v):
 return re.sub('[^a-z0-9]+','',unicodedata.normalize('NFKD',str(v or '').lower()).encode('ascii','ignore').decode())
def save(path):
 if path.is_file():
  out=backup/path.relative_to(target);out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,out)
def write(path,obj):
 path.parent.mkdir(parents=True,exist_ok=True)
 temp=path.with_name(path.name+'.v102.tmp')
 temp.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temp.replace(path)
# Move code only; leave media, episodes, verified streams, user settings untouched.
for relative in ('server.py','research.py','public/app.js','public/planner.js','public/index.html',
                 'public/style.css','public/cn-logo.svg','INICIAR_WINDOWS.bat','README.md','sincronizar_midias.py'):
 src=source/relative;dest=target/relative
 if src.is_file():save(dest);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest)
# Complete stable IDs from new package; never discard user IDs or unrelated custom shows.
newids=read(source/'data/stremio_series_ids.json');oldids=read(target/'data/stremio_series_ids.json')
if not isinstance(oldids,dict):oldids={}
if not isinstance(newids,dict):newids={}
merged=dict(oldids)
for title,identity in newids.items():
 if title not in merged:merged[title]=identity
# Correct one known false mapping (TVmaze ID=2 for 2016 reboot)
if isinstance(merged.get('Ben 10'),dict) and merged['Ben 10'].get('tvmazeId')==2:merged['Ben 10']=newids['Ben 10']
ids_file=target/'data/stremio_series_ids.json'
if merged!=oldids:save(ids_file);write(ids_file,merged)
# Retain template in data so metadata sync always knows the source of IDs.
seed=target/'data/stremio_series_ids_seed.json'
if seed.exists():save(seed)
shutil.copy2(source/'data/stremio_series_ids_seed.json',seed)
# Merge all known series, not just the three hard-coded ones or the adult-mode entries.
configuration=target/'data/stremio_series.json'
original=read(configuration); template=read(source/'data/stremio_series.json')
if not isinstance(original,dict):original={}
rows=original.get('series',[])
if not isinstance(rows,list):rows=[]
existing={norm(x.get('show')):x for x in rows if isinstance(x,dict)}
new_count=0; improved=0
for sh in template.get('series',[]):
 if not isinstance(sh,dict):continue
 key=norm(sh.get('show'))
 if key not in existing:
  rows.append(dict(sh));existing[key]=rows[-1];new_count+=1
 else:
  old=existing[key]
  # Preserve user title/preferences, but repair absent IMDb and TVmaze IDs.
  for attr in ('tvmazeId','imdbId','searchName','earliestBR','episodeMinutes'):
   if sh.get(attr) and not old.get(attr):old[attr]=sh[attr];improved+=1
  if key==norm('Ben 10') and old.get('tvmazeId')==2:old['tvmazeId']=22084;improved+=1
  # Do not override disabled custom entries or user release dates.
obj={**original,'enabled':True,'version':'1.02.1','series':rows}
save(configuration);write(configuration,obj)
print('Cartoon Timeline v1.02.1 instalado: %d series configuradas, %d novas, %d ajustes de identidade.'%(len(rows),new_count,improved))
print('IDs: %d. Episodios, midias locais e caches preservados.'%len(merged))
print('Backup dos arquivos modificados em:',backup)
print('Reinicie o servidor: a sincronizacao de desenhos ausentes sera iniciada automaticamente em segundo plano.')
