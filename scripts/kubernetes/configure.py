#!/usr/bin/env python3
"""Apply VM-local settings without printing secrets or executing the env file."""
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlsplit


def resources(path):
    values = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, sep, value = line.partition("=")
        if not sep or key in values:
            raise ValueError("Use unique KEY=value entries without quotes")
        values[key] = value
    for key in ("POSTGRES_PASSWORD", "SESSION_SECRET"):
        if not re.fullmatch(r"[0-9a-fA-F]{64,}", values.get(key, "")):
            raise ValueError(f"{key} must contain at least 64 hexadecimal characters")
    if values["POSTGRES_PASSWORD"] == values["SESSION_SECRET"]:
        raise ValueError("Generate two different secrets")
    origin = values.get("APP_ORIGIN", "")
    url = urlsplit(origin)
    if (url.scheme != "http" or not url.hostname or url.port != 30080
            or url.path or url.query or url.fragment or url.username or url.password):
        raise ValueError("APP_ORIGIN must be http://YOUR_VM_IP:30080 without a trailing slash")
    metadata = {"namespace": "homefinder-k8s"}
    return [
        {"apiVersion": "v1", "kind": "Secret",
         "metadata": {**metadata, "name": "homefinder-secrets"},
         "type": "Opaque", "stringData": {
             "POSTGRES_PASSWORD": values["POSTGRES_PASSWORD"],
             "SESSION_SECRET": values["SESSION_SECRET"],
             "DATABASE_URL": "postgresql://homefinder:" + values["POSTGRES_PASSWORD"] + "@db:5432/homefinder",
         }},
        {"apiVersion": "v1", "kind": "ConfigMap",
         "metadata": {**metadata, "name": "homefinder-config"}, "data": {
             "NODE_ENV": "development", "APP_ORIGIN": origin,
             "TRUST_PROXY": "uniquelocal", "UPLOAD_DIR": "/app/backend/uploads",
             # Cookies are not isolated by port; avoid collisions with Compose.
             "SESSION_COOKIE_NAME": "homefinder.k8s.sid",
         }},
    ]


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python3 scripts/kubernetes/configure.py /path/to/.env")
    try:
        items = resources(Path(sys.argv[1]))
    except (ValueError, OSError) as error:
        sys.exit(str(error))
    # Server-side apply avoids storing a second copy in a last-applied annotation.
    subprocess.run(["kubectl", "apply", "--server-side", "--field-manager=homefinder-config",
                    "-f", "-"], input=json.dumps({"apiVersion": "v1", "kind": "List", "items": items}),
                   text=True, check=True)
