<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\OOLD\SemanticPropertyMapper;
use PHPUnit\Framework\TestCase;

/**
 * Cases the Lua differential fixture cannot pin, because the Lua's answer
 * depends on pairs() iteration order.
 *
 * @covers \MediaWiki\Extension\MwJson\OOLD\SemanticPropertyMapper
 */
class SemanticPropertyMapperTest extends TestCase {

	private const SUBJECT = 'Item:OSWtest';

	/**
	 * Two context terms can map the same key: OSL writes the extra ones with a
	 * trailing asterisk, so "type" and "type*" both apply to `type`.
	 *
	 * The stored values are deterministic, and that is the part that matters:
	 * every mapping receives the value. Which mapping ends up in `definitions`
	 * is not, because the Lua overwrites property_data[k] once per matching
	 * term while iterating an unordered table. PHP takes the last in document
	 * order, which is at least reproducible.
	 */
	public function testEveryMappingForAKeyReceivesTheValue(): void {
		$mapping = ( new SemanticPropertyMapper() )->map(
			[ 'type' => [ 'Category:A' ] ],
			[ '@context' => [
				'type' => 'Property:IsA',
				'type*' => [ '@id' => 'Property:HasType' ],
			] ],
			self::SUBJECT
		);

		$this->assertSame( [ 'Category:A' ], $mapping->properties['IsA'] );
		$this->assertSame( [ 'Category:A' ], $mapping->properties['HasType'] );
	}

	public function testDefinitionsTakeTheLastMatchingTermInDocumentOrder(): void {
		$mapping = ( new SemanticPropertyMapper() )->map(
			[ 'type' => [ 'Category:A' ] ],
			[ '@context' => [
				'type' => 'Property:IsA',
				'type*' => [ '@id' => 'Property:HasType' ],
			] ],
			self::SUBJECT
		);

		$this->assertSame( 'HasType', $mapping->definitions['type']['property'] );
	}

	/**
	 * A term mapped to a list has neither @id nor @reverse, so it yields no SMW
	 * mapping at all. The list form exists for the client-side editor; only the
	 * expanded and string forms reach the store.
	 */
	public function testListValuedContextTermMapsNothing(): void {
		$mapping = ( new SemanticPropertyMapper() )->map(
			[ 'type' => [ 'Category:A' ] ],
			[ '@context' => [ 'type*' => [ 'Property:HasType', 'Property:IsA' ] ] ],
			self::SUBJECT
		);

		$this->assertSame( [], $mapping->properties );
	}

	/**
	 * A term carrying both @id and @reverse is invalid JSON-LD, but the Lua
	 * reads each independently rather than choosing, so both apply.
	 */
	public function testTermWithBothIdAndReverseYieldsBoth(): void {
		$mapping = ( new SemanticPropertyMapper() )->map(
			[ 'part' => [ 'uuid' => '1111', 'name' => 'Bolt' ] ],
			[
				'@context' => [
					'part' => [ '@id' => 'Property:HasPart', '@reverse' => 'Property:IsPartOf' ],
					'name' => 'Property:HasName',
				],
				'properties' => [ 'part' => [ 'type' => 'object' ] ],
			],
			self::SUBJECT
		);

		$this->assertSame( [ 'Item:OSWtest#OSW1111' ], $mapping->properties['HasPart'] );
		// The reverse value is the *parent's* subject, not the subobject's, so
		// the relation reads "this part is part of the page". Resolving it
		// against the subobject instead would have it point at itself.
		$this->assertSame(
			[ 'Item:OSWtest' ],
			$mapping->subobjects[0]['properties']['IsPartOf']
		);
	}

	public function testSubobjectsAreCollectedInTraversalOrder(): void {
		$mapping = ( new SemanticPropertyMapper() )->map(
			[ 'parts' => [
				[ 'uuid' => 'aaaa', 'name' => 'One' ],
				[ 'uuid' => 'bbbb', 'name' => 'Two' ],
			] ],
			[
				'@context' => [ 'parts' => [ '@id' => 'Property:HasPart' ], 'name' => 'Property:HasName' ],
				'properties' => [ 'parts' => [ 'items' => [ 'type' => 'object' ] ] ],
			],
			self::SUBJECT
		);

		$this->assertSame(
			[ 'OSWaaaa', 'OSWbbbb' ],
			array_column( $mapping->subobjects, 'id' )
		);
	}

	public function testNothingIsWrittenAnywhereDuringMapping(): void {
		// The whole point of returning a SemanticMapping: the traversal is a
		// pure function, so it can run in a test with no wiki and no store, and
		// the parity harness can compare what would be written.
		$mapping = ( new SemanticPropertyMapper() )->map(
			[ 'name' => 'Widget' ],
			[ '@context' => [ 'name' => 'Property:HasName' ] ],
			self::SUBJECT
		);

		$this->assertSame( [ 'HasName' => [ 'Widget' ] ], $mapping->properties );
		$this->assertSame( [], $mapping->subobjects );
	}
}
