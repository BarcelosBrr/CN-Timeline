"""Regressões v1.01: mapeamento, acervo inteligente, seleção rápida."""
import sys,unittest,time
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import server,research
class TestV101(unittest.TestCase):
    def test_mapping_preinstalled(self):
        seeds=server.read_json('stremio_series_ids_seed.json')
        self.assertGreaterEqual(len(seeds),25)
        with patch.object(server,'safe_json_get',side_effect=AssertionError('não pode usar rede')):
            self.assertEqual(server.tvmaze_series_info({'searchName':'Adventure Time'}),(290,'tt1305826'))
            self.assertEqual(server.tvmaze_series_info({'searchName':'The Tom and Jerry Show'}),(4296,'tt3559124'))

    def test_research_no_keyword_no_internet(self):
        with patch.object(research,'_json',side_effect=TimeoutError):
            res=research.search(2017,'vinhetas','')
        self.assertTrue(res['items'])
        self.assertLessEqual(len(res['items']),5)
        self.assertTrue(all(not x['mayImport'] for x in res['items']))
        self.assertTrue(all(x['yearRequested']==2017 for x in res['items']))
        self.assertEqual(len(res['discoveryLinks']),3)

    def test_no_claim_future_as_current(self):
        self.assertTrue(server.stream_label_is_future_or_spinoff('Regular Show The Lost Tapes 2026','Apenas um Show',2019))
        self.assertFalse(server.stream_label_is_future_or_spinoff('Regular Show S01E03 720p','Apenas um Show',2019))

    def test_stream_label_must_match_cartoon_identity_and_episode(self):
        self.assertFalse(server.stream_label_matches_expected_episode('Dexter S01E01 720p','O Laboratório de Dexter',1,1))
        self.assertTrue(server.stream_label_matches_expected_episode('O Laboratório de Dexter T01 EP01 720p','O Laboratório de Dexter',1,1))
        self.assertFalse(server.stream_label_matches_expected_episode('Dragon Ball Super T05 EP25 1080p','Dragon Ball Super',5,26,102))
        self.assertTrue(server.stream_label_matches_expected_episode('Dragon Ball Super T05 EP26 (Ep. 102) 1080p','Dragon Ball Super',5,26,102))

    def test_verification_uses_synced_episodes_not_only_config_ids(self):
        import tempfile,json
        from pathlib import Path
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            episodes=[]
            for j,(imdb,show) in enumerate([('tt1305826','Hora de Aventura'),('tt2771780','Jovens Titãs em Ação'),('tt4215734','Que Legal, Scooby-Doo!')]):
                episodes.append({'id':f'stremio:{imdb}:1:1','source':'stremio','kind':'episode','imdbId':imdb,
                    'show':show,'season':1,'episode':1,'releaseDate':'2015-01-01'})
            (root/'stremio_episodios.json').write_text(json.dumps({'media':episodes}))
            with patch.object(server,'DATA',root),patch.object(server,'resolve_stremio',return_value={'ok':True,'url':'https://example.com/a.mp4'}):
                self.assertTrue(server.verify_shows_background())
                for _ in range(50):
                    if not server.AVAILABILITY_RUNNING:break
                    time.sleep(.03)
                states=json.loads((root/'stremio_series_verificadas.json').read_text())['shows']
                self.assertEqual(set(states),{'tt1305826','tt2771780','tt4215734'})
                self.assertTrue(all(x['available'] for x in states.values()))

    def test_parallel_addons_prevent_long_wait(self):
        def addon_json(url,timeout=5):
            if 'slow.test' in url:time.sleep(1.8);return {'streams':[]}
            if 'fast.test' in url:return {'streams':[{'url':'https://video.example.com/stream/episode.mp4','name':'720p'}]}
            return {}
        fake=[{'name':'Lento','manifest':'https://slow.test/manifest.json','base':'https://slow.test/'},
              {'name':'Rápido','manifest':'https://fast.test/manifest.json','base':'https://fast.test/'}]
        with patch.object(server,'stremio_sources',return_value=fake),patch.object(server,'safe_json_get',side_effect=addon_json):
            a=time.monotonic();res=server.resolve_stremio('tt1710308',1,3,expected_show='Apenas um Show',selected_year=2019)
            elapsed=time.monotonic()-a
        self.assertTrue(res['ok'],res)
        self.assertEqual(res['provider'],'Rápido')
        self.assertLess(elapsed,1.2)

if __name__=='__main__':unittest.main()
