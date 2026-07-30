<?php

namespace MediaWiki\Extension\MwJson\Tests\Parity;

use MediaWiki\Cache\BacklinkCacheFactory;
use MediaWiki\MediaWikiServices;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Title\Title;
use MediaWiki\User\User;
use SMW\DIProperty;
use SMW\ParserData;
use SMW\SemanticData;

/**
 * Renders the OSL header/footer pipeline for a corpus of pages and reduces the
 * result to a canonical, comparable record.
 *
 * Used by tests/parity/renderParity.php to record a golden baseline from the
 * legacy Lua implementation and then to diff the PHP port against it. The
 * entry-point wikitext is held fixed on both sides ({{#invoke:Entity|<mode>}}),
 * so the only thing that varies between runs is which implementation
 * Module:Entity dispatches to ($wgMwJsonRenderer).
 *
 * Note this renders the invocation standalone rather than through the WSSlots
 * slot-rendering path. That is intentional: it is cheaper, deterministic, and
 * identical on both sides of the comparison, which is all parity requires. It
 * is not a substitute for the end-to-end browser checks.
 */
class ParityRecorder {

	/** Wikitext entry point per mode; must stay identical across runs. */
	private const ENTRY_POINT = '{{#invoke:Entity|%s}}';

	/** Page whose transclusions define the corpus. */
	private const CORPUS_ANCHOR = 'Module:MwJson';

	private Parser $parser;
	private BacklinkCacheFactory $backlinkCacheFactory;
	private HtmlNormalizer $htmlNormalizer;

	public function __construct(
		Parser $parser,
		BacklinkCacheFactory $backlinkCacheFactory,
		HtmlNormalizer $htmlNormalizer
	) {
		$this->parser = $parser;
		$this->backlinkCacheFactory = $backlinkCacheFactory;
		$this->htmlNormalizer = $htmlNormalizer;
	}

	public static function newFromGlobalState(): self {
		$services = MediaWikiServices::getInstance();
		return new self(
			// Deliberately the shared Parser, not ParserFactory::create().
			// TreeAndMenu registers #tree via an $wgExtensionFunctions callback
			// against MediaWikiServices::getParser() instead of the
			// ParserFirstCallInit hook (TreeAndMenu_body.php:27-30), so a freshly
			// created Parser has no #tree and every header render dies with
			// "callParserFunction: function \"#tree\" was not found".
			// The PHP port will hit the same constraint wherever it calls #tree.
			$services->getParser(),
			$services->getBacklinkCacheFactory(),
			new HtmlNormalizer()
		);
	}

	/**
	 * Every page that goes through the pipeline, in a stable order.
	 *
	 * @param int[]|null $namespaces Restrict to these namespaces, null for all.
	 * @return Title[]
	 */
	public function getCorpus( ?array $namespaces = null ): array {
		$anchor = Title::newFromText( self::CORPUS_ANCHOR );
		if ( $anchor === null ) {
			throw new \RuntimeException( 'Cannot resolve ' . self::CORPUS_ANCHOR );
		}

		$titles = [];
		foreach (
			$this->backlinkCacheFactory->getBacklinkCache( $anchor )->getLinkPages( 'templatelinks' )
			as $page
		) {
			$title = Title::castFromPageIdentity( $page );
			if ( $title === null || !$title->exists() ) {
				continue;
			}
			if ( $namespaces !== null && !in_array( $title->getNamespace(), $namespaces, true ) ) {
				continue;
			}
			$titles[$title->getPrefixedText()] = $title;
		}

		// Deterministic order so --limit selects the same slice between runs.
		ksort( $titles, SORT_STRING );
		return array_values( $titles );
	}

	/**
	 * Render one page in one mode and reduce it to a comparable record.
	 *
	 * @param string $mode 'header' or 'footer'
	 * @return array{title:string,mode:string,html:string,smw:array,error:?string}
	 */
	public function record( Title $title, string $mode ): array {
		$record = [
			'title' => $title->getPrefixedText(),
			'mode' => $mode,
			'html' => '',
			'smw' => [],
			'error' => null,
		];

		try {
			$options = ParserOptions::newFromUser( User::newSystemUser(
				'MwJson parity harness',
				[ 'steal' => true ]
			) );
			// Pin everything that would otherwise vary per invoking user, so a
			// difference in the record is a difference in the pipeline.
			$options->setUserLang(
				MediaWikiServices::getInstance()->getContentLanguage()->getCode()
			);

			$output = $this->parser->parse(
				sprintf( self::ENTRY_POINT, $mode ),
				$title,
				$options
			);

			$record['html'] = $this->htmlNormalizer->normalize( $output->getRawText() );
			$record['smw'] = $this->extractSemanticData( $output );
		} catch ( \Throwable $e ) {
			$record['error'] = get_class( $e ) . ': ' . $e->getMessage();
		}

		return $record;
	}

	/**
	 * Canonicalise the SMW data SMW attached to the parse.
	 *
	 * Values and subobjects are sorted because the Lua side builds them by
	 * iterating tables with pairs(), whose order is unspecified. See the
	 * "pairs() order" risk in the migration plan. Comparing sets rather than
	 * sequences is what makes the PHP port's determinism a non-regression.
	 */
	private function extractSemanticData( $parserOutput ): array {
		$data = $parserOutput->getExtensionData( ParserData::DATA_ID );
		if ( !$data instanceof SemanticData ) {
			return [];
		}
		return $this->serializeSemanticData( $data );
	}

	private function serializeSemanticData( SemanticData $data ): array {
		$properties = [];
		foreach ( $data->getProperties() as $property ) {
			/** @var DIProperty $property */
			$values = [];
			foreach ( $data->getPropertyValues( $property ) as $dataItem ) {
				$serialization = $dataItem->getSerialization();
				$values[] = is_string( $serialization )
					? $serialization
					: json_encode( $serialization );
			}
			sort( $values, SORT_STRING );
			$properties[$property->getKey()] = $values;
		}
		ksort( $properties, SORT_STRING );

		$subobjects = [];
		foreach ( $data->getSubSemanticData() as $key => $subData ) {
			$subobjects[$key] = $this->serializeSemanticData( $subData );
		}
		ksort( $subobjects, SORT_STRING );

		return [
			'properties' => $properties,
			'subobjects' => $subobjects,
		];
	}
}
