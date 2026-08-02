<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\OOLD\ContextBuilder;
use PHPUnit\Framework\TestCase;

/**
 * Ordering rules for @context, which the Lua fixture cannot pin because Lua's
 * pairs() has no defined order.
 *
 * @covers \MediaWiki\Extension\MwJson\OOLD\ContextBuilder
 */
class ContextBuilderTest extends TestCase {

	/**
	 * JSON-LD applies the members of an array-valued @context in order, so a
	 * later part overrides an earlier one. OO-LD relies on it: the parts appear
	 * in allOf chain order and a schema may append its own object last
	 * precisely in order to override what it inherited.
	 */
	public function testLaterListEntriesOverrideEarlierOnes(): void {
		$context = ( new ContextBuilder() )->build( [
			'@context' => [
				[ 'term' => 'first:one', 'kept' => 'base:kept' ],
				[ 'term' => 'second:two' ],
			],
		] );

		$this->assertSame( 'second:two', $context['term'], 'the later part wins' );
		$this->assertSame( 'base:kept', $context['kept'], 'terms only the earlier part defines survive' );
	}

	/**
	 * The shape a merged inheritance chain actually produces: the base
	 * category's map-shaped context, with more derived categories' list-shaped
	 * contexts appended under integer keys. The derived definition has to win,
	 * because that is what subclassing means.
	 */
	public function testAppendedPartsOverrideTopLevelTerms(): void {
		$context = ( new ContextBuilder() )->build( [
			'@context' => [
				'term' => [ '@id' => 'base:term', '@type' => '@id' ],
				0 => [ 'term' => 'derived:term' ],
			],
		] );

		$this->assertSame( 'derived:term', $context['term'] );
	}

	/**
	 * A bare string in a list position is a remote context IRI. The pipeline
	 * does not fetch them, so it must not mistake one for a term definition
	 * either.
	 */
	public function testRemoteContextImportsAreSkipped(): void {
		$context = ( new ContextBuilder() )->build( [
			'@context' => [ 'https://example.org/ctx', [ 'term' => 'a:b' ] ],
		] );

		$this->assertSame( [ 'term' => 'a:b' ], $context );
	}

	public function testExpandedTermDefinitionsAreKeptWhole(): void {
		$context = ( new ContextBuilder() )->build( [
			'@context' => [ 'part' => [ '@id' => 'a:b', '@type' => '@id' ] ],
		] );

		$this->assertSame( [ '@id' => 'a:b', '@type' => '@id' ], $context['part'] );
	}

	/**
	 * The multi-mapping shorthand: a term written with a trailing asterisk is a
	 * separate term, not a variant of the bare one, so the two must not
	 * overwrite each other.
	 */
	public function testAsteriskTermsAreIndependentOfTheBareTerm(): void {
		$context = ( new ContextBuilder() )->build( [
			'@context' => [
				'match' => [ '@id' => 'skos:exactMatch', '@type' => '@id' ],
				'match*' => [ '@id' => 'Property:Equivalent_URI', '@type' => '@id' ],
				'match**' => [ '@id' => 'Property:HasExactOntologyMatch', '@type' => '@id' ],
			],
		] );

		$this->assertSame( 'skos:exactMatch', $context['match']['@id'] );
		$this->assertSame( 'Property:Equivalent_URI', $context['match*']['@id'] );
		$this->assertSame( 'Property:HasExactOntologyMatch', $context['match**']['@id'] );
	}
}
