<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use InvalidArgumentException;
use MediaWiki\Extension\MwJson\OOLD\SchemaKeys;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\MwJson\OOLD\SchemaKeys
 */
class SchemaKeysTest extends TestCase {

	private SchemaKeys $keys;

	protected function setUp(): void {
		parent::setUp();
		$this->keys = new SchemaKeys();
	}

	/**
	 * The legacy names must match p.keys in MwJson.lua exactly; they are what
	 * every schema on the wiki is written against today.
	 *
	 * @dataProvider provideLegacyKeys
	 */
	public function testLegacyKeysMatchTheLuaTable( string $concept, string $expected ): void {
		$this->assertSame( $expected, $this->keys->legacy( $concept ) );
	}

	public static function provideLegacyKeys(): array {
		// Transcribed from docs/legacy-lua/MwJson.lua:7-24.
		return [
			[ 'category', 'type' ],
			[ 'subcategory', 'subclass_of' ],
			[ 'schemaType', 'schema_type' ],
			[ 'schema', 'osl_schema' ],
			[ 'template', 'eval_template' ],
			[ 'mode', 'mode' ],
			[ 'context', '@context' ],
			[ 'allOf', 'allOf' ],
			[ 'label', 'label' ],
			[ 'name', 'name' ],
			[ 'description', 'description' ],
			[ 'text', 'text' ],
			[ 'smwQuantityProperty', 'x-smw-quantity-property' ],
			[ 'debug', '_debug' ],
		];
	}

	public function testNamespaceConstantsMatchTheLuaTable(): void {
		$this->assertSame( 'Property', SchemaKeys::PROPERTY_NS_PREFIX );
		$this->assertSame( 'Category', SchemaKeys::CATEGORY_PSEUDO_PROPERTY );
	}

	public function testUnknownConceptThrowsRatherThanReadingAKeyThatIsNeverPresent(): void {
		$this->expectException( InvalidArgumentException::class );
		$this->keys->legacy( 'notAConcept' );
	}

	public function testReadPrefersOoLdKeywordOverLegacy(): void {
		$node = [
			'schema_type' => [ 'legacy' ],
			'x-oold-instance-rdf-type' => [ 'oold' ],
		];
		$this->assertSame( [ 'oold' ], $this->keys->read( $node, 'schemaType' ) );
	}

	public function testReadFallsBackToLegacyKeyword(): void {
		$this->assertSame(
			[ 'legacy' ],
			$this->keys->read( [ 'schema_type' => [ 'legacy' ] ], 'schemaType' )
		);
	}

	public function testReadReturnsDefaultWhenNeitherKeywordIsPresent(): void {
		$this->assertSame( 'fallback', $this->keys->read( [], 'schemaType', 'fallback' ) );
	}

	public function testReadReturnsAnExplicitNullRatherThanTheDefault(): void {
		// A schema that explicitly sets a key to null has said something; that
		// is distinct from omitting it, and OO-LD's merge rules give null a
		// meaning (delete). Do not collapse the two.
		$this->assertNull( $this->keys->read( [ 'schema_type' => null ], 'schemaType', 'fallback' ) );
	}

	/**
	 * Legacy UI annotations live at a path (options.hidden), OO-LD gives them a
	 * flat keyword.
	 */
	public function testReadUiResolvesLegacyPath(): void {
		$node = [ 'options' => [ 'hidden' => true ] ];
		$this->assertTrue( $this->keys->readUi( $node, 'renderHidden', false ) );
		$this->assertTrue( $this->keys->readUi( $node, 'formHidden', false ) );
	}

	public function testReadUiPrefersOoLdKeyword(): void {
		$node = [
			'options' => [ 'hidden' => true ],
			'x-oold-ui-render-hidden' => false,
		];
		$this->assertFalse( $this->keys->readUi( $node, 'renderHidden', null ) );
		// The OO-LD split means a schema can hide a property in forms while
		// still rendering it, which the single legacy flag could not express.
		$this->assertTrue( $this->keys->readUi( $node, 'formHidden', null ) );
	}

	public function testReadUiPropertyOrder(): void {
		$this->assertSame( 42, $this->keys->readUi( [ 'propertyOrder' => 42 ], 'propertyOrder' ) );
		$this->assertSame(
			7,
			$this->keys->readUi( [ 'x-oold-ui-property-order' => 7, 'propertyOrder' => 42 ], 'propertyOrder' )
		);
		$this->assertNull( $this->keys->readUi( [], 'propertyOrder' ) );
	}

	public function testReadUiEnumTitles(): void {
		$node = [ 'options' => [ 'enum_titles' => [ 'm', 'cm' ] ] ];
		$this->assertSame( [ 'm', 'cm' ], $this->keys->readUi( $node, 'enumTitles' ) );
	}

	public function testUnknownUiConceptThrows(): void {
		$this->expectException( InvalidArgumentException::class );
		$this->keys->readUi( [], 'notAUiConcept' );
	}

	/**
	 * The `title*` suffix is OSL's existing inline shorthand and is also OO-LD's
	 * documented multi-mapping form, so both spellings must resolve.
	 */
	public function testReadMultilangResolvesLegacySuffix(): void {
		$node = [ 'title*' => [ 'de' => 'Etikett', 'en' => 'Label' ] ];
		$this->assertSame( [ 'de' => 'Etikett', 'en' => 'Label' ], $this->keys->readMultilang( $node, 'title' ) );
	}

	public function testReadMultilangPrefersOoLdKeyword(): void {
		$node = [
			'title*' => [ 'en' => 'legacy' ],
			'x-oold-multilang-title' => [ 'en' => 'oold' ],
		];
		$this->assertSame( [ 'en' => 'oold' ], $this->keys->readMultilang( $node, 'title' ) );
	}

	public function testReadMultilangReturnsNullWhenAbsentOrNotAMap(): void {
		$this->assertNull( $this->keys->readMultilang( [], 'title' ) );
		// A plain "title": "..." is a language-neutral string, not a language
		// map; renderMultilangValue treats it as the English fallback and must
		// not receive it from here.
		$this->assertNull( $this->keys->readMultilang( [ 'title' => 'Label' ], 'title' ) );
	}

	public function testEveryConceptResolvesToANonEmptyLegacyKeyword(): void {
		// Guards against a half-added vocabulary entry.
		foreach ( self::provideLegacyKeys() as [ $concept, ] ) {
			$this->assertNotSame( '', $this->keys->legacy( $concept ), $concept );
		}
	}
}
