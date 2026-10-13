import importlib.util, pathlib, tempfile, sys, json, threading, urllib.request
R=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(R))
spec=importlib.util.spec_from_file_location('local_server_1021',R/'server.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as td:
    m.DATA=pathlib.Path(td)
    ep={'id':'e:1','kind':'episode','source':'stremio','imdbId':'tt1710308','season':1,'episode':1,'show':'Apenas um Show','path':'stremio:tt1710308:1:1','name':'Episódio','duration':660,'releaseDate':'2010-01-01'}
    (m.DATA/'stremio_series.json').write_text(json.dumps({'series':[{'show':'Apenas um Show'},{'show':'Irmão do Jorel'}]}))
    (m.DATA/'stremio_episodios.json').write_text(json.dumps({'media':[ep]}))
    srv=m.LocalServer(('127.0.0.1',0),m.Handler)
    thread=threading.Thread(target=srv.serve_forever,daemon=True);thread.start()
    base=f'http://127.0.0.1:{srv.server_address[1]}'
    def get(route):return json.load(urllib.request.urlopen(base+route,timeout=3))
    def post(route,payload):
        req=urllib.request.Request(base+route,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'},method='POST')
        return json.load(urllib.request.urlopen(req,timeout=3))
    try:
        groups=get('/api/catalog/series')
        assert groups['comEpisodios']==1,groups
        assert [x['nome'] for x in groups['series']]==['Apenas um Show'],groups
        assert [x['nome'] for x in groups['seriesAguardando']]==['Irmão do Jorel']
        assert len(get('/api/catalog/series/configuradas')['series'])==2
        assert get('/api/catalog/episodes')['total']==1
        assert post('/api/stremio/report-failed',{'imdbId':'tt1710308','season':1,'episode':1,'kind':'episode','reason':'all_candidates_failed'})['ok']
        catalog=get('/api/catalog/episodes')
        assert catalog['temporariamenteSemFonte']==1 and catalog['media'][0]['streamAvailability']=='unavailable',catalog
        assert get('/api/catalog/series')['seriesExibicao'][0]['semFonteRecente']==1
        p2=post('/api/stremio/confirm-playing',{'imdbId':'tt1710308','season':1,'episode':1,'kind':'episode','watchedSeconds':15})
        assert p2['ok'],p2
        assert get('/api/catalog/episodes')['media'][0]['streamAvailability']=='played'
    finally:
        srv.shutdown();srv.server_close()
print('OK: rotas HTTP, séries vazias fora da exibição, falha e playback por episódio')
