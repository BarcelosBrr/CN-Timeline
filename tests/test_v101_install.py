from pathlib import Path
import tempfile,subprocess,sys,json,unittest,shutil,threading,urllib.request
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import server
class TestUpdateAndHTTP(unittest.TestCase):
 def test_installer_preserves_user_data_and_media(self):
  with tempfile.TemporaryDirectory() as folder:
   target=Path(folder)/'project';(target/'public').mkdir(parents=True);(target/'data').mkdir()
   (target/'server.py').write_text('old code')
   (target/'media'/'vinhetas'/'2017').mkdir(parents=True)
   (target/'media'/'vinhetas'/'2017'/'clip.mp4').write_bytes(b'USER VIDEO MUST NOT CHANGE')
   (target/'data'/'stremio_episodios.json').write_text('{"media":[{"id":"stremio:saved"}]}')
   (target/'data'/'stremio_series_ids.json').write_text('{"Meus IDs":{"tvmazeId":100,"imdbId":"tt1234567"}}')
   p=subprocess.run([sys.executable,str(ROOT/'atualizar.py'),str(target)],capture_output=True,text=True)
   self.assertEqual(p.returncode,0,p.stderr+' '+p.stdout)
   self.assertEqual((target/'media'/'vinhetas'/'2017'/'clip.mp4').read_bytes(),b'USER VIDEO MUST NOT CHANGE')
   self.assertIn('stremio:saved',(target/'data'/'stremio_episodios.json').read_text())
   self.assertIn('Meus IDs',(target/'data'/'stremio_series_ids.json').read_text())
   self.assertGreater(len(json.loads((target/'data'/'stremio_series_ids_seed.json').read_text())),20)

 def test_routes_local(self):
  # Instantiate without main (which starts background web sync); test API behavior.
  from http.server import ThreadingHTTPServer
  httpd=ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
  t=threading.Thread(target=httpd.serve_forever,daemon=True);t.start()
  try:
   base='http://127.0.0.1:'+str(httpd.server_address[1])
   for path in ('/api/catalog','/api/sync/status','/app.js'):
    with urllib.request.urlopen(base+path,timeout=6) as r:self.assertEqual(r.status,200)
  finally:httpd.shutdown();httpd.server_close()
if __name__=='__main__':unittest.main()
