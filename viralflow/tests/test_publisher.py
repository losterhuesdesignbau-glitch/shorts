"""Publisher-Tests gegen die Plattform-Mocks (python -m unittest discover -s viralflow/tests)."""
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

from mock_cloud import MockCloud

META = {
    'title': 'Test', 'description': 'Beschreibung', 'hashtags': ['test'],
    'youtube': {'title': 'Test #Shorts', 'description': 'Beschreibung #test', 'tags': ['test'], 'categoryId': '24'},
    'instagram': {'caption': 'Test\n\n#test #reels'},
    'tiktok': {'title': 'Test #fyp'},
}
SETTINGS = {'youtube_privacy': 'public', 'tiktok_mode': 'auto', 'tiktok_privacy': 'PUBLIC_TO_EVERYONE'}


def make_video(path, w=1080, h=1920, secs=4):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', f'testsrc=size={w}x{h}:rate=30:duration={secs}',
                    '-f', 'lavfi', '-i', f'sine=frequency=440:duration={secs}', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-shortest', str(path)], check=True)


class PublisherTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mc = MockCloud().start()
        os.environ.update(cls.mc.env())
        # Module erst nach dem Setzen der Basis-URLs laden
        global youtube, instagram, tiktok, validate, PublishError
        from vf.platforms import youtube, instagram, tiktok  # noqa
        from vf.platforms.base import PublishError  # noqa
        from vf import validate  # noqa
        cls.tmp = Path(tempfile.mkdtemp())
        cls.video = cls.tmp / 'v.mp4'
        make_video(cls.video)
        cls.size = cls.video.stat().st_size

    @classmethod
    def tearDownClass(cls):
        cls.mc.stop()

    def test_validate_ok(self):
        info, warn = validate.check(self.video, validate.sha256_file(self.video))
        self.assertEqual((info['width'], info['height']), (1080, 1920))
        self.assertEqual(warn, [])

    def test_validate_bad_checksum(self):
        with self.assertRaises(validate.InvalidVideo):
            validate.check(self.video, '0' * 64)

    def test_validate_wrong_ratio_warns(self):
        p = self.tmp / 'wide.mp4'
        make_video(p, 1280, 720, 3)
        _, warn = validate.check(p)
        self.assertTrue(any('9:16' in w for w in warn))

    def test_youtube_upload_and_dedupe(self):
        tok = {'access_token': 't'}
        r = youtube.publish(self.video, self.size, tok, META, SETTINGS, 'vid1:youtube', 0)
        self.assertEqual(r['privacy'], 'private')  # wie ein nicht geprüftes Google-Projekt
        self.assertEqual(self.mc.uploads['youtube'][-1]['bytes'], self.size)
        n = len(self.mc.uploads['youtube'])
        r2 = youtube.publish(self.video, self.size, tok, META, SETTINGS, 'vid1:youtube', 1)  # Wiederholung nach unklarem Abbruch
        self.assertEqual(r2['remote_id'], r['remote_id'])
        self.assertEqual(len(self.mc.uploads['youtube']), n, 'kein doppelter Upload')

    def test_instagram_reel(self):
        r = instagram.publish(self.video, self.size, {'access_token': 't', 'account_id': '178', 'graph_version': 'v24.0'}, META, SETTINGS, 'vid1:instagram', 0)
        self.assertTrue(r['remote_url'].startswith('https://www.instagram.com/reel/'))
        self.assertEqual(self.mc.uploads['instagram'][-1]['bytes'], self.size)

    def test_tiktok_falls_back_to_draft(self):
        r = tiktok.publish(self.video, self.size, {'access_token': 't'}, META, SETTINGS, 'vid1:tiktok', 0)
        self.assertEqual(r['privacy'], 'DRAFT')
        self.assertIn('Entwurf', r['note'])

    def test_tiktok_direct_only_raises(self):
        with self.assertRaises(PublishError):
            tiktok.publish(self.video, self.size, {'access_token': 't'}, META, {**SETTINGS, 'tiktok_mode': 'direct'}, 'vid2:tiktok', 0)


if __name__ == '__main__':
    unittest.main()
