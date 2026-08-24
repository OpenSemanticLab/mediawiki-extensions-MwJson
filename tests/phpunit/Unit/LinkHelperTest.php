<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\Render\LinkHelper;
use MediaWiki\Extension\MwJson\Render\LinkLabelResolver;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\MwJson\Render\LinkHelper
 */
class LinkHelperTest extends TestCase {

	/**
	 * Without a resolver every linkable value goes through the wiki template,
	 * which is the behaviour to keep when the feature is switched off.
	 */
	public function testFallsBackToTheTemplate(): void {
		$helper = new LinkHelper( new StubWikitextPreprocessor() );

		$this->assertSame(
			'TPL[Viewer/Link|page=Item:OSW1]',
			$helper->wrapLinkIfNamespaced( 'Item:OSW1' )
		);
	}

	/**
	 * @dataProvider provideNonTitles
	 * @param mixed $value
	 */
	public function testLeavesNonTitlesAlone( $value ): void {
		$helper = new LinkHelper( new StubWikitextPreprocessor(), $this->resolver() );
		$this->assertSame( $value, $helper->wrapLinkIfNamespaced( $value ) );
	}

	public static function provideNonTitles(): array {
		return [
			'plain prose' => [ 'just text' ],
			// Prose with a colon is not a title, and Lua's %a is ASCII only, so
			// a non-ASCII prefix must not be taken for a namespace.
			'prose with a colon' => [ 'Größe: 5' ],
			'unlinked namespace' => [ 'JsonSchema:PostalAddress' ],
			'empty title part' => [ 'Item:' ],
			'already a link' => [ '[[Item:OSW1|Thing]]' ],
			'not a string' => [ 42 ],
		];
	}

	/**
	 * @dataProvider provideLinks
	 */
	public function testBuildsLinks( string $value, ?string $label, string $expected ): void {
		$helper = new LinkHelper(
			new StubWikitextPreprocessor(),
			$this->resolver( [ $value => $label ] )
		);

		$this->assertSame( $expected, $helper->wrapLinkIfNamespaced( $value ) );
	}

	public static function provideLinks(): array {
		return [
			'labelled' => [ 'Item:OSW1', 'Volume', '[[Item:OSW1|Volume]]' ],
			// No label is a valid outcome, not a failure: it renders the raw
			// title, which is what Module:Viewer/Link does when its query comes
			// back empty, including when the reader may not see the target.
			'no label' => [ 'Item:OSW1', null, '[[Item:OSW1]]' ],
			'empty label' => [ 'Item:OSW1', '', '[[Item:OSW1]]' ],
			// A category needs the leading colon, or the link files the current
			// page into the category instead of pointing at it.
			'category' => [ 'Category:Entity', 'Entity', '[[:Category:Entity|Entity]]' ],
			'category unlabelled' => [ 'Category:Entity', null, '[[:Category:Entity]]' ],
			'property' => [ 'Property:HasLabel', 'Label', '[[Property:HasLabel|Label]]' ],
			'subobject anchor' => [ 'Item:OSW1#OSW2', 'Part', '[[Item:OSW1#OSW2|Part]]' ],
		];
	}

	/**
	 * A resolver that declines a target has not assessed it, so the template
	 * has to run. Treating that as "no label" would silently drop the label
	 * every file link carries today.
	 */
	public function testDeclinedTargetsGoBackToTheTemplate(): void {
		$helper = new LinkHelper( new StubWikitextPreprocessor(), $this->resolver( [], false ) );

		$this->assertSame(
			'TPL[Viewer/Link|page=File:Photo.png]',
			$helper->wrapLinkIfNamespaced( 'File:Photo.png' )
		);
	}

	public function testPrefetchPassesOnlyLinkableValues(): void {
		$resolver = $this->resolver();
		$helper = new LinkHelper( new StubWikitextPreprocessor(), $resolver );

		$helper->prefetch( [ 'Item:OSW1', 'just text', 42, 'Category:Entity', '[[Item:OSW2]]' ] );

		$this->assertSame( [ 'Item:OSW1', 'Category:Entity' ], $resolver->prefetched );
	}

	/**
	 * @param array<string,string|null> $labels
	 */
	private function resolver( array $labels = [], bool $handles = true ): LinkLabelResolver {
		return new class( $labels, $handles ) implements LinkLabelResolver {
			/** @var array<string,string|null> */
			private array $labels;
			private bool $handles;
			/** @var array<int,string> */
			public array $prefetched = [];

			public function __construct( array $labels, bool $handles ) {
				$this->labels = $labels;
				$this->handles = $handles;
			}

			public function prefetch( array $titles ): void {
				$this->prefetched = $titles;
			}

			public function handles( string $title ): bool {
				return $this->handles;
			}

			public function label( string $title ): ?string {
				return $this->labels[$title] ?? null;
			}
		};
	}
}
