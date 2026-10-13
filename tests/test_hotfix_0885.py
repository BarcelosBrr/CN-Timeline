"""Testes de regressão sem internet do hotfix 0.8.85."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server

class CatalogFixTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.data=Path(self.tmp.name)
        self.old=server.DATA
        server.DATA=self.data
        server.json_atomic('stremio_series.json',{'enabled':True,'series':[{
          'show':'O Incrível Mundo de Gumball','tvmazeId':3134,'imdbId':'tt1942683',
          'earliestBR':'2015-01-01','episodeMinutes':11
        }]})
        server.json_atomic('stremio.json',{'enabled':True,'addons':[]})
        server.STREAM_CACHE.clear()
    def tearDown(self):
        server.DATA=self.old
        self.tmp.cleanup()
    def fake_fetch(self,url,timeout=6):
        if 'api.tvmaze.com' in url:raise TimeoutError('simulated TVmaze outage')
        if 'v3-cinemeta.strem.io' in url:return {'meta':{'videos':[
            {'season':1,'episode':1,'released':'2011-05-03T00:00:00.000Z','title':'The DVD','runtime':11},
            {'season':6,'episode':10,'released':'2022-01-01T00:00:00.000Z','title':'Future','runtime':11}
        ]}}
        raise AssertionError(url)
    def test_tvmaze_down_cinemeta_bootstraps(self):
        with patch.object(server,'safe_json_get',side_effect=self.fake_fetch):
            result=server.sync_stremio_episodes()
        self.assertTrue(result['ok'])
        self.assertEqual(result['count'],1)
        asset=server.make_catalog()
        items=[x for x in asset if x.get('source')=='stremio']
        self.assertEqual(len(items),1)
        self.assertTrue(items[0]['enabled'])
        self.assertEqual(items[0]['releaseDate'],'2015-01-01')
    def test_existing_cache_survives_outages(self):
        server.json_atomic('stremio_episodios.json',{'media':[{
            'id':'stremio:tt1942683:1:1','kind':'episode','source':'stremio',
            'path':'stremio:tt1942683:1:1','show':'O Incrível Mundo de Gumball',
            'name':'Gumball · Piloto','imdbId':'tt1942683','season':1,'episode':1,
            'duration':660,'releaseDate':'2015-01-01','enabled':True,'years':[]
        }]})
        with patch.object(server,'safe_json_get',side_effect=TimeoutError('offline')):
            result=server.sync_stremio_episodes()
        self.assertTrue(result['ok'])
        self.assertEqual(result['count'],1)
        self.assertTrue(any(x.get('id')=='stremio:tt1942683:1:1' and x['enabled'] for x in server.make_catalog()))
    def test_http_mp4_from_fenix_remains_candidate(self):
        with patch.object(server,'stremio_sources',return_value=[{
            'name':'FenixFlix','manifest':'https://example.test/manifest.json',
            'base':'https://example.test/'
        }]),patch.object(server,'safe_json_get',side_effect=lambda url,timeout=6:
            {'types':['series'],'resources':['stream']} if url.endswith('manifest.json')
            else {'streams':[{'url':'http://203.0.113.5/videos/test.mp4'}]}),patch.object(server,'playable_url',return_value=True):
            result=server.resolve_stremio('tt1942683',1,1)
        self.assertTrue(result['ok'])
        self.assertEqual(result['provider'],'FenixFlix')

if __name__=='__main__': unittest.main()
