from __future__ import annotations

from rq import Queue, Worker
from rq.connections import Connection
from redis import Redis

from app.core.config import get_settings


def main() -> None:
    settings = get_settings()
    redis_conn = Redis.from_url(settings.redis_url)

    with Connection(redis_conn):
        worker = Worker([Queue('default', connection=redis_conn)])
        worker.work()


if __name__ == '__main__':
    main()
