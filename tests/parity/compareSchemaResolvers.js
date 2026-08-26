/*
 * Half two of the schema resolver divergence check. See
 * compareSchemaResolvers.php for why the check exists.
 *
 * This loads the real client classes, unmodified, out of modules/, rebuilds the
 * nested allOf document $RefParser.bundle() would have produced from the same
 * raw slots the PHP half recorded, runs the real _preprocess() over it, and
 * diffs the result against what PropertyOrderRanker produced.
 *
 * Running the genuine article rather than a reimplementation is the whole point:
 * a port of _preprocess written to be compared against PropertyOrderRanker would
 * agree with it by construction.
 *
 *     docker run --rm -v "$PWD:/x" -w /x node:20-alpine \
 *         node tests/parity/compareSchemaResolvers.js php.json
 *
 * Exits non-zero when the two resolvers disagree.
 */

const fs = require('fs');
const path = require('path');

const input = process.argv[2] || path.join(__dirname, 'output/schema-resolvers/php.json');
const server = process.argv[3] || 'https://wiki-dev.open-semantic-lab.org';
const lang = process.argv[4] || 'en';

// The two globals the client classes touch at construction time. Nothing else
// is stubbed, so if _preprocess ever starts reaching for more of mw.* this
// script fails loudly instead of silently diverging from the browser.
global.mwjson = {};
global.mw = { config: { get: (key) => ({ wgServer: server })[key] } };

require(path.join(__dirname, '../../modules/ext.MwJson.util/MwJson_util.js'));
require(path.join(__dirname, '../../modules/ext.MwJson.util/MwJson_schema.js'));

const CATEGORY_TAG = '__mwjson_chain_key';

const recording = JSON.parse(fs.readFileSync(input, 'utf8'));

/**
 * Rebuild the document the client would hold after bundling.
 *
 * Titles come out of the client's own title_regex, not out of a second
 * implementation, so a disagreement between it and PHP's CategoryExtractor
 * shows up here as a ref that resolves to a title PHP never visited.
 */
function inline(schema, ctx, stack) {
    if (Array.isArray(schema)) return schema.map((entry) => inline(entry, ctx, stack));
    if (schema === null || typeof schema !== 'object') return schema;

    const out = {};
    for (const key of Object.keys(schema)) {
        if (key === 'allOf') {
            const members = Array.isArray(schema.allOf) ? schema.allOf : [schema.allOf];
            out.allOf = members.map((member) => resolveMember(member, ctx, stack));
            continue;
        }
        out[key] = inline(schema[key], ctx, stack);
    }
    return out;
}

function resolveMember(member, ctx, stack) {
    if (member === null || typeof member !== 'object' || typeof member.$ref !== 'string') {
        return inline(member, ctx, stack);
    }

    // A fragment-only ref points inside the same document. $RefParser resolves
    // those itself and never offers them to the wiki resolver, and bundle()
    // leaves them in place as $refs, which _preprocess does not follow. Running
    // the title regex over one would read `#/properties/main_unit` as a page
    // called "main unit".
    if (member.$ref.startsWith('#')) {
        ctx.internalRefs++;
        return { $ref: member.$ref };
    }

    const title = titleFromRef(member.$ref, ctx);
    if (title === null) {
        ctx.unparsedRefs.add(member.$ref);
        return inline(member, ctx, stack);
    }
    if (!Object.prototype.hasOwnProperty.call(ctx.raw, title)) {
        // The client would fetch this page; PHP's chain never ranked it.
        ctx.refsPhpDidNotRank.add(title);
        return {};
    }
    if (stack.includes(title)) {
        ctx.cycles.add(title);
        return {};
    }

    // bundle(), unlike dereference(), inlines a target once and points every
    // later occurrence at that copy. _preprocess does not follow those internal
    // refs, so a schema reached twice is ranked once, which is what PHP's
    // visited set does too. Inlining it twice here would invent a disagreement.
    if (ctx.bundled[title]) {
        ctx.duplicateRefs++;
        return { $ref: '#/bundled/' + title };
    }
    ctx.bundled[title] = true;

    const resolved = inline(ctx.raw[title], ctx, stack.concat([title]));
    resolved[CATEGORY_TAG] = title;
    return resolved;
}

function titleFromRef(ref, ctx) {
    const match = ctx.titleRegex.exec(ref);
    if (match && match.groups && match.groups.title) {
        // The client strips a trailing slash-free title out of the url; the
        // recording is keyed by prefixed text, which uses spaces.
        return match.groups.title.replace(/_/g, ' ');
    }
    return null;
}

/** Every tagged node, with the allOf nesting level _preprocess assigned it. */
function collectLevels(schema, level, found) {
    if (Array.isArray(schema)) return;
    if (schema === null || typeof schema !== 'object') return;

    if (typeof schema[CATEGORY_TAG] === 'string' && schema.properties) {
        const orders = {};
        for (const name of Object.keys(schema.properties)) {
            const definition = schema.properties[name];
            orders[name] = definition && typeof definition === 'object'
                ? (definition.propertyOrder !== undefined ? definition.propertyOrder : null)
                : null;
        }
        found.push({ category: schema[CATEGORY_TAG], level: level, orders: orders });
    }

    if (schema.allOf) {
        const members = Array.isArray(schema.allOf) ? schema.allOf : [schema.allOf];
        for (const member of members) collectLevels(member, level + 1, found);
    }
}

