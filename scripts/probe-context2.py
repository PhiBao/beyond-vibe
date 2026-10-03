#!/usr/bin/env python3
"""Try to create a Context MCP endpoint through the REST API, and re-check dataset
visibility properly. Run: python3 probe-context2.py"""

import json
import os
import urllib.error
import urllib.request

TOKEN = os.environ["SANITY_TOKEN"]
ORG = os.environ.get("SANITY_ORG_ID", "ovihgdwkx")
PROJECT = "jvgi63fz"
DATASET = "production"
API = "https://api.sanity.io"


def call(method, path, body=None, headers=None, label="", raw=False):
    url = path if path.startswith("http") else f"{API}{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, data, timeout=30) as res:
            text = res.read().decode()
            print(f"[{method}] {label:<52} HTTP {res.status}")
            print("      " + (text if raw else text[:700]))
            return res.status, text
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        print(f"[{method}] {label:<52} HTTP {e.code}")
        print("      " + (text if raw else text[:700]))
        return e.code, text
    except Exception as e:  # noqa: BLE001
        print(f"[{method}] {label:<52} ERR {e}")
        return None, str(e)


print("=== dataset visibility: all docs, with and without token ===")


def anon(query):
    req = urllib.request.Request(
        f"https://{PROJECT}.api.sanity.io/v2023-05-03/data/query/{DATASET}",
        data=json.dumps({"query": query}).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            return res.read().decode()[:200]
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code} " + e.read().decode()[:200]


print("  anon  count(*)          :", anon("count(*)"))
print("  anon  count(territory)  :", anon('count(*[_type == "territory"])'))

req = urllib.request.Request(
    f"https://{PROJECT}.api.sanity.io/v2023-05-03/data/query/{DATASET}",
    data=json.dumps({"query": "count(*[_type == \"territory\"])"}).encode(),
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
)
with urllib.request.urlopen(req, timeout=25) as res:
    print("  auth  count(territory)  :", res.read().decode()[:200])

print("\n=== try to create a Context MCP endpoint ===")
attempts = [
    (
        "POST",
        f"/v1/context/organizations/{ORG}/mcp/endpoints",
        {"name": "ninety", "sources": [{"type": "dataset", "projectId": PROJECT, "dataset": DATASET}]},
    ),
    (
        "POST",
        f"/v1/context/organizations/{ORG}/mcp/endpoints",
        {"name": "ninety", "dataset": {"projectId": PROJECT, "dataset": DATASET}},
    ),
    ("GET", f"/v1/context/organizations/{ORG}/mcp/endpoints", None),
    ("POST", f"/v1/context/organizations/{ORG}/mcp/ninety", {"sources": []}),
]
for method, path, body in attempts:
    call(method, path, body=body, label=path)

print("\n=== what does an empty endpoint name return? ===")
for name in ("", "list"):
    call(
        "POST",
        f"/v1/context/organizations/{ORG}/mcp/{name}",
        body={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        headers={"Accept": "application/json, text/event-stream"},
        label=f"tools/list '{name}'",
    )