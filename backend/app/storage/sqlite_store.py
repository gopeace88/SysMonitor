import sqlite3
import time
from pathlib import Path


class SQLiteStore:
    def __init__(self, db_path: Path):
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db_path = str(db_path)
        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS metrics_1m (
                    server_id TEXT,
                    timestamp INTEGER,
                    metric_type TEXT,
                    metric_name TEXT,
                    value REAL,
                    PRIMARY KEY (server_id, timestamp, metric_type, metric_name)
                );
                CREATE TABLE IF NOT EXISTS metrics_1h (
                    server_id TEXT,
                    timestamp INTEGER,
                    metric_type TEXT,
                    metric_name TEXT,
                    avg_value REAL,
                    max_value REAL,
                    min_value REAL,
                    PRIMARY KEY (server_id, timestamp, metric_type, metric_name)
                );
                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id TEXT,
                    severity TEXT,
                    type TEXT,
                    message TEXT,
                    created_at INTEGER,
                    resolved_at INTEGER,
                    acknowledged INTEGER DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_m1m ON metrics_1m(server_id, timestamp);
                CREATE INDEX IF NOT EXISTS idx_m1h ON metrics_1h(server_id, timestamp);
            """)

    def write_metric(self, server_id: str, metric_type: str, metric_name: str,
                     value: float, timestamp: int):
        with self._conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO metrics_1m VALUES (?,?,?,?,?)",
                (server_id, timestamp, metric_type, metric_name, value),
            )

    def read_metrics(self, server_id: str, metric_type: str, metric_name: str,
                     ts_from: int, ts_to: int) -> list:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT timestamp, value FROM metrics_1m WHERE server_id=? AND metric_type=? AND metric_name=? AND timestamp BETWEEN ? AND ? ORDER BY timestamp",
                (server_id, metric_type, metric_name, ts_from, ts_to),
            ).fetchall()
            return [dict(r) for r in rows]

    def write_alert(self, server_id: str, severity: str, alert_type: str, message: str) -> int:
        with self._conn() as conn:
            cur = conn.execute(
                "INSERT INTO alerts (server_id, severity, type, message, created_at) VALUES (?,?,?,?,?)",
                (server_id, severity, alert_type, message, int(time.time())),
            )
            return cur.lastrowid

    def resolve_alert(self, alert_id: int):
        with self._conn() as conn:
            conn.execute(
                "UPDATE alerts SET resolved_at=? WHERE id=?",
                (int(time.time()), alert_id),
            )

    def get_active_alerts(self) -> list:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM alerts WHERE resolved_at IS NULL ORDER BY created_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    def get_all_alerts(self, limit: int = 50) -> list:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
            return [dict(r) for r in rows]

    def acknowledge_alert(self, alert_id: int):
        with self._conn() as conn:
            conn.execute("UPDATE alerts SET acknowledged=1 WHERE id=?", (alert_id,))

    def cleanup_old(self, days_1m: int = 30):
        now = int(time.time())
        with self._conn() as conn:
            conn.execute("DELETE FROM metrics_1m WHERE timestamp < ?", (now - days_1m * 86400,))
