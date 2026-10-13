"""Regressões de inicialização: acervo vazio não deve impedir a API ou limpar dados."""
import sys, unittest, tempfile, json
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import server
class GuideStartupTest(unittest.TestCase):
 def test_catalog_empty_responds_immediately(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d); (root/'media').mkdir();(root/'data').mkdir()
   with patch.object(server,'MEDIA',root/'media'),patch.object(server,'DATA',root/'data'):
    self.assertEqual(server.make_catalog(),[])
 def test_original_cache_preserved(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);root.mkdir(exist_ok=True)
   previous={'media':[{'id':'episode:1'}]};(root/'stremio_episodios.json').write_text(json.dumps(previous))
   with patch.object(server,'DATA',root):
    self.assertEqual(server.read_json('stremio_episodios.json'),previous)
 def test_mp4_native_first(self):
  self.assertIn('native_mp4_duration',server._duration_cached.__wrapped__.__code__.co_names)
if __name__=='__main__': unittest.main()
