"""Exercise the deployed illustrated simulator using actual rendered frames."""
import base64
import json
import os
import time
import uuid
from pathlib import Path
import requests

base = os.environ.get('CYPHER_TEST_URL', 'http://32.236.193.160:3000')
session = requests.Session()
def call(method, path, **kwargs):
    response = session.request(method, base + path, timeout=25, **kwargs)
    response.raise_for_status()
    return response.json()

print('Health:', call('GET', '/ai/health'), flush=True)
auth = call('POST', '/api/auth/login', json={'email': os.environ.get('CYPHER_TEST_EMAIL', 'admin@cypher.local'), 'password': os.environ.get('CYPHER_TEST_PASSWORD', 'changeme')})
session.headers['Authorization'] = 'Bearer ' + auth['token']
cameras = call('GET', '/api/cameras')
camera = next(c for c in cameras if c['active'])
frames = Path(__file__).resolve().parents[1] / 'artifacts/simulation-frames'
expected = {'knife-approach': 'CRITICAL', 'knife-held': 'HIGH', 'bottle': 'SAFE', 'phone': 'SAFE', 'walk': 'SAFE', 'fall': 'HIGH', 'unclear': 'MEDIUM', 'bag': 'MEDIUM', 'obscured': 'LOW'}
created = []
for scenario, priority in expected.items():
    event = 'verify-' + uuid.uuid4().hex
    for sequence in range(4):
        payload = dict(camera_id=camera['id'], session_id=event, sequence=sequence, frame_base64=base64.b64encode((frames / f'{scenario}-{sequence}.png').read_bytes()).decode())
        result = call('POST', '/ai/analyze', json=payload)
        time.sleep(.3)
    assert result['priority'] == priority, (scenario, result)
    saved = result.get('created_incident')
    assert bool(saved) == (priority != 'SAFE'), (scenario, result)
    if saved:
        assert saved['priority'] == priority, (scenario, saved)
        created.append(saved['id'])
    repeat = call('POST', '/ai/analyze', json=payload)
    assert repeat == result
    print(scenario, priority, 'incident', saved['id'] if saved else 'none', flush=True)

incident = created[0]
for action in ('assign', 'note', 'escalate'):
    record = call('PATCH', f'/api/incidents/{incident}/review', json={'action': action, 'note': 'Deployment verification: pixel inference and review workflow tested.'})
    assert record['id'] == incident
record = call('PATCH', f'/api/incidents/{incident}/status', json={'status': 'ACKNOWLEDGED'})
assert record['status'] == 'ACKNOWLEDGED'
record = call('PATCH', f'/api/incidents/{incident}/status', json={'status': 'RESOLVED'})
assert record['status'] == 'RESOLVED'
persisted = next(i for i in call('GET', '/api/incidents') if i['id'] == incident)
assert persisted['status'] == 'RESOLVED' and persisted['priority'] == 'CRITICAL'
assert len(persisted['metadata']['timeline']) >= 5
print('Review actions persisted; dashboard:', call('GET', '/api/dashboard/stats'), flush=True)
print(json.dumps({'verified_scenarios': 9, 'created_test_incidents': created, 'reviewed_incident': incident}))
