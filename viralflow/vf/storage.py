"""Cloud-Dateispeicher für MP4s: Cloudflare R2 (S3-kompatibel).

Umgebungsvariablen: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (Standard viralflow-videos).
Für Tests: VF_STORAGE=local:/pfad speichert stattdessen in einen Ordner.
"""
import os
import shutil
from pathlib import Path


class Storage:
    def __init__(self):
        mode = os.environ.get('VF_STORAGE', 'r2')
        if mode.startswith('local:'):
            self.local = Path(mode[6:]); self.local.mkdir(parents=True, exist_ok=True)
            self.bucket = None
            return
        self.local = None
        import boto3
        from botocore.config import Config
        account = os.environ['R2_ACCOUNT_ID']
        self.bucket = os.environ.get('R2_BUCKET', 'viralflow-videos')
        self.s3 = boto3.client(
            's3', endpoint_url=os.environ.get('R2_ENDPOINT', f'https://{account}.r2.cloudflarestorage.com'),
            aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'], aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
            region_name='auto', config=Config(retries={'max_attempts': 8, 'mode': 'standard'}, signature_version='s3v4'),
        )

    def upload(self, path, key):
        if self.local:
            dst = self.local / key; dst.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(path, dst); return
        self.s3.upload_file(str(path), self.bucket, key, ExtraArgs={'ContentType': 'video/mp4'})

    def download(self, key, path):
        if self.local:
            shutil.copyfile(self.local / key, path); return
        self.s3.download_file(self.bucket, key, str(path))

    def exists(self, key):
        if self.local:
            return (self.local / key).exists()
        try:
            self.s3.head_object(Bucket=self.bucket, Key=key); return True
        except Exception:
            return False
