<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Extension\MwJson\OOLD\SemanticMapping;
use Parser;
use SMW\ParameterProcessorFactory;
use SMW\Services\ServicesFactory;

/**
 * Applies a SemanticMapping to SemanticMediaWiki.
 *
 * The mapping is produced without touching the store, so this is the only place
 * that writes. Keeping the two apart is what lets the parity harness compare
 * what *would* be stored, and what makes the mapper unit-testable.
 *
 * Calls SMW through the same path SemanticScribunto's mw.smw.set and
 * mw.smw.subobject use, so SMW receives byte-identical input to what the Lua
 * gave it. In particular the subobject id goes in at parameter position 0 and
 * the arguments are ksorted afterwards, without which SMW's
 * ParameterProcessorFactory does not recognise it as an id.
 *
 * @see \SMW\Scribunto\ScribuntoLuaLibrary
 */
class SmwWriter {

	private Parser $parser;

	public function __construct( Parser $parser ) {
		$this->parser = $parser;
	}

	/**
	 * Write a mapping: subobjects first, in traversal order, then the page
	 * properties.
	 *
	 * That order matters. The Lua stores each subobject as it reaches it and
	 * leaves the page-level set to its caller, so anything that reads SMW data
	 * mid-parse sees the same state at the same point.
	 *
	 * @return string[] Error messages, empty when everything stored.
	 */
	public function write( SemanticMapping $mapping ): array {
		$errors = [];

		foreach ( $mapping->subobjects as $subobject ) {
			$error = $this->writeSubobject( $subobject['properties'], $subobject['id'] );
			if ( $error !== null ) {
				$errors[] = $error;
			}
		}

		$error = $this->writeProperties( $mapping->properties );
		if ( $error !== null ) {
			$errors[] = $error;
		}

		return $errors;
	}

	/**
	 * @param array<string,mixed> $properties
	 * @return string|null An error message, or null on success.
	 */
	public function writeProperties( array $properties ): ?string {
		if ( $properties === [] ) {
			return null;
		}

		$setParserFunction = ServicesFactory::getInstance()
			->newParserFunctionFactory()
			->newSetParserFunction( $this->parser );

		return $this->resultToError(
			$setParserFunction->parse(
				ParameterProcessorFactory::newFromArray( $this->flatten( $properties ) )
			)
		);
	}

	/**
	 * @param array<string,mixed> $properties
	 * @return string|null An error message, or null on success.
	 */
	public function writeSubobject( array $properties, ?string $id = null ): ?string {
		if ( $properties === [] ) {
			return null;
		}

		$arguments = $this->flatten( $properties );

		// Position 0 is the subobject id. It is always reserved, even when
		// unnamed, because SMW reads the id positionally.
		array_unshift( $arguments, null );
		if ( $id !== null && $id !== '' ) {
			$arguments[0] = $id;
			ksort( $arguments );
		}

		$subobjectParserFunction = ServicesFactory::getInstance()
			->newParserFunctionFactory()
			->newSubobjectParserFunction( $this->parser );

		return $this->resultToError(
			$subobjectParserFunction->parse( ParameterProcessorFactory::newFromArray( $arguments ) )
		);
	}

	/**
	 * Turn "property => list of values" into the flat "property=value" argument
	 * list SMW's parameter processor expects, one entry per value.
	 *
	 * @param array<string,mixed> $properties
	 * @return array<int|string,mixed>
	 */
	private function flatten( array $properties ): array {
		$arguments = [];
		foreach ( $properties as $name => $values ) {
			foreach ( is_array( $values ) ? $values : [ $values ] as $value ) {
				if ( $value === null || $value === '' ) {
					continue;
				}
				$arguments[] = $name . '=' . $value;
			}
		}
		return $arguments;
	}

	/**
	 * SMW's parser functions return the empty string on success and rendered
	 * error markup otherwise, which is what SemanticScribunto keys off too.
	 *
	 * @param string|array $result
	 */
	private function resultToError( $result ): ?string {
		if ( is_array( $result ) ) {
			$result = $result[0] ?? '';
		}
		$result = (string)$result;

		return $result === '' ? null : preg_replace( '/<[^>]+>/', '', $result );
	}
}
