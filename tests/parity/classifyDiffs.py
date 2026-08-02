#!/usr/bin/env python3
"""Group parity differences into classes.

A list of 1800 differing page names says nothing useful. This buckets them by
what actually differs, so a class can be judged once rather than a page at a
time, and prints an example plus a count for each.

    python3 tests/parity/classifyDiffs.py output/lua-full output/php-full
"""

import collections
import json
import re
import sys


def load(path):
    with open(f"{path}/records.json", encoding="utf-8") as handle:
        return json.load(handle)


def props(record):
    smw = record.get("smw")
    return smw.get("properties", {}) if isinstance(smw, dict) else {}


def subobjects(record):
    smw = record.get("smw")
    return smw.get("subobjects", {}) if isinstance(smw, dict) else {}


def first_difference(a, b):
    """Index of the first differing byte, and a window around it from each."""
    limit = min(len(a), len(b))
    i = 0
    while i < limit and a[i] == b[i]:
        i += 1
    return i, a[max(0, i - 90):i + 130], b[max(0, i - 90):i + 130]


# Ordered: the first signature that matches a window wins, so put the specific
# ones before the general.
SIGNATURES = [
    # Most specific first. The SMW validation warning matters most: it means a
    # value the Lua smuggled past SMW as an escaped string is now being
    # rejected, which is a consequence of no longer escaping the slash.
    ("smw value warning", re.compile(
        r'Property &quot;|Property "[^"]+" \(as page type\)|contains invalid characters|has been classified')),
    ("smw generated id", re.compile(r'id="smw-[0-9a-f]+"|smw-[0-9a-f]{12,}')),
    ("smw query id", re.compile(r"_QUERY[0-9a-f]{8}|smw-query|Has_query")),
    ("subobject id", re.compile(r"#_ML[0-9a-f]{6}|#_QUERY|#[0-9]+##")),
    ("ask result", re.compile(r"smw-format|smwtable|queryresult|smw-ask")),
    ("tooltip content", re.compile(r"smwttcontent|smw-highlighter|smwtticon")),
    ("tree markup", re.compile(r"fancytree|treeData|jsondata-tree")),
    ("editsection", re.compile(r"mw:editsection")),
    ("gallery / file", re.compile(r"gallery|filepath|fileupload")),
    ("jsonld payload", re.compile(r"data-jsonld|jsonld-header")),
    ("infobox", re.compile(r"info_box")),
    ("category link", re.compile(r"/wiki/Category:|catlinks")),
    ("parser error", re.compile(r'class="error"|scribunto-error|Lua error')),
    ("entity escaping", re.compile(r"&#x[0-9A-Fa-f]{2,4};|&amp;#")),
    ("whitespace only", re.compile(r"^\s*$")),
]


def classify(window_a, window_b):
    for name, pattern in SIGNATURES:
        if pattern.search(window_a) or pattern.search(window_b):
            return name
    return "unclassified"


def main():
    lua_path, php_path = sys.argv[1], sys.argv[2]
    lua, php = load(lua_path), load(php_path)

    html_classes = collections.Counter()
    html_examples = {}
    smw_classes = collections.Counter()
    smw_examples = {}
    both = 0

    for key, current in php.items():
        baseline = lua.get(key)
        if baseline is None:
            continue

        html_differs = baseline["html"] != current["html"]
        smw_differs = baseline.get("smw") != current.get("smw")
        if html_differs and smw_differs:
            both += 1

        if html_differs:
            index, window_a, window_b = first_difference(baseline["html"], current["html"])
            name = classify(window_a, window_b)
            html_classes[name] += 1
            html_examples.setdefault(name, (key, index, window_a, window_b))

        if smw_differs:
            a, b = props(baseline), props(current)
            changed = sorted(p for p in set(a) | set(b) if a.get(p) != b.get(p))
            if subobjects(baseline) != subobjects(current):
                changed.append("<subobjects>")
            name = ", ".join(changed) or "<equal properties, unequal smw>"
            smw_classes[name] += 1
            smw_examples.setdefault(name, (key, a, b))

    print(f"records with an html difference: {sum(html_classes.values())}")
    print(f"records with an smw difference:  {sum(smw_classes.values())}")
    print(f"records with both:               {both}")

    print("\n=== HTML differences by class ===")
    for name, count in html_classes.most_common():
        key, index, window_a, window_b = html_examples[name]
        print(f"\n  {name}: {count}")
        print(f"    e.g. {key} at byte {index}")
        print(f"      lua: {window_a[:150]!r}")
        print(f"      php: {window_b[:150]!r}")

    print("\n=== SMW differences by changed property set ===")
    for name, count in smw_classes.most_common(12):
        key, a, b = smw_examples[name]
        print(f"\n  [{name}]: {count}")
        print(f"    e.g. {key}")
        for prop in name.split(", ")[:3]:
            if prop.startswith("<"):
                continue
            print(f"      {prop}: lua={json.dumps(a.get(prop))[:80]} php={json.dumps(b.get(prop))[:80]}")


if __name__ == "__main__":
    main()
