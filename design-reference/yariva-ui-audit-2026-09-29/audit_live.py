import subprocess,sys,time,json,xml.etree.ElementTree as E
from pathlib import Path
BASE=Path(__file__).parent/'live'
def adb(*args):
 return subprocess.run(['adb','-s','RZCW40V652L',*args],capture_output=True,text=True,timeout=20)
def snap(name):
 adb('shell','rm','-f','/sdcard/yariva-audit.xml')
 result=adb('shell','uiautomator','dump','/sdcard/yariva-audit.xml')
 if 'dumped to' not in result.stdout:
  print(name,'HIERARCHY UNAVAILABLE',result.stdout,result.stderr,flush=True);return
 p=BASE/(name+'.xml'); adb('pull','/sdcard/yariva-audit.xml',str(p))
 nodes=[]
 for n in E.parse(p).iter('node'):
  a=n.attrib; t=a.get('text') or a.get('content-desc')
  if t and not (len(t)==1 and ord(t)>0xE000):
   nodes.append({'text':t,'bounds':a['bounds'],'clickable':a.get('clickable')=='true','checked':a.get('checked')=='true'})
 (BASE/(name+'.json')).write_text(json.dumps(nodes,indent=2))
 print(name, json.dumps(list(dict.fromkeys(n["text"] for n in nodes)),ensure_ascii=False), flush=True)
if sys.argv[1]=='route':
 for path in sys.argv[2:]:
  adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','yariva://'+path,'-p','com.aroha.mobile')
  time.sleep(1.2); snap(path.replace('/','-') or 'root')
elif sys.argv[1]=='select':
 import re
 nodes=json.loads((BASE/(sys.argv[2]+'.json')).read_text())
 node=next(n for n in nodes if n['text']==sys.argv[3])
 x1,y1,x2,y2=map(int,re.findall(r'\d+',node['bounds']))
 adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2));time.sleep(1.2);snap(sys.argv[4])
elif sys.argv[1]=='back':
 adb('shell','input','keyevent','4');time.sleep(.5);snap(sys.argv[2])
elif sys.argv[1]=='tap':
 adb('shell','input','tap',sys.argv[2],sys.argv[3]);time.sleep(1);snap(sys.argv[4])
elif sys.argv[1]=='scroll':
 adb('shell','input','swipe','550','1740','550','650','400'); time.sleep(.4); snap(sys.argv[2])
elif sys.argv[1]=='snap': snap(sys.argv[2])
