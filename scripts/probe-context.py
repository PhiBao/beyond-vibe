#!/usr/bin/env python3
"""Probe whether the supplied token can reach Sanity Context, and whether the
dataset is public. Run: python3 probe-context.py"""

import json
import os
import urllib.error
import urllib.request

TOKEN = os.environ["SANITY_TOKEN"]
ORG = os.environ.get("SANITY_ORG_ID", "ovihgdwkx")
PROJECT = "jvgi63fz"
DATASET = "production"


def call(url, token=None, body=None, headers=None, label=""):
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, data, timeout=30) as res:
            text = res.read().decode()[:600]
            print(f"{label:<46} HTTP {res.status}  {text}")
            return res.status, text
    except urllib.error.HTTPError as e:
        text = e.read().decode()[:600]
        print(f"{label:<46} HTTP {e.code}  {text}")
        return e.code, text
    except Exception as e:  # noqa: BLE001
        print(f"{label:<46} ERR {e}")
        return None, str(e)


print("=== dataset visibility ===")
call(
    f"https://{PROJECT}.api.sanity.io/v2023-05-03/data/query/{DATASET}",
    body={"query": 'count(*[_type == "allowance"])'},
    label="unauthenticated read",
)

print("\n=== context api discovery ===")
for path in (
    f"v1/context/organizations/{ORG}/mcp",
    f"v1/context/organizations/{ORG}",
    f"v1/context/organizations/{ORG}/knowledge-bases",
    f"v1/context/organizations/{ORG}/mcp/endpoints",
):
    call(f"https://api.sanity.io/{path}", token=TOKEN, label=f"GET {path}")

print("\n=== tools/list on a plausible endpoint name ===")
for name in ("ninety", "default", "main", "content"):
    call(
        f"https://api.sanity.io/v1/context/organizations/{ORG}/mcp/{name}",
        token=TOKEN,
        body={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        headers={"Accept": "application/json, text/event-stream"},
        label=f"tools/list {name}",
    )