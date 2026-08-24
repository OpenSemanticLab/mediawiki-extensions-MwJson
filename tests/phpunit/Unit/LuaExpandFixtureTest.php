<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\Template\EmbeddedTemplateExpander;
use MediaWiki\Extension\MwJson\Template\MustacheRenderer;
use PHPUnit\Framework\TestCase;

/**
 * Differential test for the eval_template layer: replays results captured from
 * the real Module:MwJson, running under Lua 5.1 against Module:Lustache, with
 * the parser frame stubbed so the wikitext boundary is observable.
 *
 * Runs the renderer with Lustache-exact escaping, slash included, so that what
 * is under test is the expander's logic rather than the escaping policy. The
 * deliberate divergence on the slash is asserted separately in
 * MustacheRendererTest, which explains why it exists.
 *
 * Fixture: tests/phpunit/Unit/fixtures/lua-expand.json
 * Generator: tests/parity/lua/dumpExpand.lua
 *
 * @covers \MediaWiki\Extension\MwJson\Template\EmbeddedTemplateExpander
 * @covers \MediaWiki\Extension\MwJson\Template\MustacheRenderer
 */
class LuaExpandFixtureTest extends TestCase {
	use LuaFixtureTrait;

	/**
	 * @dataProvider provideLuaCases
	 * @param mixed $expected
	 */
	public function testMatchesLua( string $fn, array $args, $expected ): void {
		$this->assertSame( 'expandEmbeddedTemplates', $fn );
		[ $schema, $data, $mode, $stringify ] = $args;

		$expander = new EmbeddedTemplateExpander(
			new MustacheRenderer( true ),
			new StubWikitextPreprocessor()
		);

		$actual = $expander->expand( $data, $schema, $mode, $stringify );

		$this->assertSame( self::canonicalize( $expected ), self::canonicalize( $actual ) );
	}

	public static function provideLuaCases(): array {
		return self::loadLuaFixture( 'lua-expand.json' );
	}
}
