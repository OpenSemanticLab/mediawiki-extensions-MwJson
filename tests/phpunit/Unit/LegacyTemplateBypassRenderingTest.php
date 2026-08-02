<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\Render\MultilangValue;
use MediaWiki\Extension\MwJson\Template\EmbeddedTemplateExpander;
use MediaWiki\Extension\MwJson\Template\LegacyTemplateBypass;
use MediaWiki\Extension\MwJson\Template\MustacheRenderer;
use PHPUnit\Framework\TestCase;

/**
 * The bypass has to be invisible: a page rendered with it must read exactly as
 * one rendered without it. So these assert the bytes, not just the text.
 *
 * The template used throughout is the real one from Category:Entity, verbatim,
 * because the parts that are easy to get wrong are the incidental ones. The
 * delimiter-change tag emits nothing but the space after it survives, and the
 * `#switch` trims the case value it picks. Both leave a mark on the output.
 *
 * @covers \MediaWiki\Extension\MwJson\Template\LegacyTemplateBypass
 * @covers \MediaWiki\Extension\MwJson\Template\EmbeddedTemplateExpander
 */
class LegacyTemplateBypassRenderingTest extends TestCase {

	/** Category:Entity, properties.label.eval_template[0]. */
	private const LABEL_TEMPLATE = '{{=<% %>=}} {{#switch:{{USERLANGUAGECODE}} <%#label%> '
		. '| {{#ifeq: <%lang%>|en|#default|<%lang%>}} = <%text%> <%/label%> }}';

	private const SCHEMA = [
		'properties' => [
			'label' => [
				'eval_template' => [
					[
						'type' => 'mustache-wikitext',
						'mode' => 'render',
						'value' => self::LABEL_TEMPLATE,
					],
				],
			],
		],
	];

	/**
	 * @dataProvider provideLanguages
	 */
	public function testResolvesTheReaderLanguage( string $language, string $expected ): void {
		$data = [
			'label' => [
				[ 'text' => 'Water', 'lang' => 'en' ],
				[ 'text' => 'Wasser', 'lang' => 'de' ],
			],
		];

		$this->assertSame(
			[ 'label' => $expected ],
			$this->expand( $data, $language )
		);
	}

	public static function provideLanguages(): array {
		return [
			// The leading space is the one the delimiter-change tag leaves
			// behind. It is not cosmetic: the template emits it, so the bypass
			// has to as well.
			'reader language present' => [ 'de', ' Wasser' ],
			'reader language is English' => [ 'en', ' Water' ],
			// #switch falls through to #default, which the template maps to the
			// English case.
			'reader language absent, English stands in' => [ 'fr', ' Water' ],
		];
	}

	public function testYieldsNothingWhenNoLanguageMatches(): void {
		$data = [ 'label' => [ [ 'text' => 'Wasser', 'lang' => 'de' ] ] ];

		// The template builds no #default case without an English entry, so the
		// #switch selects nothing and only the literal space remains. The
		// multilang fallback further up the pipeline is what fills this in.
		$this->assertSame( [ 'label' => ' ' ], $this->expand( $data, 'fr' ) );
	}

	public function testEscapesLikeAnInterpolationWould(): void {
		$data = [ 'label' => [ [ 'text' => 'R&D <b>unit</b>', 'lang' => 'en' ] ] ];

		// <%text%> is an escaping interpolation, so the template never emitted
		// raw markup here and neither may the bypass.
		$this->assertSame(
			[ 'label' => ' R&amp;D &lt;b&gt;unit&lt;/b&gt;' ],
			$this->expand( $data, 'en' )
		);
	}

	public function testLeavesTheTemplateAloneWhenTheKeyDiffers(): void {
		// Category:OSWc5d4829... attaches the label template to "conclusion".
		// The section then iterates a property the value does not have, which is
		// not the shape being recognised, so it has to be rendered as written.
		$schema = [ 'properties' => [ 'conclusion' => self::SCHEMA['properties']['label'] ] ];
		$data = [ 'conclusion' => [ [ 'text' => 'Water', 'lang' => 'en' ] ] ];

		$expander = new EmbeddedTemplateExpander(
			new MustacheRenderer(),
			new StubWikitextPreprocessor(),
			null,
			null,
			new LegacyTemplateBypass(),
			new MultilangValue( 'en' )
		);

		// PRE[...] is the stub marking a parser round-trip, so its presence is
		// the assertion: the template ran.
		$result = $expander->expand( $data, $schema, 'render' );
		$this->assertStringStartsWith( 'PRE[', (string)$result['conclusion'] );
	}

	public function testDisabledBypassRendersTheTemplate(): void {
		$data = [ 'label' => [ [ 'text' => 'Water', 'lang' => 'en' ] ] ];

		$expander = new EmbeddedTemplateExpander(
			new MustacheRenderer(),
			new StubWikitextPreprocessor()
		);

		$this->assertStringStartsWith(
			'PRE[',
			(string)$expander->expand( $data, self::SCHEMA, 'render' )['label']
		);
	}

	/**
	 * Plain text has nothing for the preprocessor to expand, so the round-trip
	 * into the parser is skipped. Asserted through the stub's marker, since with
	 * a real preprocessor the two paths are indistinguishable by construction.
	 */
	public function testSkipsTheParserForOutputThatCannotContainMarkup(): void {
		$schema = [
			'properties' => [
				'name' => [
					'eval_template' => [
						[ 'type' => 'mustache-wikitext', 'value' => '{{name}}' ],
					],
				],
			],
		];

		$this->assertSame(
			[ 'name' => 'Widget' ],
			( new EmbeddedTemplateExpander(
				new MustacheRenderer(),
				new StubWikitextPreprocessor()
			) )->expand( [ 'name' => 'Widget' ], $schema, 'render' )
		);
	}

	private function expand( array $data, string $language ): array {
		$expander = new EmbeddedTemplateExpander(
			new MustacheRenderer(),
			new StubWikitextPreprocessor(),
			null,
			null,
			new LegacyTemplateBypass(),
			new MultilangValue( $language )
		);

		return $expander->expand( $data, self::SCHEMA, 'render' );
	}
}
