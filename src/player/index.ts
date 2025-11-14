/**
 * Player Module
 *
 * Provides complete audio playback functionality including:
 * - Low-level playback engine (HTML5 Audio API)
 * - Progress tracking and persistence
 * - High-level player control
 */

// Export playback engine
export {
	PlaybackEngine,
	type PlaybackStatus,
	type AudioMetadata,
	type PlaybackEventHandlers,
} from './PlaybackEngine';

// Export progress tracker
export {
	ProgressTracker,
	type ProgressTrackingOptions,
} from './ProgressTracker';

// Export player controller
export {
	PlayerController,
	type PlayerEventHandlers,
} from './PlayerController';
