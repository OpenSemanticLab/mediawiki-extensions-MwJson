<?php

namespace MediaWiki\Extension\MwJson\OOLD\Patch;

use JsonPath\JsonObject;
use MediaWiki\Extension\MwJson\OOLD\JsonUtil;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Throwable;

/**
 * OpenAPI Overlay 1.0, for the surgery a merge patch cannot express.
 *
 * A merge patch addresses by key, so it can replace a list but not remove one
 * member of it. An Overlay action addresses by JSONPath, so it can say "the
 * enum entry whose value is Item:OSWu2" and take that out.
 *
 * Two details of the spec are easy to trip over and are documented in the
 * editor as well: `update` appends to an array rather than replacing it, and
 * `remove` makes the action ignore `update` entirely. Replacing an array
 * therefore takes two actions, or a merge patch.
 *
 * @see https://spec.openapis.org/overlay/latest.html
 */
class OverlayPatch {

	private LoggerInterface $logger;

	public function __construct( ?LoggerInterface $logger = null ) {
		$this->logger = $logger ?? new NullLogger();
	}

	/**
	 * @param array $document The document being patched.
	 * @param array $overlay An overlay object, with `actions`.
	 * @param string $context Page and slot, for log messages.
	 */
	public function apply( array $document, array $overlay, string $context = '' ): array {
		$actions = $overlay['actions'] ?? null;
		if ( !is_array( $actions ) ) {
			return $document;
		}

		foreach ( $actions as $action ) {
			if ( is_array( $action ) ) {
				$document = $this->applyAction( $document, $action, $context );
			}
		}

		return $document;
	}

	private function applyAction( array $document, array $action, string $context ): array {
		$target = $action['target'] ?? null;
		if ( !is_string( $target ) || $target === '' ) {
			return $document;
		}

		try {
			$json = new JsonObject( $document );
			$matches = $json->getJsonObjects( $target );
		} catch ( Throwable $error ) {
			$this->logger->warning(
				'MwJson patch: JSONPath {target} is not usable on {context}: {message}',
				[ 'target' => $target, 'context' => $context, 'message' => $error->getMessage() ]
			);
			return $document;
		}

		// A path that matches nothing is not an error. Patches outlive the
		// pages they target, so a target that has moved on should leave the
		// document alone rather than take the render down.
		if ( $matches === false || $matches === [] ) {
			$this->logger->debug(
				'MwJson patch: JSONPath {target} matched nothing on {context}',
				[ 'target' => $target, 'context' => $context ]
			);
			return $document;
		}

		if ( $action['remove'] ?? false ) {
			return $this->removeMatches( $json, $matches );
		}

		if ( array_key_exists( 'update', $action ) ) {
			foreach ( $matches as $match ) {
				$node = &$match->getValue();
				$node = $this->update( $node, $action['update'] );
				unset( $node );
			}
		}

		return $json->getValue();
	}

	/**
	 * Spec: an update merges into an object and appends to an array.
	 *
	 * @param mixed $node
	 * @param mixed $update
	 * @return mixed
	 */
	private function update( $node, $update ) {
		if ( JsonUtil::hasFirstElement( $node ) ) {
			$node[] = $update;
			return $node;
		}

		if ( is_array( $node ) && is_array( $update ) ) {
			foreach ( $update as $key => $value ) {
				$node[$key] = array_key_exists( $key, $node )
					? $this->update( $node[$key], $value )
					: $value;
			}
			return $node;
		}

		return $update;
	}

	/**
	 * Delete the matched nodes from their parents.
	 *
	 * The JSONPath library hands back references to matched values but never
	 * says where they came from, and there is no parent to unset a key on. So:
	 * write a sentinel through each reference, then walk the document once and
	 * drop every entry holding it. Compared by identity against a fresh object,
	 * so no value a document could legitimately contain can be mistaken for it.
	 *
	 * Doing it this way keeps the library's own path semantics, filter
	 * expressions included, rather than reimplementing JSONPath to find
	 * parents.
	 *
	 * @param JsonObject[] $matches
	 */
	private function removeMatches( JsonObject $json, array $matches ): array {
		$sentinel = new \stdClass();

		foreach ( $matches as $match ) {
			$node = &$match->getValue();
			$node = $sentinel;
			unset( $node );
		}

		$document = $json->getValue();
		return $this->sweep( $document, $sentinel );
	}

	/**
	 * @param mixed $value
	 * @return mixed
	 */
	private function sweep( $value, \stdClass $sentinel ) {
		if ( !is_array( $value ) ) {
			return $value;
		}

		// Whether this is a list decides how it is rebuilt: a list has to be
		// renumbered after a removal or it turns into an object keyed 0, 2, 3
		// and re-encodes as one.
		$isList = JsonUtil::hasFirstElement( $value );
		$result = [];

		foreach ( $value as $key => $item ) {
			if ( $item === $sentinel ) {
				continue;
			}
			$swept = $this->sweep( $item, $sentinel );
			if ( $isList ) {
				$result[] = $swept;
			} else {
				$result[$key] = $swept;
			}
		}

		return $result;
	}
}
