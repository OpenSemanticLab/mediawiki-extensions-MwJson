<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\OOLD\CategoryExtractor;
use MediaWiki\Extension\MwJson\OOLD\JsonRefExpander;
use MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy;
use MediaWiki\Extension\MwJson\OOLD\SchemaWalker;
use PHPUnit\Framework\TestCase;

/**
 * Differential test for the schema-resolution layer: replays results captured
 * from the real Module:MwJson, running under the same Lua 5.1 that Scribunto's
 * luastandalone engine uses, against the PHP port.
 *
 * Both sides read the same fixture wiki (FixtureWiki::PAGES mirrors the `pages`
 * table in the generator), so a difference here is a difference in the port.
 *
 * Fixture: tests/phpunit/Unit/fixtures/lua-schema.json
 * Generator: tests/parity/lua/dumpSchema.lua
 *
 * @covers \MediaWiki\Extension\MwJson\OOLD\CategoryExtractor
 * @covers \MediaWiki\Extension\MwJson\OOLD\JsonRefExpander
 * @covers \MediaWiki\Extension\MwJson\OOLD\PropertyOrderRanker
 * @covers \MediaWiki\Extension\MwJson\OOLD\SchemaWalker
 */
class LuaSchemaFixtureTest extends TestCase {
	use LuaFixtureTrait;

	/**
	 * @dataProvider provideLuaCases
	 * @param mixed $expected
	 */
	public function testMatchesLua( string $fn, array $args, $expected ): void {
		$wiki = new FixtureWiki();
		$merge = new LegacyLuaMergeStrategy();

		switch ( $fn ) {
			case 'expandJsonRef':
				$actual = ( new JsonRefExpander( $wiki, $merge ) )->expand( $args[0] );
				break;

			case 'getCategories':
				$actual = ( new CategoryExtractor() )->extract( $args[0], $args[1], $args[2] );
				break;

			case 'walkJsonSchema':
				[ $schema, $categories, $mode, $recursive, $template ] = $args;
				$result = ( new SchemaWalker( $wiki, $wiki, $merge ) )
					->walk( $schema, $categories, $mode, $recursive, $template );
				$actual = [
					'schema' => $result->schema,
					'schemas' => $result->schemas,
					'templates' => $result->templates,
					'visited' => $result->visited,
				];
				break;

			default:
				$this->fail( "Fixture references unknown function '$fn'" );
		}

		$this->assertSame( self::canonicalize( $expected ), self::canonicalize( $actual ) );
	}

	public static function provideLuaCases(): array {
		return self::loadLuaFixture( 'lua-schema.json' );
	}

	/**
	 * The fixture is only meaningful if both sides read the same wiki. This
	 * catches the page set drifting apart, which would otherwise show up as a
	 * confusing failure in an unrelated case.
	 */
	public function testFixtureWikiCoversEveryPageTheGeneratorDeclares(): void {
		$generator = file_get_contents( __DIR__ . '/../../parity/lua/dumpSchema.lua' );

		foreach ( array_keys( FixtureWiki::PAGES ) as $title ) {
			$this->assertStringContainsString(
				"['$title']",
				$generator,
				"FixtureWiki declares $title but tests/parity/lua/dumpSchema.lua does not"
			);
		}
	}
}
