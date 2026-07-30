<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\Render\DateFormatter;
use MediaWiki\Extension\MwJson\Render\InfoBoxRenderer;
use MediaWiki\Extension\MwJson\Render\LinkHelper;
use MediaWiki\Extension\MwJson\Render\MultilangValue;
use MediaWiki\Extension\MwJson\Render\PropertyTypeResolver;
use MediaWiki\Extension\MwJson\Render\TreeRenderer;
use MediaWiki\Extension\MwJson\Template\WikitextPreprocessor;
use PHPUnit\Framework\TestCase;

/**
 * Differential test for the renderers: replays results captured from the real
 * Module:MwJson under Lua 5.1.
 *
 * The infobox side is worth noting. The generator loads Scribunto's *own*
 * mw.html rather than a stub, so the expected markup is produced by the same
 * builder the wiki uses. A stub would have agreed with whatever the PHP emitted
 * and proved nothing; this catches a stray newline or a reordered attribute.
 *
 * Fixture: tests/phpunit/Unit/fixtures/lua-render.json
 * Generator: tests/parity/lua/dumpRender.lua
 *
 * @covers \MediaWiki\Extension\MwJson\Render\DateFormatter
 * @covers \MediaWiki\Extension\MwJson\Render\InfoBoxRenderer
 * @covers \MediaWiki\Extension\MwJson\Render\LinkHelper
 * @covers \MediaWiki\Extension\MwJson\Render\MultilangValue
 * @covers \MediaWiki\Extension\MwJson\Render\PropertyTypeResolver
 * @covers \MediaWiki\Extension\MwJson\Render\TreeRenderer
 */
class LuaRenderFixtureTest extends TestCase {
	use LuaFixtureTrait;

	/** Matches USER_LANG in the generator. */
	private const LANGUAGE = 'de';

	/** Matches treeDefinitions in the generator. */
	private const DEFINITIONS = [
		'name' => [ 'property' => 'HasName', 'defined_in' => [ 'Category:Entity' ] ],
		'created' => [
			'property' => 'HasCreationDate',
			'defined_in' => [ 'Category:Entity', 'Category:Item' ],
		],
	];

	/**
	 * @dataProvider provideLuaCases
	 * @param mixed $expected
	 */
	public function testMatchesLua( string $fn, array $args, $expected ): void {
		$multilang = new MultilangValue( self::LANGUAGE );
		$types = new PropertyTypeResolver();
		$dates = new DateFormatter();
		$links = new LinkHelper( $this->newPreprocessor() );

		switch ( $fn ) {
			case 'getPropertyType':
				$actual = $types->resolve( $args[0], $args[1], $args[2] );
				break;

			case 'formatDate':
				$actual = $dates->format( $args[0], $args[1], $args[2] );
				break;

			case 'wrapLinkIfNs':
				$actual = $links->wrapLinkIfNamespaced( $args[0] );
				break;

			case 'renderMultilangValue':
				$actual = $multilang->render( $args[0], $args[1], $args[2], $args[3] );
				break;

			case 'renderArrayItemSummary':
				$actual = $this->newTree( $multilang, $types, $dates, $links )
					->renderArrayItemSummaryForTesting( $args[0] );
				break;

			case 'renderJson':
				$actual = $this->newTree( $multilang, $types, $dates, $links )
					->render( $args[1], $args[0], self::DEFINITIONS, 0, $args[2] );
				break;

			case 'renderInfoBox':
				$actual = ( new InfoBoxRenderer( $multilang, $types, $dates ) )
					->render( $args[0], $args[0], $args[1], self::DEFINITIONS, $args[2], $args[3] );
				break;

			default:
				$this->fail( "Fixture references unknown function '$fn'" );
		}

		$this->assertSame( self::canonicalize( $expected ), self::canonicalize( $actual ) );
	}

	public static function provideLuaCases(): array {
		return self::loadLuaFixture( 'lua-render.json' );
	}

	private function newTree(
		MultilangValue $multilang,
		PropertyTypeResolver $types,
		DateFormatter $dates,
		LinkHelper $links
	): TreeRenderer {
		return new TreeRenderer( $multilang, $types, $dates, $links );
	}

	/**
	 * Only expandTemplate is reachable from the renderers, via LinkHelper; the
	 * markers match the generator's frame stub.
	 */
	private function newPreprocessor(): WikitextPreprocessor {
		return new class implements WikitextPreprocessor {
			public function preprocess( string $wikitext ): string {
				return "PRE[$wikitext]";
			}

			public function preprocessWithArgs( string $wikitext, array $args ): string {
				return "CHILD[$wikitext]";
			}

			public function expandTemplate( string $title, array $args ): string {
				ksort( $args, SORT_STRING );
				$parts = [];
				foreach ( $args as $key => $value ) {
					$parts[] = "$key=$value";
				}
				return "TPL[$title|" . implode( ',', $parts ) . ']';
			}
		};
	}
}
