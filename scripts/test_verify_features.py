"""Local transport tests; these make no network requests."""
import io
import unittest
from unittest.mock import patch
import urllib.error

import verify_features


class RetryTests(unittest.TestCase):
    def client(self):
        client = verify_features.Client.__new__(verify_features.Client)
        client.token = None
        return client

    def response(self, status, retry='1'):
        return urllib.error.HTTPError('http://localhost/api/test', status, 'test',
                                      {'X-Request-ID': 'test', 'Retry-After': retry}, io.BytesIO(b'{}'))

    def test_only_429_retries_up_to_twice(self):
        with patch.object(verify_features.urllib.request, 'urlopen', side_effect=[self.response(429), self.response(429), self.response(200)]) as call, patch.object(verify_features.time, 'sleep') as sleep:
            self.assertEqual({}, self.client().post('/test', {'text': 'one note'}))
            self.assertEqual(3, call.call_count)
            self.assertEqual(2, sleep.call_count)

    def test_retry_budget_is_finite(self):
        with patch.object(verify_features.urllib.request, 'urlopen', side_effect=[self.response(429) for _ in range(3)]) as call, patch.object(verify_features.time, 'sleep'):
            with self.assertRaises(AssertionError):
                self.client().post('/test', {})
            self.assertEqual(3, call.call_count)

    def test_forbidden_and_ambiguous_write_failure_never_retry(self):
        with patch.object(verify_features.urllib.request, 'urlopen', side_effect=self.response(403)) as call, patch.object(verify_features.time, 'sleep') as sleep:
            self.client().post('/test', {}, expected=403)
            self.assertEqual(1, call.call_count)
            sleep.assert_not_called()
        with patch.object(verify_features.urllib.request, 'urlopen', side_effect=urllib.error.URLError('connection lost')) as call:
            with self.assertRaises(urllib.error.URLError):
                self.client().post('/test', {'text': 'potentially committed'})
            self.assertEqual(1, call.call_count)


class RecoveryTests(unittest.TestCase):
    def run_poll(self, responses):
        from unittest.mock import Mock
        clock = [0.0]
        client = Mock()
        client.get.side_effect = responses
        def sleep(seconds):
            clock[0] += seconds
        return client, clock, sleep

    def test_service_path_converges_with_read_only_polls(self):
        down = {'status': 'degraded', 'database': {'status': 'ok'}, 'intelligence': {'status': 'unavailable'}}
        up = {'status': 'ok', 'database': {'status': 'ok'}, 'intelligence': {'status': 'ok'}}
        client, clock, sleep = self.run_poll([down, down, up])
        with patch.object(verify_features.time, 'monotonic', side_effect=lambda: clock[0]), patch.object(verify_features.time, 'sleep', side_effect=sleep):
            self.assertEqual(up, verify_features.recovered_diagnostics(client))
        self.assertEqual(3, client.get.call_count)
        self.assertEqual(2, clock[0])
        client.post.assert_not_called()

    def test_service_path_timeout_is_bounded(self):
        down = {'status': 'degraded', 'database': {'status': 'ok'}, 'intelligence': {'status': 'unavailable'}}
        client, clock, sleep = self.run_poll(lambda path, **kwargs: down)
        with patch.object(verify_features.time, 'monotonic', side_effect=lambda: clock[0]), patch.object(verify_features.time, 'sleep', side_effect=sleep):
            with self.assertRaisesRegex(AssertionError, 'within 30 seconds'):
                verify_features.recovered_diagnostics(client)
        self.assertEqual(30, clock[0])
        self.assertEqual(30, client.get.call_count)
        client.post.assert_not_called()


if __name__ == '__main__':
    unittest.main()
