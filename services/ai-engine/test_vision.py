import base64
import sys
import unittest
import time
from pathlib import Path
from unittest.mock import patch
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from app.vision import inspect_frame
from app.main import app, sessions
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
FRAMES = ROOT / 'artifacts' / 'simulation-frames'


class VisionTests(unittest.TestCase):
    def test_actual_renderer_frames(self):
        expectations = {'knife-approach': ('CRITICAL','knife'), 'knife-held': ('HIGH','knife'),
            'bottle': ('SAFE','bottle'), 'phone': ('SAFE','phone'), 'walk': ('SAFE','person'),
            'fall': ('HIGH','person'), 'unclear': ('MEDIUM','unknown_object'),
            'bag': ('MEDIUM','bag'), 'obscured': ('LOW',None)}
        for scenario, (priority, asset) in expectations.items():
            with self.subTest(scenario=scenario):
                history=[]
                for n in range(4):
                    with Image.open(FRAMES / f'{scenario}-{n}.png') as image:
                        result = inspect_frame(image.convert('RGB'), history)
                print(scenario, result['priority'], [d['asset_type'] for d in result['detections']])
                self.assertEqual(result['priority'], priority)
                if asset:
                    self.assertIn(asset,[d['asset_type'] for d in result['detections']])

    def test_frame_validation_and_idempotency(self):
        sessions.clear()
        client=TestClient(app)
        bad={'camera_id':1,'session_id':'test-bad-frame','sequence':0,'frame_base64':'x'*40}
        self.assertEqual(client.post('/analyze',json=bad).status_code,400)
        self.assertEqual(client.post('/analyze',json={**bad,'frame_base64':'x'*200001}).status_code,422)
        body={'camera_id':1,'session_id':'test-knife-sequence','sequence':0}
        with patch('app.main.submit_incident',return_value={'id':77,'priority':'CRITICAL'}) as persist:
            for n in range(4):
                body['sequence']=n
                body['frame_base64']=base64.b64encode((FRAMES/f'knife-approach-{n}.png').read_bytes()).decode()
                if body['session_id'] in sessions: sessions[body['session_id']]['seen']=time.monotonic()-.5
                result=client.post('/analyze',json=body)
                self.assertEqual(result.status_code,200,result.text)
            self.assertEqual(persist.call_count,1)
            self.assertEqual(result.json()['created_incident']['id'],77)
            repeated=client.post('/analyze',json=body)
            self.assertEqual(repeated.json(),result.json())
            self.assertEqual(persist.call_count,1)
            self.assertEqual(client.post('/analyze',json={**body,'camera_id':2,'sequence':5}).status_code,409)

    def test_safe_scene_never_persists(self):
        sessions.clear()
        client=TestClient(app)
        with patch('app.main.submit_incident') as persist:
            for n in range(4):
                key='test-safe-bottle'
                if key in sessions: sessions[key]['seen']=time.monotonic()-.5
                body={'camera_id':1,'session_id':key,'sequence':n,'frame_base64':base64.b64encode((FRAMES/f'bottle-{n}.png').read_bytes()).decode()}
                result=client.post('/analyze',json=body)
                self.assertEqual(result.status_code,200,result.text)
                self.assertEqual(result.json()['priority'],'SAFE')
            persist.assert_not_called()

if __name__=='__main__': unittest.main()
