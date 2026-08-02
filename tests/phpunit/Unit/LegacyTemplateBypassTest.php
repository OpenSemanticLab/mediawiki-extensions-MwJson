<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\Template\LegacyTemplateBypass;
use PHPUnit\Framework\TestCase;

/**
 * Recognition has to be conservative: ignoring a template that is not purely a
 * language switch or a link would silently drop whatever else it did, and the
 * parity harness only catches that if some page happens to exercise it. Most of
 * these cases are therefore about refusing to match.
 *
 * @covers \MediaWiki\Extension\MwJson\Template\LegacyTemplateBypass
 */
class LegacyTemplateBypassTest extends TestCase {

	private LegacyTemplateBypass $bypass;

	protected function setUp(): void {
		parent::setUp();
		$this->bypass = new LegacyTemplateBypass();
	}

	private function wikitext( string $value ): array {
		return [ 'type' => 'mustache-wikitext', 'value' => $value ];
	}

	/** The exact template Category:Entity carries for label, short_name and description. */
	public function testRecognisesTheLanguageSwitch(): void {
		$template = $this->wikitext(
			'{{=<% %>=}} {{#switch:{{USERLANGUAGECODE}} <%#label%> '
			. '| {{#ifeq: <%lang%>|en|#default|<%lang%>}} = <%text%> <%/label%> }}'
		);

		$this->assertSame(
			LegacyTemplateBypass::CLASS_LANGUAGE,
			$this->bypass->classify( $template, 'label' )
		);
	}

	/** The page form, as used for type, classification_categories and keywords. */
	public function testRecognisesTheViewerLinkPageForm(): void {
		$template = $this->wikitext( '{{=<% %>=}} <%#type%> {{Viewer/Link |page=<%.%> }} <br><%/type%>' );

		$this->assertSame(
			LegacyTemplateBypass::CLASS_LINK,
			$this->bypass->classify( $template, 'type' )
		);
	}

	/** The url form, as used for rdf_type and the ontology-match properties. */
	public function testRecognisesTheViewerLinkUrlForm(): void {
		$template = $this->wikitext(
			'{{#rdf_type}} {{=<% %>=}} {{Viewer/Link |url= <%={{ }}=%> {{{.}}} {{=<% %>=}} }} '
			. '<br><%={{ }}=%>{{/rdf_type}}'
		);

		$this->assertSame(
			LegacyTemplateBypass::CLASS_LINK,
			$this->bypass->classify( $template, 'rdf_type' )
		);
	}

	/**
	 * The section key has to match the property. A template attached to one
	 * property but iterating another is not the shape being recognised, and
	 * bypassing it would render the wrong value.
	 */
	public function testRefusesWhenTheSectionKeyIsNotTheProperty(): void {
		$template = $this->wikitext( '{{=<% %>=}} <%#other%> {{Viewer/Link |page=<%.%> }} <br><%/other%>' );

		$this->assertNull( $this->bypass->classify( $template, 'type' ) );
	}

	/**
	 * A template that also queries or writes is doing more than the shape
	 * describes, so it must be rendered even though it matches in part.
	 *
	 * @dataProvider provideDisqualifying
	 */
	public function testRefusesTemplatesThatDoMore( string $value ): void {
		$this->assertNull( $this->bypass->classify( $this->wikitext( $value ), 'type' ) );
	}

	public static function provideDisqualifying(): array {
		return [
			'ask' => [ '{{=<% %>=}} <%#type%> {{Viewer/Link |page=<%.%> }} {{#ask:[[X::Y]]}}<%/type%>' ],
			'set' => [ '{{=<% %>=}} <%#type%> {{Viewer/Link |page=<%.%> }} {{#set:|A=B}}<%/type%>' ],
			'info' => [ '{{=<% %>=}} <%#type%> {{Viewer/Link |page=<%.%> }} {{#info:hi}}<%/type%>' ],
			'arraymap' => [ '{{=<% %>=}} <%#type%> {{#arraymap:<%.%>|;|x|[[x]]}}<%/type%>' ],
		];
	}

	/**
	 * Trailing content means the template emits something the native rendering
	 * would not, so the anchors must reject it rather than matching a prefix.
	 */
	public function testRefusesWhenThereIsExtraOutput(): void {
		$template = $this->wikitext(
			'{{=<% %>=}} <%#type%> {{Viewer/Link |page=<%.%> }} <br><%/type%> and some trailing text'
		);

		$this->assertNull( $this->bypass->classify( $template, 'type' ) );
	}

	/**
	 * A plain mustache template costs no parser round-trip, so there is nothing
	 * to gain by bypassing it and a shape to lose.
	 */
	public function testRefusesPlainMustache(): void {
		$template = [ 'type' => 'mustache', 'value' => '{{#type}}[[{{.}}]]{{/type}}' ];

		$this->assertNull( $this->bypass->classify( $template, 'type' ) );
	}

	public function testRefusesUnrecognisedShapes(): void {
		$this->assertNull( $this->bypass->classify( $this->wikitext( '{{{type}}}' ), 'type' ) );
		$this->assertNull( $this->bypass->classify( $this->wikitext( '' ), 'type' ) );
		$this->assertNull( $this->bypass->classify( [ 'type' => 'mustache-wikitext' ], 'type' ) );
	}
}
