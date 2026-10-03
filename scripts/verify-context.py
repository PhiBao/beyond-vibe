#!/usr/bin/env python3
"""Verify, after the founder's changes:
  1. the dataset is readable anonymously
  2. the Context MCP endpoint `ninety` serves tools with this token
"""

import json
import os
import urllib.error
import urllib.request

TOKEN = os.environ["SANITY_TOKEN"]
PROJECT = "jvgi63fz"
DATASET = "production"
ENDPOINT = "https://api.sanity.io/v1/context/organizations/ovihgdwkx/mcp/ninety"


def anon(query, api="2023-05-03"):
    req = urllib.request.Request(
        f"https://{PROJECT}.api.sanity.io/v{api}/data/query/{DATASET}",
        data=json.dumps({"query": query}).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            return res.read().decode()[:160]
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code} " + e.read().decode()[:160]


def token_get(query):
    req = urllib.request.Request(
        f"https://{PROJECT}.api.sanity.io/v2023-05-03/data/query/{DATASET}",
        data=json.dumps({"query": query}).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
    )
    with urllib.request.urlopen(req, timeout=25) as res:
        return res.read().decode()[:160]


print("=== 1. dataset visibility ===")
print("  anon count(*)      :", anon("count(*)"))
print("  anon count(territ.) :", anon('count(*[_type == "territory"])'))
print("  auth count(territ.) :", token_get('count(*[_type == "territory"])'))
print("  anon newer api     :", anon('count(*[_type == "territory"])', api="2026-01-01"))
print("  anon perspective   :", anon('count(*[_type == "territory"])'))

print("\n=== 2. Context MCP endpoint ===")


def mcp(method, params, label):
    body = {"jsonrpc": "2.0", "id": 1, "method": method}
    if params:
        body["params"] = params
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=40) as res:
            raw = res.read().decode()
            # SSE responses arrive as "event: message\ndata: {...}"
            payload = raw
            for line in raw.splitlines():
                if line.startswith("data: "):
                    payload = line[6:]
                    break
            data = json.loads(payload)
            print(f"  {label}: {json.dumps(data)[:900]}")
            return data
    except urllib.error.HTTPError as e:
        print(f"  {label}: HTTP {e.code} {e.read().decode()[:400]}")
    except Exception as e:  # noqa: BLE001
        print(f"  {label}: ERR {e}")
    return None


listed = mcp("tools/list", None, "tools/list")
if listed and "result" in listed:
    print("\n  tools served:")
    for tool in listed["result"].get("tools", []):
        print(f"    - {tool.get('name')}: {(tool.get('description') or '')[:110]}")

print("\n=== 3. initial_context (what an agent sees first) ===")
mcp("tools/call", {"name": "initial_context", "arguments": {}}, "initial_context")