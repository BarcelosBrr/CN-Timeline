"""Testes offline; executar: python tests/test_backend.py"""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import server


class TimelineServerTests(unittest.TestCase):
    def test_fuzzy_reboot_must_not_match_old_version(self):
        rows = [
            {'show': {'id': 1, 'name': 'Ben 10', 'premiered': '2005-12-27', 'externals': {'imdb': 'tt0760437'}}},
            {'show': {'id': 2, 'name': 'Ben 10', 'premiered': '2016-10-01', 'externals': {'imdb': 'tt6148376'}}},
        ]
        with patch.object(server, 'safe_json_get', return_value=rows):
            result = server.tvmaze_series_info({'show': 'Ben 10', 'searchName': 'Ben 10', 'originalPremiereYear': 2016})
        self.assertEqual(result, (2, 'tt6148376'))

    def test_future_episodes_are_not_imported(self):
        shows = {'enabled': True, 'series': [{'show': 'Gumball', 'tvmazeId': 3134, 'imdbId': 'tt1942683', 'earliestBR': '2015-01-01', 'episodeMinutes': 11}]}
        eps = [
            {'airdate': '2013-05-01', 'season': 2, 'number': 1, 'runtime': 11},
            {'airdate': '2022-06-01', 'season': 7, 'number': 1, 'runtime': 11},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(server, 'DATA', Path(tmp)), patch.object(server, 'read_json', return_value=shows), patch.object(server, 'safe_json_get', return_value=eps), patch.object(server.time, 'sleep', return_value=None):
                response = server.sync_stremio_episodes()
                payload = (Path(tmp) / 'stremio_episodios.json').read_text(encoding='utf-8')
        self.assertTrue(response['ok'])
        self.assertEqual(response['count'], 1)
        self.assertIn('2015-01-01', payload)
        self.assertNotIn('2022-06-01', payload)

    def test_media_folders_and_date(self):
        folder = ROOT / 'media' / 'episodios' / 'o_incrivel_mundo_de_gumball' / '01_03_as_criancas_2014.mp4'
        data=server.infer_file(folder, ('episodios', 'o_incrivel_mundo_de_gumball', folder.name), 'episode')
        self.assertEqual(data['releaseDate'], '2014-01-01')
        self.assertEqual(data['season'], 1)
        self.assertEqual(data['episode'], 3)
        self.assertEqual(data['show'], 'O Incrível Mundo de Gumball')

    def test_manifest_caching(self):
        with patch.object(server, 'FETCHER') as fetcher, patch.object(server, 'MANIFEST_CACHE', {}):
            class FakeResponse:
                status=200
                headers={}
                def __enter__(self):return self
                def __exit__(self, *_):return False
                def read(self, *_):return b'{"resources": ["stream"]}'
            fetcher.open.return_value=FakeResponse()
            uri='https://example.com/manifest.json'
            server.safe_json_get(uri)
            server.safe_json_get(uri)
            self.assertEqual(fetcher.open.call_count,1)

if __name__ == '__main__': unittest.main(verbosity=2)
