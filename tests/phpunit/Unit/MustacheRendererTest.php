<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\Template\MustacheCompileException;
use MediaWiki\Extension\MwJson\Template\MustacheRenderer;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\MwJson\Template\MustacheRenderer
 */
class MustacheRendererTest extends TestCase {

	/**
	 * The OSL schemas interleave Mustache with wikitext by switching Mustache's
	 * delimiters mid-template, sometimes more than once. Nothing else in the
	 * pipeline works if this does not.
	 */
	public function testDelimiterSwitching(): void {
		$renderer = new MustacheRenderer();

		$this->assertSame(
			'  {{Viewer/Link |page=Category:A }} <br> {{Viewer/Link |page=Category:B }} <br>',
			$renderer->render(
				'{{=<% %>=}} <%#type%> {{Viewer/Link |page=<%.%> }} <br><%/type%>',
				[ 'type' => [ 'Category:A', 'Category:B' ] ]
			)
		);
	}

	public function testDelimitersCanSwitchBackMidTemplate(): void {
		$renderer = new MustacheRenderer();

		$this->assertSame(
			'  {{Viewer/Link |url=  http://x/1  }} <br>',
			$renderer->render(
				'{{#rdf_type}} {{=<% %>=}} {{Viewer/Link |url= <%={{ }}=%> {{{.}}} {{=<% %>=}} }} <br><%={{ }}=%>{{/rdf_type}}',
				[ 'rdf_type' => [ 'http://x/1' ] ]
			)
		);
	}

	/**
	 * Item-level templates address their value as {{.}}, which means the
	 * current context, so a bare scalar has to become the context itself.
	 */
	public function testBareScalarIsTheContext(): void {
		$renderer = new MustacheRenderer();
		$this->assertSame( '[[Term:A]]', $renderer->render( '[[{{.}}]]', 'Term:A' ) );
	}

	/**
	 * Lustache escapes [&<>"'/] and spells the apostrophe &#39;. PHP's
	 * htmlspecialchars spells it &#039; and leaves the slash alone, so the
	 * escaper is replaced wholesale rather than inherited.
	 */
	public function testEscapingMatchesLustacheApartFromTheSlash(): void {
		$renderer = new MustacheRenderer();

		$this->assertSame(
			'&amp; &lt; &gt; &quot; &#39;',
			$renderer->render( '{{v}}', [ 'v' => '& < > " \'' ] ),
			'&#39; not &#039;'
		);
	}

	/**
	 * The disputed one, and the reason MustacheRenderer takes a flag at all.
	 *
	 * Quantity templates feed rendered values straight into {{#set:}}. Escaping
	 * "/" as "&#x2F;" puts a semicolon inside the value, which SMW then treats
	 * as a separator: the wiki currently stores ["1e-09 &#x2F", "mm³"] rather
	 * than one correct value. The default therefore diverges from the Lua on
	 * purpose, and the flag exists so the parity harness can measure both.
	 *
	 * @see docs/library-choices.md
	 */
	public function testSlashIsNotEscapedByDefault(): void {
		$this->assertSame(
			'1e-09 /mm³',
			( new MustacheRenderer() )->render( '{{v}}', [ 'v' => '1e-09 /mm³' ] )
		);
	}

	public function testSlashEscapingCanBeTurnedOnToReproduceTheLua(): void {
		$this->assertSame(
			'1e-09 &#x2F;mm³',
			( new MustacheRenderer( true ) )->render( '{{v}}', [ 'v' => '1e-09 /mm³' ] )
		);
	}

	public function testTripleStacheIsNotEscaped(): void {
		$renderer = new MustacheRenderer( true );
		$this->assertSame( '1 Gy/s', $renderer->render( '{{{v}}}', [ 'v' => '1 Gy/s' ] ) );
	}

	/**
	 * OSL registers the template itself as the partial "self" so a template can
	 * recurse into nested structures.
	 *
	 * Note the leaf has to shadow the section key with an empty list. Mustache's
	 * context stack walks *up* when a name is missing from the current frame, so
	 * a leaf that simply omits "children" finds its parent's and recurses
	 * forever. That is a property of Mustache, not of this port: Lustache does
	 * the same, and dies with a Lua stack overflow.
	 */
	public function testSelfPartialRecursion(): void {
		$renderer = new MustacheRenderer();
		$template = '{{#children}}[{{name}}{{>self}}]{{/children}}';

		$this->assertSame(
			'[a[b]]',
			$renderer->render( $template, [
				'children' => [ [
					'name' => 'a',
					'children' => [ [ 'name' => 'b', 'children' => [] ] ],
				] ],
			], [ 'self' => $template ] )
		);
	}

	/**
	 * A template that recurses without terminating must fail, not hang.
	 *
	 * Left to itself mustache/php keeps memory flat, so PHP's memory_limit
	 * never trips and the render never returns: measured at over 90 seconds
	 * with no fatal. Since eval_templates come from wiki-editable slots, an
	 * editor could otherwise hang every request that renders the page.
	 */
	public function testRunawayRecursionIsBoundedRatherThanHanging(): void {
		$renderer = new MustacheRenderer();
		// The leaf omits "children", so the context stack finds the parent's.
		$template = '{{#children}}[{{name}}{{>self}}]{{/children}}';

		$started = microtime( true );
		try {
			$renderer->render( $template, [
				'children' => [ [ 'name' => 'a', 'children' => [ [ 'name' => 'b' ] ] ] ],
			], [ 'self' => $template ] );
			$this->fail( 'Expected the expansion budget to stop the render' );
		} catch ( MustacheCompileException $e ) {
			$this->assertStringContainsString( 'expansion limit', $e->getMessage() );
		}

		$this->assertLessThan(
			10.0,
			microtime( true ) - $started,
			'the budget should stop it quickly, not eventually'
		);
	}

	/**
	 * Lustache does not check that a section's closing tag matches its opening
	 * one, so two schemas on the wiki close <%#input_components%> with
	 * <%/input_componentss%> and render as if well formed. A spec-compliant
	 * engine rejects them, and the caller degrades rather than taking the page
	 * down.
	 */
	public function testMismatchedSectionTagsThrowARecognisableException(): void {
		$this->expectException( MustacheCompileException::class );
		( new MustacheRenderer() )->render(
			'{{=<% %>=}}<ul><%#comps%><li><%x%></li><%/compss%></ul>',
			[ 'comps' => [ [ 'x' => 1 ] ] ]
		);
	}

	public function testCompileExceptionCarriesTheTemplate(): void {
		try {
			( new MustacheRenderer() )->render( '{{#a}}unclosed', [] );
			$this->fail( 'Expected a MustacheCompileException' );
		} catch ( MustacheCompileException $e ) {
			$this->assertSame( '{{#a}}unclosed', $e->getTemplate() );
		}
	}

	public function testMissingValuesRenderEmptyRatherThanThrowing(): void {
		$renderer = new MustacheRenderer();
		$this->assertSame( '', $renderer->render( '{{absent}}', [] ) );
		$this->assertSame( '', $renderer->render( '{{#absent}}x{{/absent}}', [] ) );
		$this->assertSame( 'y', $renderer->render( '{{^absent}}y{{/absent}}', [] ) );
	}

	public function testNullViewRendersAsAnEmptyContext(): void {
		$this->assertSame( '', ( new MustacheRenderer() )->render( '{{v}}', null ) );
	}
}
