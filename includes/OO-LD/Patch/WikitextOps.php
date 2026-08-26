<?php

namespace MediaWiki\Extension\MwJson\OOLD\Patch;

use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

/**
 * The operations a patch can perform on a wikitext slot.
 *
 * Applied in array order, each to the result of the previous one, so a set
 * followed by a replace works on the text the set produced.
 */
class WikitextOps {

	/**
	 * How much backtracking a patch author's regex may do.
	 *
	 * Deliberately far below PHP's default of a million. The pattern runs on
	 * every render of every target, so this is the difference between a bad
	 * pattern being a slow page and a bad pattern being a stalled request. A
	 * pattern that needs more than this is one that should have been a literal
	 * replace.
	 */
	private const BACKTRACK_LIMIT = 10000;

	private LoggerInterface $logger;

	public function __construct( ?LoggerInterface $logger = null ) {
		$this->logger = $logger ?? new NullLogger();
	}

	/**
	 * @param string $text The slot as it stands.
	 * @param array $operations Decoded operation objects.
	 * @param string $context Page and slot, for log messages.
	 */
	public function apply( string $text, array $operations, string $context = '' ): string {
		foreach ( $operations as $operation ) {
			if ( !is_array( $operation ) || !isset( $operation['mode'] ) ) {
				continue;
			}
			$text = $this->applyOne( $text, $operation, $context );
		}
		return $text;
	}

	private function applyOne( string $text, array $operation, string $context ): string {
		switch ( $operation['mode'] ) {
			case 'set':
				return (string)( $operation['value'] ?? '' );

			case 'append':
				return $text . (string)( $operation['value'] ?? '' );

			case 'prepend':
				return (string)( $operation['value'] ?? '' ) . $text;

			case 'replace':
				$find = (string)( $operation['find'] ?? '' );
				if ( $find === '' ) {
					return $text;
				}
				return str_replace( $find, (string)( $operation['with'] ?? '' ), $text );

			case 'insert':
				return $this->insert( $text, $operation );

			case 'regex':
				return $this->regex( $text, $operation, $context );

			default:
				$this->logger->warning(
					'MwJson patch: unknown wikitext operation {mode} on {context}',
					[ 'mode' => $operation['mode'], 'context' => $context ]
				);
				return $text;
		}
	}

	/**
	 * Insert at a marker the template already contains.
	 *
	 * The marker stays in place, so the same patch can be applied to a later
	 * revision of the template and still land in the right spot, and two
	 * patches can insert at the same marker without fighting over it.
	 */
	private function insert( string $text, array $operation ): string {
		$at = (string)( $operation['at'] ?? '' );
		$value = (string)( $operation['value'] ?? '' );
		if ( $at === '' || !str_contains( $text, $at ) ) {
			return $text;
		}

		$replacement = ( $operation['before'] ?? false ) ? $value . $at : $at . $value;
		return str_replace( $at, $replacement, $text );
	}

	/**
	 * The escape hatch, fenced in.
	 *
	 * Three ways a pattern can go wrong and each is contained: `e` is rejected,
	 * being the modifier that asks for the replacement to be executed; a
	 * malformed pattern is caught rather than raising a warning mid-render; and
	 * exceeding the backtrack limit is a failure preg_replace signals only
	 * through preg_last_error(), so that is checked rather than trusted.
	 *
	 * A failed operation leaves the text untouched. The alternative, an empty
	 * or half-applied slot, would be worse and harder to notice.
	 */
	private function regex( string $text, array $operation, string $context ): string {
		$pattern = (string)( $operation['pattern'] ?? '' );
		$replacement = (string)( $operation['replacement'] ?? '' );

		if ( !$this->isSafePattern( $pattern, $context ) ) {
			return $text;
		}

		$previous = ini_get( 'pcre.backtrack_limit' );
		ini_set( 'pcre.backtrack_limit', (string)self::BACKTRACK_LIMIT );
		try {
			// phpcs:ignore Generic.PHP.NoSilencedErrors.Discouraged
			$result = @preg_replace( $pattern, $replacement, $text );
		} finally {
			ini_set( 'pcre.backtrack_limit', (string)$previous );
		}

		if ( $result === null || preg_last_error() !== PREG_NO_ERROR ) {
			$this->logger->warning(
				'MwJson patch: regex {pattern} failed on {context}: {error}',
				[
					'pattern' => $pattern,
					'context' => $context,
					'error' => preg_last_error_msg(),
				]
			);
			return $text;
		}

		return $result;
	}

	private function isSafePattern( string $pattern, string $context ): bool {
		// The schema requires /.../flags, but a patch can reach the store by
		// other routes than the form, so the shape is checked here too.
		if ( strlen( $pattern ) < 3 || $pattern[0] !== '/' ) {
			$this->logger->warning(
				'MwJson patch: regex must be slash delimited, got {pattern} on {context}',
				[ 'pattern' => $pattern, 'context' => $context ]
			);
			return false;
		}

		$end = strrpos( $pattern, '/' );
		if ( $end === 0 ) {
			$this->logger->warning(
				'MwJson patch: regex has no closing delimiter on {context}',
				[ 'context' => $context ]
			);
			return false;
		}

		$modifiers = substr( $pattern, $end + 1 );
		if ( preg_match( '/[^imsxuADSUXJ]/', $modifiers ) ) {
			$this->logger->warning(
				'MwJson patch: regex modifier {modifiers} not allowed on {context}',
				[ 'modifiers' => $modifiers, 'context' => $context ]
			);
			return false;
		}

		return true;
	}
}
