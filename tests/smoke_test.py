import tempfile, socket
"""Full local HTTP smoke test, Python stdlib only. Start the server yourself? No: this test does it."""
import json, re, subprocess, time, urllib.request, urllib.error, os, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
temporary = tempfile.TemporaryDirectory(prefix='gdg-test-')
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
test_env = {**os.environ, 'PORT': str(port), 'DATA_DIR': temporary.name,
    'NODE_ENV': 'test', 'PUBLIC_BASE_URL': '', 'RENDER_EXTERNAL_URL': '', 'ADMIN_TOKEN': ''}
p=subprocess.Popen(['node','server.js'],cwd=root,env=test_env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
base=f'http://127.0.0.1:{port}'
def query(route,body=None):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(base+route,data=data,headers={'Content-Type':'application/json'} if data else {})
    try:
        with urllib.request.urlopen(req,timeout=5) as res:
            raw=res.read()
            return res.status,json.loads(raw) if res.headers.get('Content-Type','').startswith('application/json') else raw
    except urllib.error.HTTPError as err:
        return err.code,json.loads(err.read())
try:
    key=None;pin=None
    deadline=time.time()+5
    while time.time()<deadline:
        ln=p.stdout.readline()
        if not ln: time.sleep(.1);continue
        if 'Host control:' in ln: key=re.search(r'#key=([a-f0-9]+)',ln).group(1)
        if 'Game PIN:' in ln:pin=re.search(r'(\d{6})',ln).group(1)
        if key and pin:break
    assert key and pin,'server failed to start'
    assert query('/api/config')[1]['questionCount']==12
    assert query('/api/state?role=host&key=wrong')[0]==401
    assert query('/api/qr.svg?ip=127.0.0.1')[0]==200
    assert query('/api/qr.svg?ip=8.8.8.8')[0]==400
    wrong=query('/api/join',{'name':'Sam','pin':'000000'});assert wrong[0]==403,wrong
    j1=query('/api/join',{'name':'Sam','pin':pin});j2=query('/api/join',{'name':'Ada','pin':pin})
    assert j1[0]==200 and j2[0]==200,(j1,j2)
    assert query('/api/join',{'name':'sam','pin':pin})[0]==409
    a=j1[1];b=j2[1]
    assert query('/api/host',{'key':'invalid','action':'next'})[0]==401
    assert query('/api/host',{'key':key,'action':'next'})[0]==200
    s=query('/api/state')[1];assert s['phase']=='question' and s['index']==0
    correct=1
    assert query('/api/answer',{'id':a['id'],'token':a['token'],'choice':correct})[0]==200
    assert query('/api/answer',{'id':a['id'],'token':a['token'],'choice':correct})[0]==409
    assert query('/api/answer',{'id':b['id'],'token':b['token'],'choice':0})[0]==200
    rank=query('/api/state?role=host&key='+key)[1]['players'];assert rank[0]['name']=='Sam' and rank[0]['score']>=1000
    assert query('/api/host',{'key':key,'action':'pause'})[0]==200
    assert query('/api/answer',{'id':b['id'],'token':b['token'],'choice':3})[0]==409
    assert query('/api/host',{'key':key,'action':'pause'})[0]==200
    # Run all questions, skipping the timer and simulating host-controlled advancement.
    n=0
    while True:
        s=query('/api/state')[1]
        if s['phase']=='question':
            n+=1
            assert s['question']['number']==n
            assert query('/api/host',{'key':key,'action':'next'})[0]==200
        elif s['phase'] in ('reveal','leaderboard'):
            assert query('/api/host',{'key':key,'action':'next'})[0]==200
        else:
            assert s['phase']=='finished',s
            break
        assert n<=12
    assert n==12
    assert query('/api/join',{'name':'Late','pin':pin})[0]==409
    stat=query('/api/state?role=player&id='+a['id']+'&token='+a['token'])[1]
    assert stat['me']['name']=='Sam' and stat['me']['score']>=1000
    status,csv=query('/api/export.csv?key='+key);assert status==200 and b'Sam' in csv
    assert query('/api/host',{'key':key,'action':'reset','confirm':'RESET'})[0]==200
    assert query('/api/state')[1]['phase']=='lobby'
    print('PASS: 12-question run, 2 players, PIN, duplicate protection, QR, scoring, pause, host auth, CSV, reset')
finally:
    p.terminate()
    try:p.wait(timeout=3)
    except subprocess.TimeoutExpired:p.kill()
    temporary.cleanup()
