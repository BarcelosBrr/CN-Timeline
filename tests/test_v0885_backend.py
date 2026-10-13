import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))
import server
class Fixes0885(unittest.TestCase):
 def test_sync_offline_preserves_previous(self):
  with tempfile.TemporaryDirectory() as t:
   folder=Path(t)
   previous={'media':[{'id':'stremio:tt1942683:1:3','source':'stremio','kind':'episode','releaseDate':'2015-01-01'}]}
   (folder/'stremio_episodios.json').write_text(json.dumps(previous))
   (folder/'stremio_series.json').write_text(json.dumps({'enabled':True,'series':[{'show':'Gumball','tvmazeId':3134,'imdbId':'tt1942683'}]}))
   (folder/'episodios_tematicos.json').write_text('{}')
   with patch.object(server,'DATA',folder),patch.object(server,'safe_json_get',side_effect=OSError('offline')):
    result=server.sync_stremio_episodes()
   after=json.loads((folder/'stremio_episodios.json').read_text())
   self.assertTrue(result['ok']);self.assertEqual(result['count'],1)
   self.assertEqual(after['media'][0]['id'],previous['media'][0]['id'])
 def test_manifest_error_does_not_prevent_stream_endpoint(self):
  addon={'name':'Test','manifest':'https://stremio.example/manifest.json','base':'https://stremio.example/'}
  def fake(url,timeout=6):
   if url.endswith('manifest.json'):raise server.urllib.error.HTTPError(url,403,'Forbidden',{},None)
   if '/stream/' in url:return {'streams':[{'url':'http://stremio.example/video.mp4'}]}
   raise ValueError(url)
  with patch.object(server,'stremio_sources',return_value=[addon]),patch.object(server,'safe_json_get',side_effect=fake),patch.object(server,'STREAM_CACHE',{}),patch.object(server,'ADDON_BACKOFF',{}):
   outcome=server.resolve_stremio('tt1942683',1,1)
  self.assertTrue(outcome['ok']);self.assertEqual(outcome['provider'],'Test')
if __name__=='__main__':unittest.main()