function compare(page) {
    const ctx = {
        // The shared pool, plus this page's own schema under the key the PHP
        // walker files it under.
        raw: Object.assign({ _: page.ownSchema || {} }, recording.schemas),
        titleRegex: probe.title_regex,
        unparsedRefs: new Set(),
        refsPhpDidNotRank: new Set(),
        cycles: new Set(),
        bundled: {},
        internalRefs: 0,
        duplicateRefs: 0,
    };

    // The client builds a form for the page's data, so its root is the schema of
    // the categories the page is an instance of. PHP additionally folds in the
    // page's own jsonschema under "_", which the client never sees; that entry
    // is reported separately rather than counted as a mismatch.
    const own = page.ownCategories || [];
    const refTo = (category) => ({ $ref: '/wiki/' + category + '?action=raw&slot=jsonschema' });

    // With a single type the browser hands _preprocess that category's schema
    // directly, so the chain root sits at level 0. Wrapping it in a synthetic
    // allOf would push every level down by one and manufacture a difference
    // that the browser does not have. Only a page with several types needs the
    // wrapper, and there the extra level is recorded rather than corrected.
    let bundled;
    let wrapperLevels;
    if (own.length === 1) {
        bundled = resolveMember(refTo(own[0]), ctx, []);
        wrapperLevels = 0;
    } else {
        bundled = inline({ allOf: own.map(refTo) }, ctx, []);
        wrapperLevels = 1;
    }

    const client = new mwjson.schema({
        jsonschema: bundled,
        config: { use_cache: false, lang: lang },
    });
    client._preprocess({ schema: client.getSchema() });

    const found = [];
    collectLevels(client.getSchema(), 0, found);

    const jsByCategory = {};
    for (const entry of found) {
        if (!jsByCategory[entry.category]) jsByCategory[entry.category] = [];
        jsByCategory[entry.category].push(entry);
    }

    const findings = [];
    // Pairs present on both sides, to compare the sequence the orders produce.
    // Absolute values can differ harmlessly; the sequence is what propertyOrder
    // exists to control, and a patch that reorders a form depends on it.
    const shared = [];
    const phpRanked = page.ranked || {};
    const phpLevelOf = {};
    page.visited.forEach((category, index) => {
        phpLevelOf[category] = page.visited.length - index;
    });

    for (const category of Object.keys(phpRanked)) {
        if (category === '_') {
            findings.push({ kind: 'php-only-own-schema', category: category });
            continue;
        }
        const entries = jsByCategory[category];
        if (!entries) {
            findings.push({ kind: 'missing-on-client', category: category });
            continue;
        }
        if (entries.length > 1) {
            findings.push({
                kind: 'inlined-more-than-once',
                category: category,
                times: entries.length,
                levels: entries.map((e) => e.level),
            });
        }

        const entry = entries[0];
        const phpLevel = phpLevelOf[category];
        const jsLevel = entry.level - wrapperLevels;
        const levelDelta = phpLevel - jsLevel;

        for (const name of Object.keys(phpRanked[category])) {
            const phpOrder = phpRanked[category][name];
            if (!(name in entry.orders)) {
                // The client deletes properties that declare themselves visible
                // only in other modes (MwJson_schema.js:480). That is a
                // deliberate client-side filter, not a resolver disagreement, so
                // it is counted apart from a property that merely went missing.
                const declared = ((recording.schemas || {})[category] || {}).properties || {};
                const definition = declared[name] || {};
                const conditional = definition.options && definition.options.conditional_visible;
                findings.push({
                    kind: conditional
                        ? 'client-drops-other-mode-property'
                        : 'property-missing-on-client',
                    category: category,
                    property: name,
                    modes: conditional ? conditional.modes : undefined,
                });
                continue;
            }
            const jsOrder = entry.orders[name];
            if (typeof phpOrder === 'number' && typeof jsOrder === 'number') {
                shared.push({ key: category + '.' + name, php: phpOrder, js: jsOrder });
            }
            if (phpOrder === jsOrder) continue;

            // Both sides run the same arithmetic; they disagree about the level
            // to run it at, because PHP counts the subject's own schema as a
            // chain member and numbers from one while the client numbers its
            // bundled root from zero. A difference of exactly the level stride,
            // signed by which band the order falls in, is that offset and
            // nothing more: it shifts every value uniformly and so cannot
            // reorder anything.
            const stride = 2000;
            const band = phpOrder > 1000 * 1000 + 1000 ? 1 : -1;
            const explained = typeof phpOrder === 'number' && typeof jsOrder === 'number'
                && phpOrder - jsOrder === band * levelDelta * stride;

            findings.push({
                kind: explained ? 'propertyOrder-differs-by-level-offset' : 'propertyOrder-differs-unexplained',
                category: category,
                property: name,
                php: phpOrder,
                js: jsOrder,
                phpLevel: phpLevel,
                jsLevel: jsLevel,
                levelDelta: levelDelta,
            });
        }
        for (const name of Object.keys(entry.orders)) {
            if (!(name in phpRanked[category])) {
                findings.push({ kind: 'property-only-on-client', category: category, property: name });
            }
        }
    }

    // Stable sort on both sides, tie-broken identically, so a difference in the
    // sequence is a difference in the orders and not in the sort.
    const byPhp = shared.slice().sort((a, b) => a.php - b.php || a.key.localeCompare(b.key));
    const byJs = shared.slice().sort((a, b) => a.js - b.js || a.key.localeCompare(b.key));
    for (let i = 0; i < byPhp.length; i++) {
        if (byPhp[i].key !== byJs[i].key) {
            findings.push({
                kind: 'property-sequence-differs',
                position: i,
                php: byPhp[i].key,
                js: byJs[i].key,
            });
            break;
        }
    }

    stats.pairsCompared += shared.length;
    stats.categoriesCompared += Object.keys(jsByCategory).length;
    stats.internalRefs += ctx.internalRefs;
    stats.duplicateRefs += ctx.duplicateRefs;

    for (const title of ctx.refsPhpDidNotRank) {
        findings.push({ kind: 'nested-ref-php-expands-after-the-walk', title: title });
    }
    for (const ref of ctx.unparsedRefs) {
        findings.push({ kind: 'ref-the-client-regex-cannot-parse', ref: ref });
    }
    for (const title of ctx.cycles) {
        findings.push({ kind: 'cycle', title: title });
    }

    return findings;
}

