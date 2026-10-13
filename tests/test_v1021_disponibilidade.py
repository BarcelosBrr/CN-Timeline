"""Sem chamadas externas: fontes por episódio e séries vazias na lista de exibição."""
import tempfile, importlib.util, json, sys
from pathlib import Path
R=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(R))
spec=importlib.util.spec_from_file_location('server_v1021',R/'server.py')
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
    m.DATA=Path(tmp)
    (m.DATA/'stremio_series.json').write_text(json.dumps({'series':[{'show':'Apenas um Show'},{'show':'Hora de Aventura'}]}))
    (m.DATA/'stremio_episodios.json').write_text(json.dumps({'media':[{'show':'Apenas um Show','kind':'episode','source':'stremio','imdbId':'tt1710308','season':1,'episode':1}]}))
    assert m.catalog_series_coverage()=={'Apenas um Show':1,'Hora de Aventura':0}
    assert m.episode_availability_status(None)=='unknown'
    assert m.record_episode_availability('tt1710308',1,1,'unavailable')
    e={'imdbId':'tt1710308','season':1,'episode':1,'source':'stremio','kind':'episode'}
    m.enrich_episode_availability(e)
    assert e['streamAvailability']=='unavailable', e
    assert m.record_episode_availability('tt1710308',1,1,'candidate')
    m.enrich_episode_availability(e)
    assert e['streamAvailability']=='candidate', e
    assert m.record_episode_availability('tt1710308',1,1,'played')
    assert m.record_episode_availability('tt1710308',1,1,'unavailable')
    m.enrich_episode_availability(e)
    assert e['streamAvailability']=='played'
    assert m.episode_availability_status({'status':'unavailable','checkedEpoch':0},1700000000)=='unknown'
    assert not m.record_episode_availability('ttNOTVALID',1,1,'played')
    saved=json.loads((m.DATA/m.EPISODE_AVAILABILITY_FILE).read_text())
    assert not any('http' in str(v) for v in saved.values()),'Não persistir URLs/tokens'
print('OK: 0 episódios preservados só no cadastro, estados por episódio, expiração e privacidade')
