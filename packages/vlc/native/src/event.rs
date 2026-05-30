use napi::threadsafe_function::ThreadsafeFunction;
use napi::threadsafe_function::ThreadsafeFunctionCallMode;
use napi::Status;

use crate::ffi::{
  LibvlcEventT, LibvlcEventType, LIBVLC_EVENT_MEDIA_PLAYER_BUFFERING,
  LIBVLC_EVENT_MEDIA_PLAYER_ENCOUNTERED_ERROR, LIBVLC_EVENT_MEDIA_PLAYER_END_REACHED,
  LIBVLC_EVENT_MEDIA_PLAYER_PAUSED, LIBVLC_EVENT_MEDIA_PLAYER_PLAYING,
  LIBVLC_EVENT_MEDIA_PLAYER_POSITION_CHANGED, LIBVLC_EVENT_MEDIA_PLAYER_STOPPED,
  LIBVLC_EVENT_MEDIA_PLAYER_TIME_CHANGED,
};

#[derive(Clone)]
pub struct VlcEventPayload {
  pub event_type: String,
  pub value: f64,
  pub additional_info: String,
}

pub type VlcEventTsfn =
  ThreadsafeFunction<VlcEventPayload, (), (String, f64, String), Status, true>;

pub unsafe extern "C" fn on_vlc_event(
  event: *const LibvlcEventT,
  user_data: *mut std::ffi::c_void,
) {
  if event.is_null() {
    return;
  }

  let event_ref = &*event;

  let (event_name, value, additional_info) = match event_ref.event_type {
    LIBVLC_EVENT_MEDIA_PLAYER_BUFFERING => (
      "buffering".to_string(),
      event_ref.u.media_player_buffering.new_cache as f64,
      "media-player".to_string(),
    ),
    LIBVLC_EVENT_MEDIA_PLAYER_PLAYING => ("playing".to_string(), 1.0, "media-player".to_string()),
    LIBVLC_EVENT_MEDIA_PLAYER_PAUSED => ("paused".to_string(), 0.0, "media-player".to_string()),
    LIBVLC_EVENT_MEDIA_PLAYER_STOPPED => ("stopped".to_string(), 0.0, "media-player".to_string()),
    LIBVLC_EVENT_MEDIA_PLAYER_END_REACHED => ("ended".to_string(), 1.0, "media-player".to_string()),
    LIBVLC_EVENT_MEDIA_PLAYER_ENCOUNTERED_ERROR => {
      ("error".to_string(), -1.0, "media-player".to_string())
    }
    LIBVLC_EVENT_MEDIA_PLAYER_TIME_CHANGED => (
      "time-changed".to_string(),
      event_ref.u.media_player_time_changed.new_time as f64,
      "ms".to_string(),
    ),
    LIBVLC_EVENT_MEDIA_PLAYER_POSITION_CHANGED => (
      "position-changed".to_string(),
      event_ref.u.media_player_position_changed.new_position as f64,
      "ratio".to_string(),
    ),
    _ => (
      "unknown".to_string(),
      event_ref.event_type as f64,
      "media-player".to_string(),
    ),
  };

  let payload = VlcEventPayload {
    event_type: event_name,
    value,
    additional_info,
  };

  let instance_index = user_data as usize;

  if let Ok(mut instances) = crate::state::lock_instances() {
    if let Some(state) = instances.values_mut().find(|s| s.index == instance_index) {
      crate::log::print(
        state.debug_enabled,
        format_args!("event: {} (value={})", payload.event_type, payload.value),
      );

      if payload.event_type == "buffering" {
        state.latest_buffering_percent = payload.value.clamp(0.0, 100.0);
      }

      if let Some(callback) = state.event_callbacks.get(&payload.event_type) {
        let _ = callback.call(Ok(payload.clone()), ThreadsafeFunctionCallMode::NonBlocking);
      }
    }
  }
}

pub const VLC_EVENTS: &[(&str, LibvlcEventType)] = &[
  ("buffering", LIBVLC_EVENT_MEDIA_PLAYER_BUFFERING),
  ("playing", LIBVLC_EVENT_MEDIA_PLAYER_PLAYING),
  ("paused", LIBVLC_EVENT_MEDIA_PLAYER_PAUSED),
  ("stopped", LIBVLC_EVENT_MEDIA_PLAYER_STOPPED),
  ("ended", LIBVLC_EVENT_MEDIA_PLAYER_END_REACHED),
  ("error", LIBVLC_EVENT_MEDIA_PLAYER_ENCOUNTERED_ERROR),
  ("time-changed", LIBVLC_EVENT_MEDIA_PLAYER_TIME_CHANGED),
  (
    "position-changed",
    LIBVLC_EVENT_MEDIA_PLAYER_POSITION_CHANGED,
  ),
];

pub struct VlcEventInfo {
  pub name: &'static str,
  pub vlc_type: LibvlcEventType,
}

pub fn event_types() -> impl Iterator<Item = VlcEventInfo> {
  VLC_EVENTS.iter().map(|(name, vlc_type)| VlcEventInfo {
    name,
    vlc_type: *vlc_type,
  })
}

pub fn event_name_to_vlc_type(event_name: &str) -> Option<LibvlcEventType> {
  VLC_EVENTS
    .iter()
    .find_map(|(name, vlc_type)| (*name == event_name).then_some(*vlc_type))
}