const probe = new mwjson.schema({ jsonschema: {}, config: { use_cache: false, lang: lang } });

// Counters, so that "no finding" can be told apart from "never looked". A
// comparison that silently compared nothing would otherwise read as a clean run.
const stats = { pairsCompared: 0, categoriesCompared: 0, internalRefs: 0, duplicateRefs: 0 };

const byKind = {};
const examples = {};
let pagesWithFindings = 0;

for (const page of recording.pages) {
    let findings;
    try {
        findings = compare(page);
    } catch (error) {
        findings = [{ kind: 'client-threw', message: String(error && error.message || error) }];
    }
    if (findings.length) pagesWithFindings++;
    for (const finding of findings) {
        byKind[finding.kind] = (byKind[finding.kind] || 0) + 1;
        if (!examples[finding.kind]) examples[finding.kind] = { page: page.page, finding: finding };
    }
}

console.log('Pages compared:            ' + recording.pages.length);
console.log('Chain members compared:   ' + stats.categoriesCompared);
console.log('Property orders compared: ' + stats.pairsCompared);
console.log('Pages with findings:      ' + pagesWithFindings);
console.log('Internal refs left alone: ' + stats.internalRefs);
console.log('Refs bundled to a copy:   ' + stats.duplicateRefs);
console.log('');
console.log('Not covered: $refs outside allOf (PHP expands those after the walk,');
console.log('the client during it), and whichever duplicate json-editor picks when');
console.log('a property is declared at several levels.');
console.log('');

const kinds = Object.keys(byKind).sort((a, b) => byKind[b] - byKind[a]);
if (!kinds.length) {
    console.log('The two resolvers agree on every compared page.');
    process.exit(0);
}

for (const kind of kinds) {
    console.log(kind + ': ' + byKind[kind]);
    console.log('  e.g. ' + examples[kind].page + ' ' + JSON.stringify(examples[kind].finding));
}

/*
 * Differences that are understood, systematic, and do not change which
 * properties exist or the order they appear in. Anything outside this list is
 * new and fails the run.
 *
 * propertyOrder-differs-by-level-offset
 *     PHP numbers chain levels from one and counts the subject's own schema as
 *     a member; the client numbers its bundled root from zero and has no such
 *     member. Every value shifts by the same amount, so nothing reorders.
 * client-drops-other-mode-property
 *     The client deletes a property whose options.conditional_visible.modes
 *     excludes the current mode (MwJson_schema.js:480). A deliberate form
 *     filter, downstream of resolution.
 * php-only-own-schema
 *     PHP folds a Category page's own jsonschema into its chain as "_". The
 *     client is building a form for the page's data and never reads that slot.
 * nested-ref-php-expands-after-the-walk
 *     An allOf ref inside a property definition rather than in the chain. The
 *     walker does not follow it, JsonRefExpander splices it in afterwards, so
 *     PHP never rescales the properties it brings; the client ranks them at
 *     their nesting level. Values differ, sequence within the object does not.
 */
const EXPECTED = [
    'propertyOrder-differs-by-level-offset',
    'client-drops-other-mode-property',
    'php-only-own-schema',
    'nested-ref-php-expands-after-the-walk',
];

const unexpected = kinds.filter((kind) => !EXPECTED.includes(kind));
console.log('');
if (unexpected.length) {
    console.log('DIVERGED: ' + unexpected.join(', '));
} else {
    console.log('AGREED: same properties, same order, on every page compared.');
    console.log('Values differ only by the systematic offsets listed in this script.');
}
process.exit(unexpected.length ? 1 : 0);
