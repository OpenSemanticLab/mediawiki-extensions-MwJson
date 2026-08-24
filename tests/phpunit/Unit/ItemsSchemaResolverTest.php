<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\OOLD\ItemsSchemaResolver;
use MediaWiki\Extension\MwJson\OOLD\JsonUtil;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\MwJson\OOLD\ItemsSchemaResolver
 * @covers \MediaWiki\Extension\MwJson\OOLD\JsonUtil::joinPath
 */
class ItemsSchemaResolverTest extends TestCase {

	private ItemsSchemaResolver $resolver;

	protected function setUp(): void {
		$this->resolver = new ItemsSchemaResolver();
	}

	public function testSchemaWithoutItemsIsReturnedUnchanged(): void {
		$schema = [ 'type' => 'object' ];
		$this->assertSame( $schema, $this->resolver->resolve( $schema, [] ) );
	}

	public function testPlainItemsSchemaIsUsed(): void {
		$items = [ 'x-smw-quantity-property' => 'HasLengthValue' ];
		$this->assertSame( $items, $this->resolver->resolve( [ 'items' => $items ], [] ) );
	}

	/**
	 * @dataProvider provideBranchKeywords
	 */
	public function testBranchIsSelectedByDeclaredCategory( string $keyword ): void {
		$schema = [ 'items' => [ 'oneOf' => [
			[
				'properties' => [ 'type' => [ $keyword => [ 'Category:A' ] ] ],
				'x-smw-quantity-property' => 'HasAValue',
			],
			[
				'properties' => [ 'type' => [ $keyword => [ 'Category:B' ] ] ],
				'x-smw-quantity-property' => 'HasBValue',
			],
		] ] ];

		$resolved = $this->resolver->resolve( $schema, [ 'type' => [ 'Category:B' ] ] );
		$this->assertSame( 'HasBValue', $resolved['x-smw-quantity-property'] );
	}

	public static function provideBranchKeywords(): array {
		// Schemas pin the category with whichever of the three they prefer, and
		// the Lua reads all three in this order.
		return [ 'default' => [ 'default' ], 'const' => [ 'const' ], 'enum' => [ 'enum' ] ];
	}

	public function testAnyOfIsTreatedLikeOneOf(): void {
		$schema = [ 'items' => [ 'anyOf' => [
			[ 'properties' => [ 'type' => [ 'default' => [ 'Category:A' ] ] ], 'title' => 'A' ],
		] ] ];

		$resolved = $this->resolver->resolve( $schema, [ 'type' => [ 'Category:A' ] ] );
		$this->assertSame( 'A', $resolved['title'] );
	}

	/**
	 * The common case: one unit enum on `items` shared by every branch, so a
	 * branch that names no quantity property of its own still maps its value.
	 */
	public function testBranchInheritsTheQuantityPropertyFromItems(): void {
		$schema = [ 'items' => [
			'x-smw-quantity-property' => 'HasLengthValue',
			'oneOf' => [
				[ 'properties' => [ 'type' => [ 'default' => [ 'Category:A' ] ] ] ],
			],
		] ];

		$resolved = $this->resolver->resolve( $schema, [ 'type' => [ 'Category:A' ] ] );
		$this->assertSame( 'HasLengthValue', $resolved['x-smw-quantity-property'] );
	}

	public function testBranchKeepsItsOwnQuantityProperty(): void {
		$schema = [ 'items' => [
			'x-smw-quantity-property' => 'HasLengthValue',
			'oneOf' => [
				[
					'properties' => [ 'type' => [ 'default' => [ 'Category:A' ] ] ],
					'x-smw-quantity-property' => 'HasAngleValue',
				],
			],
		] ];

		$resolved = $this->resolver->resolve( $schema, [ 'type' => [ 'Category:A' ] ] );
		$this->assertSame( 'HasAngleValue', $resolved['x-smw-quantity-property'] );
	}

	public function testUnmatchedElementFallsBackToItems(): void {
		$schema = [ 'items' => [
			'title' => 'fallback',
			'oneOf' => [
				[ 'properties' => [ 'type' => [ 'default' => [ 'Category:A' ] ] ], 'title' => 'A' ],
			],
		] ];

		$resolved = $this->resolver->resolve( $schema, [ 'type' => [ 'Category:Z' ] ] );
		$this->assertSame( 'fallback', $resolved['title'] );
	}

	public function testElementWithoutATypeFallsBackToItems(): void {
		$schema = [ 'items' => [
			'title' => 'fallback',
			'oneOf' => [
				[ 'properties' => [ 'type' => [ 'default' => [ 'Category:A' ] ] ], 'title' => 'A' ],
			],
		] ];

		$this->assertSame( 'fallback', $this->resolver->resolve( $schema, [] )['title'] );
	}

	/**
	 * @dataProvider providePaths
	 */
	public function testJoinPath( ?string $parent, string $key, string $expected ): void {
		$this->assertSame( $expected, JsonUtil::joinPath( $parent, $key ) );
	}

	public static function providePaths(): array {
		return [
			'no parent' => [ null, 'l1', 'l1' ],
			'empty parent' => [ '', 'l1', 'l1' ],
			'nested' => [ 'characteristics', '2', 'characteristics.2' ],
			'deep' => [ 'a.b', 'c', 'a.b.c' ],
		];
	}
}
