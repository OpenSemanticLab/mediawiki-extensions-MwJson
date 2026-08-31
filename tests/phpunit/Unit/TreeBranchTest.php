<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\Render\DateFormatter;
use MediaWiki\Extension\MwJson\Render\LinkHelper;
use MediaWiki\Extension\MwJson\Render\MultilangValue;
use MediaWiki\Extension\MwJson\Render\PropertyTypeResolver;
use MediaWiki\Extension\MwJson\Render\TreeRenderer;
use PHPUnit\Framework\TestCase;

/**
 * Which oneOf branch an array entry is rendered against.
 *
 * The branch decides the entry's heading and the schema every field under it
 * is described with, so choosing the wrong one does not fail loudly: the entry
 * renders, with another branch's titles and descriptions on it.
 *
 * The shape here is OSL's property definitions, where the branches are
 * discriminated by `type` and one of them uses a two-member enum.
 *
 * @covers \MediaWiki\Extension\MwJson\Render\TreeRenderer
 */
class TreeBranchTest extends TestCase {

	private const BRANCHES = [
		[
			'title' => 'NumberProperty',
			'required' => [ 'type' ],
			'properties' => [
				'type' => [ 'enum' => [ 'number', 'integer' ], 'title' => 'Number Type' ],
			],
		],
		[
			'title' => 'TextProperty',
			'required' => [ 'type' ],
			'properties' => [
				'type' => [ 'const' => 'string', 'title' => 'Text Type' ],
				// Pinned but optional: a plain string entry carries no format.
				'format' => [ 'enum' => [ 'date', 'date-time', 'uri' ] ],
			],
		],
		[
			'title' => 'ComplexProperty',
			'required' => [ 'type', 'characteristic' ],
			'properties' => [
				'type' => [ 'const' => 'object', 'title' => 'Object Type' ],
			],
		],
	];

	private function newRenderer(): TreeRenderer {
		$wikitext = new StubWikitextPreprocessor();
		return new TreeRenderer(
			new MultilangValue( 'en' ),
			new PropertyTypeResolver(),
			new DateFormatter(),
			new LinkHelper( $wikitext )
		);
	}

	/**
	 * @param array $entry
	 */
	private function renderEntry( array $entry ): string {
		return $this->newRenderer()->render(
			[ 'properties' => [ $entry ] ],
			[ 'properties' => [ 'properties' => [
				'type' => 'array',
				'items' => [ 'oneOf' => self::BRANCHES ],
			] ] ]
		);
	}

	public function testAStringEntryTakesTheBranchThatPinsString() {
		$html = $this->renderEntry( [ 'type' => 'string', 'name' => 'abr' ] );

		$this->assertStringContainsString( 'TextProperty', $html );
		// The bug: NumberProperty's enum has two members, so it was read as
		// pinning nothing, and being first it matched on `required` alone.
		$this->assertStringNotContainsString( 'NumberProperty', $html );
		$this->assertStringNotContainsString( 'Number Type', $html );
	}

	public function testANumberEntryStillTakesTheEnumBranch() {
		$html = $this->renderEntry( [ 'type' => 'integer', 'name' => 'count' ] );

		$this->assertStringContainsString( 'NumberProperty', $html );
		$this->assertStringNotContainsString( 'TextProperty', $html );
	}

	public function testAnOptionalPinnedKeyTheEntryLacksDoesNotVetoTheBranch() {
		// TextProperty pins `format`, the entry has none, and `format` is not
		// required. Treating the absence as a mismatch would push every plain
		// string entry back onto a branch that does not describe it.
		$html = $this->renderEntry( [ 'type' => 'string' ] );

		$this->assertStringContainsString( 'TextProperty', $html );
	}

	public function testAPinnedKeyTheEntryCarriesWronglyVetoesTheBranch() {
		$html = $this->renderEntry( [ 'type' => 'string', 'format' => 'nonsense' ] );

		$this->assertStringNotContainsString( 'TextProperty', $html );
	}

	public function testAMatchingDiscriminatorSelectsTheBranchEvenWhenTheEntryIsIncomplete() {
		// ComplexProperty requires `characteristic` as well as `type`, and this
		// entry has only `type`. The discriminator is still the better signal:
		// the entry says what it is, and describing an incomplete entry with
		// the branch it belongs to beats describing it with no branch at all.
		$html = $this->renderEntry( [ 'type' => 'object' ] );

		$this->assertStringContainsString( 'ComplexProperty', $html );
	}

	public function testABranchWhoseRequiredKeysAreAllPresentIsTaken() {
		$html = $this->renderEntry( [ 'type' => 'object', 'characteristic' => [] ] );

		$this->assertStringContainsString( 'ComplexProperty', $html );
	}

	public function testAnEntryMatchingNoBranchRendersWithoutOne() {
		// `type` is required by every branch, so nothing matches and the entry
		// still has to render rather than disappear.
		$html = $this->renderEntry( [ 'name' => 'orphan' ] );

		$this->assertStringContainsString( 'orphan', $html );
		$this->assertStringNotContainsString( 'NumberProperty', $html );
	}
}
