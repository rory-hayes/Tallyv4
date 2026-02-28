from __future__ import annotations

import hashlib
from pathlib import Path

import boto3

from app.core.config import get_settings


class StorageService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._s3_client = None
        if self.settings.storage_mode == "s3":
            self._s3_client = boto3.client("s3", region_name=self.settings.aws_region)

    def _local_full_path(self, key: str) -> Path:
        return Path(self.settings.local_storage_path) / key

    def save_bytes(self, data: bytes, *, key: str) -> tuple[str, str]:
        checksum = hashlib.sha256(data).hexdigest()

        if self.settings.storage_mode == "s3":
            if not self.settings.s3_bucket_name:
                raise ValueError("s3_bucket_name must be set when storage_mode=s3")
            assert self._s3_client is not None
            self._s3_client.put_object(Bucket=self.settings.s3_bucket_name, Key=key, Body=data)
            return key, checksum

        full_path = self._local_full_path(key)
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(data)
        return key, checksum

    def read_bytes(self, key: str) -> bytes:
        if self.settings.storage_mode == "s3":
            if not self.settings.s3_bucket_name:
                raise ValueError("s3_bucket_name must be set when storage_mode=s3")
            assert self._s3_client is not None
            response = self._s3_client.get_object(Bucket=self.settings.s3_bucket_name, Key=key)
            return response["Body"].read()

        return self._local_full_path(key).read_bytes()

    def get_download_url(self, key: str) -> str:
        if self.settings.storage_mode == "s3":
            if not self.settings.s3_bucket_name:
                raise ValueError("s3_bucket_name must be set when storage_mode=s3")
            assert self._s3_client is not None
            return self._s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.settings.s3_bucket_name, "Key": key},
                ExpiresIn=3600,
            )

        return str(self._local_full_path(key).resolve())


storage_service = StorageService()
