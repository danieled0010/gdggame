import tempfile, socket
"""Integration checks for the v2 presenter control and optional focus policy."""
import json, os, re, subprocess, time, urllib.request, urllib.error
from pathlib import Path
root=Path(__file__).resolve().parents[1]
temporary = tempfile.TemporaryDirectory(prefix='gdg-test-')
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
test_env = {**os.environ, 'PORT': str(port), 'DATA_DIR': temporary.name,
    'NODE_ENV': 'test', 'PUBLIC_BASE_URL': '', 'RENDER_EXTERNAL_URL': '', 'ADMIN_TOKEN': ''}
p=subprocess.Popen(['node','server.js'], cwd=root, env=test_env, stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
base=f'http://127.0.0.1:{port}'
def call(route, body=None):
    req=urllib.request.Request(base+route,data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type':'application/json'} if body is not None else {})
    try:
        with urllib.request.urlopen(req,timeout=6) as r:
            raw=r.read()
            return r.status,json.loads(raw) if r.headers.get('Content-Type','').startswith('application/json') else raw
    except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
try:
    key=pin=None
    for _ in range(25):
        line=p.stdout.readline()
        if 'Host control:' in line:key=re.search(r'#key=([0-9a-f]+)',line).group(1)
        if 'Game PIN:' in line:pin=re.search(r'(\d{6})',line).group(1)
        if key and pin:break
    assert key and pin
    host=lambda action, **kw:call('/api/host',dict(key=key,action=action,**kw))
    assert host('setFocusMode',mode='penalty')[0]==200
    assert call('/api/state')[1]['focusMode']=='penalty'
    assert host('showLeaderboard')[0]==409
    player=call('/api/join',{'pin':pin,'name':'Tester'})[1]
    player_id=player['id']
    focus=lambda action,qid:call('/api/focus',{'id':player_id,'token':player['token'],'action':action,'questionId':qid})
    assert host('next')[0]==200
    assert host('setFocusMode',mode='warn')[0]==409
    assert host('showLeaderboard')[0]==409
    current=call('/api/state')[1]; assert current['phase']=='question'
    qid=current['question']['id']
    assert call('/api/answer',{'id':player_id,'token':player['token'],'choice':1})[0]==200
    assert focus('away',qid)[0]==200
    time.sleep(.1)
    assert focus('return',qid)[1]['warningCount']==0
    score=call('/api/state?role=player&id='+player_id+'&token='+player['token'])[1]['me']['score']
    assert score>=1000
    assert host('next')[0]==200
    assert host('showLeaderboard')[0]==200
    assert call('/api/state')[1]['phase']=='leaderboard'
    assert host('hideLeaderboard')[0]==200
    assert call('/api/state')[1]['phase']=='reveal'
    assert host('next')[0]==200
    assert call('/api/state')[1]['question']['number']==2
    # Brief focus loss is ignored, sustained loss gets one flag per question.
    for idx in range(2,6):
        current=call('/api/state')[1];qid=current['question']['id'];assert current['question']['number']==idx
        if idx==2:
            focus('away',qid);time.sleep(.1);assert focus('return',qid)[1]['warningCount']==0
        assert focus('away',qid)[0]==200
        time.sleep(2.60)
        result=focus('return',qid)
        assert result[1]['warningCount']==idx-1,(idx,result)
        # Even a later incident in the same round doesn't double-count.
        focus('away',qid);time.sleep(.05)
        assert focus('return',qid)[1]['warningCount']==idx-1
        me=call('/api/state?role=player&id='+player_id+'&token='+player['token'])[1]['me']
        assert me['focusWarnings']==idx-1
        if idx==5:
            assert me['focusPenalty']==500 and me['score']==score-500,me
        assert host('next')[0]==200
        assert call('/api/state')[1]['phase']=='reveal'
        assert host('next')[0]==200
        assert call('/api/state')[1]['phase']=='question'
    # Demonstrate no mandatory every-third leaderboard.
    current=call('/api/state')[1];assert current['question']['number']==6
    assert host('next')[0]==200
    assert host('next')[0]==200
    assert call('/api/state')[1]['question']['number']==7
    assert host('reset',confirm='RESET')[0]==200
    assert call('/api/state')[1]['focusMode']=='warn'
    print('PASS: manual leaderboard, no automatic leaderboard, optional lobby-only penalty mode, short-ignore threshold, once/round focus warnings, fourth −500, reset')
finally:
    p.terminate()
    try:p.wait(timeout=4)
    except subprocess.TimeoutExpired:p.kill()
    temporary.cleanup()
