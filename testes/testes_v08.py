"""Testes determinísticos off-line do adaptador Stremio, sem acessar addons externos."""
import importlib.util
import json
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('server_v08',ROOT/'server.py')
srv=importlib.util.module_from_spec(spec);spec.loader.exec_module(srv)

class StremioTests(unittest.TestCase):
    def setUp(self):srv.STREAM_CACHE.clear()
    def mocked(self,kind):
        def fake(url,timeout=6):
            if url.endswith('manifest.json'):
                return {'types':['movie','series'],'resources':['stream'],'idPrefixes':['tt'],'name':'Provider'}
            if 'fenixhub.online/' in url:
                if kind=='first':return {'streams':[{'url':'https://cdn.example.com/episode.mp4'}]}
                raise ValueError('falha Fenix')
            if 'cloutteam.com/' in url:
                if kind=='torrent':return {'streams':[{'infoHash':'a'*40,'fileIdx':1}]}
                return {'streams':[{'url':'https://cdn.example.org/seg.m3u8'}]}
            return {'streams':[{'infoHash':'b'*40}]}
        return fake
    def test_priority_first(self):
        with patch.object(srv,'safe_json_get',self.mocked('first')):
            result=srv.resolve_stremio('tt1942683',1,3)
            self.assertTrue(result['ok']);self.assertEqual(result['provider'],'FenixFlix')
    def test_secondary_when_first_unavailable(self):
        with patch.object(srv,'safe_json_get',self.mocked('second')):
            result=srv.resolve_stremio('tt1942683',1,3)
            self.assertTrue(result['ok']);self.assertEqual(result['provider'],'FrostStream');self.assertEqual(result['format'],'hls')
    def test_exclude_failed_provider(self):
        with patch.object(srv,'safe_json_get',self.mocked('first')):
            result=srv.resolve_stremio('tt1942683',1,3,exclude_providers=['FenixFlix'])
            self.assertTrue(result['ok']);self.assertEqual(result['provider'],'FrostStream')
    def test_http_mp4_and_all_candidates(self):
        def fake(url,timeout=6):
            if url.endswith('manifest.json'):
                return {'types':['movie','series'],'resources':['stream'],'idPrefixes':['tt']}
            if 'fenixhub.online/' in url:
                return {'streams':[{'url':f'http://fenixflix.fenixhub.online/show/video{n}.mp4'} for n in range(1,6)]}
            return {'streams':[]}
        with patch.object(srv,'safe_json_get',fake):
            result=srv.resolve_stremio('tt1942683',1,1)
            self.assertTrue(result['ok']);self.assertEqual(result['provider'],'FenixFlix')
            self.assertEqual(len(result['candidates']),5)
            self.assertTrue(all(c['url'].startswith('http://') for c in result['candidates']))
    def test_skips_explicit_not_web_ready(self):
        self.assertTrue(srv.stream_is_html5_candidate({'url':'http://example.com/v.mp4','behaviorHints':{'notWebReady':True}}))
        self.assertFalse(srv.stream_is_html5_candidate({'url':'https://example.com/v.mp4','behaviorHints':{'notWebReady':True}}))
        self.assertFalse(srv.stream_is_html5_candidate({'url':'http://example.com/v.mp4','behaviorHints':{'proxyHeaders':{'request':{'Referer':'x'}}}}))
        self.assertTrue(srv.stream_is_html5_candidate({'url':'http://example.com/v.mp4'}))
    def test_torrent_only_not_exposed_to_html5(self):
        with patch.object(srv,'safe_json_get',self.mocked('torrent')):
            result=srv.resolve_stremio('tt1942683',1,3)
            self.assertFalse(result['ok']);self.assertIn('torrent',result['reason'])
    def test_reject_invalid_ids_and_private_urls(self):
        self.assertFalse(srv.resolve_stremio('../etc',1,1)['ok'])
        self.assertFalse(srv.playable_url('https://127.0.0.1:3000/private.mp4'))
        self.assertTrue(srv.playable_url('http://example.com/a.mp4'))
        self.assertFalse(srv.playable_url('http://127.0.0.1:3000/a.mp4'))
        self.assertFalse(srv.playable_url('http://example.com/a.html'))
        self.assertTrue(srv.playable_url('https://example.com/a.mp4'))
    def test_yearly_folders(self):
        for cat in ('vinhetas','promos','chamadas','especiais','anuncios','propagandas'):
            for y in range(2015,2022):self.assertTrue((srv.MEDIA/cat/str(y)).is_dir())
        cfg=srv.stremio_sources()
        self.assertEqual([x['name'] for x in cfg],['FenixFlix','FrostStream','Brazuca Torrents','Magnetflix'])
    def test_catalog_pending_promos(self):
        assets=srv.make_catalog()
        pending=[x for x in assets if '/pendentes/' in x['id']]
        self.assertGreaterEqual(len(pending),2)
        self.assertTrue(all(x['enabled'] is False for x in pending))

if __name__=='__main__':unittest.main(verbosity=2)
