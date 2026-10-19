"""Public-hosting integration test: 60 SSE players, safe URLs, auth and recovery."""
import http.client
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

root = Path(__file__).resolve().parents[1]
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
base = f'http://127.0.0.1:{port}'
key = 'integration-test-host-key-' + 'a' * 40
streams = []
process = None


def call(route, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(base + route, data=data,
        headers={'Content-Type': 'application/json', **(headers or {})})
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            raw = response.read()
            return response.status, json.loads(raw) if 'application/json' in response.headers.get('Content-Type', '') else raw
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read())


def live(role, **credentials):
    stream = urllib.request.urlopen(base + '/events?' + urllib.parse.urlencode({'role': role, **credentials}), timeout=8)
    assert stream.headers['Content-Type'] == 'text/event-stream'
    assert 'no-transform' in stream.headers['Cache-Control']
    streams.append(stream)
    return stream


def next_snapshot(stream, phase=None):
    for _ in range(150):
        line = stream.readline()
        assert line, 'Live stream closed unexpectedly'
        if line.startswith(b'data: '):
            snapshot = json.loads(line[6:])
            if phase is None or snapshot['phase'] == phase:
                return snapshot
    raise AssertionError('Expected snapshot not received')


def start(env):
    child = subprocess.Popen(['node', 'server.js'], cwd=root, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        if child.poll() is not None:
            raise AssertionError('Startup failed: ' + child.stdout.read())
        try:
            if call('/healthz') == (200, {'ok': True}):
                return child
        except (OSError, urllib.error.URLError):
            time.sleep(.03)
    child.kill()
    raise AssertionError('Server did not start')


def stop(child):
    for stream in streams:
        stream.close()
    streams.clear()
    child.terminate()
    logs = child.communicate(timeout=8)[0]
    assert child.returncode == 0, logs
    assert key not in logs, 'Production logs must not contain the host secret'


with tempfile.TemporaryDirectory(prefix='gdg-online-') as storage:
    env = {**os.environ, 'PORT': str(port), 'DATA_DIR': str(Path(storage) / 'new-data'),
        'NODE_ENV': 'production', 'ADMIN_TOKEN': key, 'PUBLIC_BASE_URL': '',
        'RENDER_EXTERNAL_URL': 'https://quiz.example.com'}
    try:
        process = start(env)
        config = call('/api/config')[1]
        assert config['online'] and config['joinUrl'] == 'https://quiz.example.com/join'
        assert config['ips'] == [] and key not in json.dumps(config)
        connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
        connection.request('GET', '/')
        response = connection.getresponse()
        assert response.status == 302 and response.getheader('Location') == '/join'
        assert response.getheader('Referrer-Policy') == 'no-referrer'
        response.read()
        connection.close()
        qr = call('/api/qr.svg')
        assert qr[0] == 200 and qr[1].startswith(b'<svg')
        assert call('/api/qr.svg?ip=attacker.example', headers={'Host': 'attacker.example',
            'X-Forwarded-Host': 'attacker.example'}) == qr
        for route in ('/questions.json', '/nickname-rules.json', '/data/session.json', '/.env', '/server.js'):
            assert call(route)[0] == 404, route
        assert call('/api/state?role=host&key=wrong')[0] == 401
        assert call('/api/export.csv')[0] == 401
        assert call('/events?role=host&key=wrong')[0] == 401
        assert call('/api/host', {'action': 'next'})[0] == 401
        assert call('/api/answer', {'id': '__proto__', 'choice': 0})[0] == 401
        assert call('/api/join', [1, 2])[0] == 400
        state = call('/api/state')[1]
        pin, game_id = state['pin'], state['gameId']
        players = []
        for index in range(60):
            status, player = call('/api/join', {'pin': pin, 'name': f'Player{index:02d}'})
            assert status == 200, player
            players.append(player)
        assert call('/api/join', {'pin': pin, 'name': 'ExtraPlayer'})[0] == 409
        assert call('/api/state')[1]['playerCount'] == 60
        for player in players:
            stream = live('player', id=player['id'], token=player['token'])
            assert next_snapshot(stream)['me']['id'] == player['id']
        host = lambda action, **values: call('/api/host', {'key': key, 'action': action, **values})
        assert host('next')[0] == 200
        for stream in streams:
            current = next_snapshot(stream, 'question')
            assert current['question']['id'] == 'q01'
            assert 'correctIndex' not in current and 'explanation' not in current
        correct = json.loads((root / 'questions.json').read_text())['questions'][0]['correct_index']
        for player in players:
            assert call('/api/answer', {'id': player['id'], 'token': player['token'],
                'choice': correct, 'questionId': 'q01'})[0] == 200
        assert call('/api/state')[1]['answeredCount'] == 60
        assert call('/api/answer', {'id': players[0]['id'], 'token': players[0]['token'],
            'choice': 0, 'questionId': 'q01'})[0] == 409
        assert host('next')[0] == 200
        assert call('/api/state')[1]['correctIndex'] == correct
        assert host('next')[0] == 200
        assert call('/api/answer', {'id': players[0]['id'], 'token': players[0]['token'],
            'choice': 0, 'questionId': 'q01'})[0] == 409
        assert host('pause')[0] == 200
        remaining = call('/api/state')[1]['remainingMs']
        # Shutdown must flush the most recent change, including within the debounce.
        stop(process)
        process = None
        assert (Path(env['DATA_DIR']) / 'session.json').exists()
        process = start(env)
        restored = call('/api/state')[1]
        assert restored['gameId'] == game_id and restored['pin'] == pin
        assert restored['paused'] and restored['remainingMs'] == remaining
        assert restored['question']['id'] == 'q02' and restored['playerCount'] == 60
        query = urllib.parse.urlencode({'role': 'player', 'id': players[0]['id'], 'token': players[0]['token']})
        reconnected = call('/api/state?' + query)
        assert reconnected[0] == 200 and reconnected[1]['me']['score'] >= 1000
        assert call('/api/state?role=host&key=' + key)[0] == 200
        assert host('reset', confirm='RESET')[0] == 200
        assert call('/api/state?' + query)[0] == 401
        assert call('/events?' + query)[0] == 401
        stop(process)
        process = None
        # A custom domain takes precedence over Render's default domain.
        env['PUBLIC_BASE_URL'] = 'https://custom.example.com/'
        process = start(env)
        assert call('/api/config')[1]['joinUrl'] == 'https://custom.example.com/join'
        stop(process)
        process = None
        for invalid in ({'ADMIN_TOKEN': ''}, {'ADMIN_TOKEN': 'weak'},
            {'PUBLIC_BASE_URL': 'https://user:password@example.com'},
            {'PUBLIC_BASE_URL': 'https://example.com/subpath'}, {'PUBLIC_BASE_URL': 'file:///tmp'}):
            failure = subprocess.run(['node', 'server.js'], cwd=root, env={**env, **invalid}, capture_output=True, timeout=5)
            assert failure.returncode != 0, invalid
        print('PASS: public HTTPS URLs/QR, host protection, 60 live SSE players, scoring, stale answers, session recovery and reset')
    finally:
        for stream in streams:
            stream.close()
        if process is not None and process.poll() is None:
            process.terminate()
            process.communicate(timeout=8)
