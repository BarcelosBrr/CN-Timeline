import importlib.util,sys,tempfile,unittest, json
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE))
import research
class TestResearch(unittest.TestCase):
 def test_guard(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t)
   with self.assertRaises(ValueError):research.trim_local(root,{'file':'../../etc/passwd','rightsConfirmed':True,'start':0,'end':10})
   with self.assertRaises(ValueError):research.import_archive(root,{'identifier':'unknown','rightsConfirmed':False})
 def test_license(self):
  self.assertTrue(research._license_ok('https://creativecommons.org/licenses/by/4.0/'))
  self.assertFalse(research._license_ok('https://example.com/custom-terms'))
 def test_clip_and_ffmpeg(self):
  import subprocess, shutil
  if not shutil.which('ffmpeg'):self.skipTest('FFmpeg não disponível')
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);source=root/'pendentes'/'compilacoes';source.mkdir(parents=True)
   subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=yellow:s=320x180:r=10',
      '-f','lavfi','-i','sine=frequency=440','-t','4','-c:v','libx264','-c:a','aac','-y',str(source/'a.mp4')],
      check=True,stdout=subprocess.DEVNULL,timeout=15)
   r=research.trim_local(root,{'file':'a.mp4','kind':'vinhetas','year':2017,'title':'Teste CN','start':.5,'end':2,
    'rightsConfirmed':True})
   self.assertTrue((root/r['file']).is_file())
if __name__=='__main__':unittest.main()
