#!/usr/bin/env python3
"""Edit a page on the dev wiki through the API.

Used during the migration to deploy the Module:Entity shim and to roll it back.
Kept in the repo rather than as a throwaway so the rollback is a one-liner that
someone else can run:

    python3 tests/parity/wikiEdit.py Module:Entity docs/legacy-lua/Entity.lua \\
        "Revert to the pre-migration module"

Credentials come from the environment, falling back to the dev stack's defaults
in .env. Do not point this at anything but a dev wiki.
"""

import http.cookiejar
import json
import os
import sys
import urllib.parse
import urllib.request

API = os.environ.get(
    "MWJSON_API",
    "https://stacktest.digital.isc.fraunhofer.de/w/api.php",
)
USER = os.environ.get("MWJSON_USER", "Admin")
PASSWORD = os.environ.get("MWJSON_PASSWORD", "change_me123123")

_opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
)


def call(post=False, **params):
    params.setdefault("format", "json")
    if post:
        request = urllib.request.Request(API, data=urllib.parse.urlencode(params).encode())
    else:
        request = urllib.request.Request(API + "?" + urllib.parse.urlencode(params))
    return json.load(_opener.open(request, timeout=60))


def login():
    token = call(action="query", meta="tokens", type="login")["query"]["tokens"]["logintoken"]
    result = call(action="login", lgname=USER, lgpassword=PASSWORD, lgtoken=token, post=True)
    if result.get("login", {}).get("result") != "Success":
        raise SystemExit("login failed: " + json.dumps(result))
    return call(action="query", meta="tokens")["query"]["tokens"]["csrftoken"]


def main():
    if len(sys.argv) < 4:
        raise SystemExit("usage: wikiEdit.py <page> <file> <summary>")

    page, path, summary = sys.argv[1], sys.argv[2], sys.argv[3]
    text = open(path, encoding="utf-8").read()

    csrf = login()

    # Snapshot what is there now, so a mistake is always recoverable.
    current = call(action="query", prop="revisions", titles=page, rvprop="content|ids", rvslots="main")
    for info in current.get("query", {}).get("pages", {}).values():
        revisions = info.get("revisions")
        if revisions:
            backup = f"/tmp/{page.replace(':', '_').replace('/', '_')}.before.txt"
            with open(backup, "w", encoding="utf-8") as handle:
                handle.write(revisions[0]["slots"]["main"]["*"])
            print(f"previous revision {revisions[0]['revid']} saved to {backup}")

    result = call(action="edit", title=page, text=text, token=csrf, summary=summary, post=True)
    edit = result.get("edit", result)
    print(json.dumps(edit, indent=1)[:400])
    if edit.get("result") != "Success":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
