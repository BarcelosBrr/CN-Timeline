import importlib.util, json, tempfile, subprocess, sys, shutil, time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def check():
    cfg=json.loads((ROOT/'data/stremio_series.json').read_text(encoding='utf8'))
    ids=json.loads((ROOT/'data/stremio_series_ids.json').read_text(encoding='utf8'))
    assert len(cfg['series'])>=50
    assert len(ids)>=28
    required=['Hora de Aventura','Steven Universo','Irmão do Jorel','Clarêncio, o Otimista',
              'Jovens Titãs em Ação','Titio Avô','O Show de Tom e Jerry','Acampamento de Verão','Vilanesco']
    assert set(required) <= {x['show'] for x in cfg['series']}
    assert ids['Ben 10']['tvmazeId']==22084
    with tempfile.TemporaryDirectory() as temp:
        dst=Path(temp)/'old_project'; (dst/'public').mkdir(parents=True);(dst/'data').mkdir();(dst/'media').mkdir()
        (dst/'server.py').write_text('OLD',encoding='utf8')
        (dst/'media'/'video_2017.mp4').write_bytes(b'preserve-me')
        (dst/'data'/'stremio_episodios.json').write_text(json.dumps({'media':[{'id':f'stremio:tt1710308:1:{i+1}','kind':'episode','show':'Apenas um Show','releaseDate':'2015-01-01'} for i in range(5000)]}),encoding='utf8')
        (dst/'data'/'stremio_series.json').write_text(json.dumps({'enabled':True,'series':[{'show':'Apenas um Show','note':'user custom'}]}),encoding='utf8')
        (dst/'data'/'stremio_series_ids.json').write_text(json.dumps({'Ben 10':{'tvmazeId':2,'imdbId':'tt6148376'},'Minha Série':{'tvmazeId':99999,'imdbId':'tt0000000'}}),encoding='utf8')
        r=subprocess.run([sys.executable,str(ROOT/'atualizar.py'),str(dst)],text=True,capture_output=True,timeout=15)
        assert r.returncode==0,(r.stdout,r.stderr)
        assert (dst/'media'/'video_2017.mp4').read_bytes()==b'preserve-me'
        assert len(json.loads((dst/'data'/'stremio_episodios.json').read_text())['media'])==5000
        newcfg=json.loads((dst/'data'/'stremio_series.json').read_text())
        assert len(newcfg['series'])>=50
        assert any(x.get('note')=='user custom' for x in newcfg['series'])
        newid=json.loads((dst/'data'/'stremio_series_ids.json').read_text())
        assert newid['Ben 10']['tvmazeId']==22084
        assert 'Minha Série' in newid
        spec=importlib.util.spec_from_file_location('v102_server',dst/'server.py')
        sys.path.insert(0,str(dst))
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        assert module.catalog_series_coverage()['Apenas um Show']==5000
        assert module.catalog_series_coverage()['Hora de Aventura']==0
        assert module.should_import_catalog() is True, 'Cache recent but missing series must trigger sync'
        module.DATA.joinpath('stremio_sync_tentativa.json').write_text(json.dumps({'at':time.time()}))
        assert module.should_import_catalog() is False, 'Network retries should be throttled'
    print('OK: 50 series, 28 IDs, 5.000 episodes preserved, background sync triggered')

if __name__=='__main__':check()
