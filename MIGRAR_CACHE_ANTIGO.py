"""Migra caches locais do Cartoon Timeline para uma nova instalação.
Uso: python MIGRAR_CACHE_ANTIGO.py "C:/caminho/versao-antiga"
Não copia senhas, tokens ou URLs do browser; preserva os addons já configurados na versão nova.
"""
from pathlib import Path
import json
import sys

DEST=Path(__file__).resolve().parent/'data'
FILES={
 'stremio_episodios.json':'media',
 'stremio_series_verificadas.json':'shows',
 'stremio_filmes_verificados.json':'films',
 'stremio_series_ids.json':None,
 'duracoes_observadas.json':None,
}
def locate(s):
 source=Path(s).expanduser().resolve()
 if (source/'data').is_dir():return source/'data'
 if (source/'CN_Timeline_Retro'/'data').is_dir():return source/'CN_Timeline_Retro'/'data'
 if (source/'CN_Timeline_Retro_v088'/'data').is_dir():return source/'CN_Timeline_Retro_v088'/'data'
 raise FileNotFoundError('Não encontrei data/ na pasta selecionada')
def migrate(source, target=DEST):
 source=locate(str(source))
 target.mkdir(parents=True,exist_ok=True)
 if source==target:raise ValueError('Origem e destino são a mesma pasta')
 summary={}
 for name,member in FILES.items():
  file=source/name
  if not file.is_file():continue
  try:old=json.loads(file.read_text(encoding='utf-8'))
  except (ValueError,OSError):continue
  newfile=target/name
  try:new=json.loads(newfile.read_text(encoding='utf-8')) if newfile.is_file() else {}
  except (ValueError,OSError):new={}
  if member=='media':
   oldvalues=old.get('media',[]) if isinstance(old,dict) else []
   newvalues=new.get('media',[]) if isinstance(new,dict) else []
   combined={x.get('id'):x for x in oldvalues+newvalues if isinstance(x,dict) and x.get('id')}
   data={**(old if isinstance(old,dict) else {}),**(new if isinstance(new,dict) else {}),'media':list(combined.values())}
   amount=len(combined)
  else:
   oldvalues=(old.get(member,{}) if member else old) if isinstance(old,dict) else {}
   newvalues=(new.get(member,{}) if member else new) if isinstance(new,dict) else {}
   merged={**(oldvalues if isinstance(oldvalues,dict) else {}),**(newvalues if isinstance(newvalues,dict) else {})}
   data={member:merged} if member else merged
   amount=len(merged)
  tmp=newfile.with_suffix('.json.tmp')
  tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
  tmp.replace(newfile)
  summary[name]=amount
 return summary
if __name__=='__main__':
 if len(sys.argv)<2:
  print('Arraste a pasta da versão anterior para MIGRAR_CACHE_ANTIGO.bat.')
  sys.exit(1)
 try:
  migrated=migrate(sys.argv[1])
  if not migrated:print('Nenhum cache encontrado. Ainda será preciso sincronizar online.')
  else:
   for name,count in migrated.items():print(f'{name}: {count} registros preservados')
   print('Concluído. Reinicie o Cartoon Timeline e deixe a sincronização automática atualizar o restante.')
 except Exception as e:
  print('ERRO:',type(e).__name__,str(e));sys.exit(1)
