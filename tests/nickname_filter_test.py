import tempfile, socket
"""Unit + integration tests for offline server-side nickname policy."""
import json, os, re, subprocess, urllib.request, urllib.error
from pathlib import Path
root=Path(__file__).resolve().parents[1]
# Check core canonicalization, normalization and allow-list behavior directly in Node.
source=r'''
const assert=require('node:assert/strict');
const {check,normalize}=require('./nickname-filter');
const rejected=['Hitler','H!TL3R','h.i.t.l.e.r','mUss0l1n1','naZ1','N.A.Z.I',
  'i.s.r.a.e.l.e','Netanyahu','p4l3st1na','g a z a','ebrei','ricchione',
  'f.r.o.c.i.o','f1n0cch10','n3gr0','nigger','Hamas', 'GDG', 'Admin',
  'fasc1smo','Auschwitz', 'IlDuçe'];
for(const name of rejected){assert.equal(check(name).ok,false,`Expected reject ${name}`);}
const allowed=['CodeNinja','BugHunter','DockerDad','404NotFound','CtrlZ','R1ckR0ll',
  'P1zzaPasta','CyberDuck','Nazareno','Scr1ptK1dd13','GitGud','AI', 'MemeLord'];
for(const name of allowed){assert.equal(check(name).ok,true,`Unexpected reject ${name}`);}
assert.equal(check('  Debug   Master ').name,'Debug Master');
assert.equal(check('!').ok,false);
assert.equal(normalize('N 3 G R 0'),'negro');
console.log('PASS unit nickname normalization/reject/allow');
'''
subprocess.run(['node','-e',source],cwd=root,check=True)
temporary = tempfile.TemporaryDirectory(prefix='gdg-test-')
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
test_env = {**os.environ, 'PORT': str(port), 'DATA_DIR': temporary.name,
    'NODE_ENV': 'test', 'PUBLIC_BASE_URL': '', 'RENDER_EXTERNAL_URL': '', 'ADMIN_TOKEN': ''}
p=subprocess.Popen(['node','server.js'],cwd=root,env=test_env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,text=True)
base=f'http://127.0.0.1:{port}'
def call(route,body=None):
    req=urllib.request.Request(base+route, data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type':'application/json'} if body is not None else {})
    try:
        with urllib.request.urlopen(req,timeout=6) as r:return r.status,json.loads(r.read())
    except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
try:
    pin=None
    for _ in range(30):
        line=p.stdout.readline()
        if 'Game PIN:' in line:pin=re.search(r'(\d{6})',line).group(1);break
    assert pin
    a=call('/api/join',{'pin':pin,'name':'N.3.G.R.0'})
    assert a[0]==400 and 'Nickname' in a[1]['error'],a
    b=call('/api/join',{'pin':pin,'name':'GitGud'})
    assert b[0]==200,b
    c=call('/api/join',{'pin':pin,'name':'nazareno'})
    assert c[0]==200,c
    d=call('/api/state')
    assert d[1]['playerCount']==2,d
    assert 'N.3.G.R.0' not in d[1].get('names',[]),d
    assert call('/api/join',{'pin':pin,'name':'GITGUD'})[0]==409
    print('PASS integration blocked nicknames, permitted names and no blocked player in lobby')
finally:
    p.terminate()
    try:p.wait(timeout=3)
    except subprocess.TimeoutExpired:p.kill()
    temporary.cleanup()
