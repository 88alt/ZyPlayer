use std::ffi::CStr;

use napi::{Error, Status};

use crate::api::LibVlcApi;
use crate::ffi::LibvlcTrackDescriptionT;
use crate::types::{Track, VlcPlayerState};

pub fn to_napi_error(message: impl Into<String>) -> Error {
  Error::new(Status::GenericFailure, message.into())
}

pub fn latest_vlc_error(api: &LibVlcApi, fallback: &str) -> String {
  unsafe {
    let ptr = (api.libvlc_errmsg)();
    if ptr.is_null() {
      return fallback.to_string();
    }

    CStr::from_ptr(ptr)
      .to_str()
      .map(|s| {
        if s.is_empty() {
          fallback.to_string()
        } else {
          s.to_string()
        }
      })
      .unwrap_or_else(|_| fallback.to_string())
  }
}

pub fn state_from_raw(raw: i32) -> VlcPlayerState {
  match raw {
    0 => VlcPlayerState::NothingSpecial,
    1 => VlcPlayerState::Opening,
    2 => VlcPlayerState::Buffering,
    3 => VlcPlayerState::Playing,
    4 => VlcPlayerState::Paused,
    5 => VlcPlayerState::Stopped,
    6 => VlcPlayerState::Ended,
    7 => VlcPlayerState::Error,
    _ => VlcPlayerState::Unknown,
  }
}

pub fn is_http_media(media: &str) -> bool {
  media.starts_with("http://")
    || media.starts_with("https://")
    || media.starts_with("rtsp://")
    || media.starts_with("rtmp://")
}

pub fn normalize_media_path(media_path: &str) -> String {
  if media_path.starts_with("file://") {
    media_path.trim_start_matches("file://").to_string()
  } else {
    media_path.to_string()
  }
}

pub fn track_list(
  api: &LibVlcApi,
  head: *mut LibvlcTrackDescriptionT,
  active_id: i32,
) -> Vec<Track> {
  let mut result: Vec<Track> = Vec::new();

  unsafe {
    let mut current = head;
    while !current.is_null() {
      let item = &*current;
      let name = if item.psz_name.is_null() {
        String::new()
      } else {
        CStr::from_ptr(item.psz_name).to_string_lossy().to_string()
      };

      result.push(Track {
        id: item.i_id,
        name,
        is_active: item.i_id == active_id,
      });

      current = item.p_next;
    }

    if !head.is_null() {
      (api.libvlc_track_description_list_release)(head);
    }
  }

  result
}
