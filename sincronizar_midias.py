#!/usr/bin/env python3
"""Syncs only media/ files from the public, user-supplied GitHub repo.
No deletions. Existing media are skipped by matching size. Requires no packages.
"""
import argparse, json, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

OWNER='BarcelosBrr'; REPO='CN-Timeline'; BRANCH='main'
TREE=f'https://api.github.com/repos/{OWNER}/{REPO}/git/trees/{BRANCH}?recursive=1'
RAW=f'https://raw.githubusercontent.com/{OWNER}/{REPO}/{BRANCH}/'
HEADERS={'User-Agent':'CN-Timeline-Media-Sync/0.9','Accept':'application/vnd.github+json'}
CATS={'anuncios','chamadas','promos','vinhetas','especiais','filmes','episodios','curtas'}

def request(url, timeout=35):
    return urllib.request.urlopen(urllib.request.Request(url,headers=HEADERS), timeout=timeout)

def fetch_tree():
    with request(TREE) as resp: data=json.load(resp)
    if data.get('truncated'): raise RuntimeError('Arvore GitHub incompleta; nenhum arquivo sera modificado.')
    return [x for x in data['tree'] if x.get('type')=='blob' and x.get('path','').startswith('media/')
            and Path(x['path']).suffix.lower() in ('.mp4','.webm','.mkv','.mov','.m4v','.json','.txt')
            and len(Path(x['path']).parts)>2 and Path(x['path']).parts[1] in CATS]

def sync_one(item, dest):
    rel=Path(item['path']); target=dest/rel
    if target.is_file() and target.stat().st_size==item.get('size',-1): return 'existente',str(rel)
    target.parent.mkdir(parents=True,exist_ok=True)
    # Never overwrite an existing file whose contents differ. Protect local edits.
    if target.exists(): return 'diferente',str(rel)
    tmp=target.with_name(target.name+'.baixando')
    url=RAW+urllib.parse.quote(rel.as_posix(),safe='/')
    for attempt in range(4):
        try:
            with request(url,timeout=70) as response, tmp.open('wb') as out:
                while True:
                    chunk=response.read(1024*1024)
                    if not chunk:break
                    out.write(chunk)
            if tmp.stat().st_size!=item['size']:raise IOError('Tamanho transferido incompleto')
            tmp.replace(target)
            return 'baixado',str(rel)
        except Exception as exc:
            tmp.unlink(missing_ok=True)
            if attempt==3:return f'erro: {type(exc).__name__}',str(rel)
            time.sleep(2**attempt)

def main():
    p=argparse.ArgumentParser()
    p.add_argument('destino',nargs='?',default='.',help='Pasta raiz com server.py')
    p.add_argument('--list-only',action='store_true')
    args=p.parse_args();root=Path(args.destino).expanduser().resolve()
    if not (root/'server.py').is_file():p.error('Destino nao contem server.py')
    print('Consultando GitHub; nao remove nem substitui arquivos existentes...')
    try: files=fetch_tree()
    except Exception as e:print('Erro ao consultar a lista:',e);return 1
    print(f'{len(files)} itens de midia disponiveis no GitHub.')
    counts={}
    for f in files:
        category=Path(f['path']).parts[1]
        counts[category]=counts.get(category,0)+1
    print('Categorias:',counts)
    missing=[f for f in files if not (root/f['path']).exists()]
    print(f'{len(missing)} faltantes; estimativa {sum(x["size"] for x in missing)/1048576:.1f} MB.')
    if args.list_only:return 0
    tally={}
    with ThreadPoolExecutor(max_workers=2) as pool:
        for future in as_completed([pool.submit(sync_one,f,root) for f in files]):
            status,path=future.result();tally[status]=tally.get(status,0)+1
            if status!='existente': print(f'[{status}] {path}',flush=True)
    print('RESUMO:',tally)
    if any(k.startswith('erro:') for k in tally):
        print('Alguns arquivos falharam; execute novamente para retomar faltantes.')
        return 2
    print('Acervo sincronizado. O botao Atualizar acervo no site ira indexar as midias.')
    return 0
if __name__=='__main__':raise SystemExit(main())
