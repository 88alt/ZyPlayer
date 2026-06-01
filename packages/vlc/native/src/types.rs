use napi_derive::napi;
use std::collections::HashMap;

#[napi(object)]
pub struct Track {
  pub id: i32,
  pub name: String,
  pub is_active: bool,
}

#[napi(object)]
pub struct CreatePath {
  pub lib_path: String,
  pub plugin_path: Option<String>,
}

#[napi(object)]
pub struct CreateOptions {
  pub url: String,
  pub headers: Option<HashMap<String, String>>,
  pub debug: Option<bool>,
  pub seek_step: Option<i64>,
  pub volume_step: Option<f64>,
  pub el: Option<String>,
  pub autoplay: Option<bool>,
  pub volume: Option<f64>,
  pub r#loop: Option<bool>,
  pub start_time: Option<i64>,
  pub playback_rate: Option<f64>,
  pub buffer_cache: Option<i64>,
  pub muted: Option<bool>,
}

#[napi(string_enum)]
pub enum VlcPlayerState {
  #[napi(value = "nothing-special")]
  NothingSpecial,
  #[napi(value = "opening")]
  Opening,
  #[napi(value = "buffering")]
  Buffering,
  #[napi(value = "playing")]
  Playing,
  #[napi(value = "paused")]
  Paused,
  #[napi(value = "stopped")]
  Stopped,
  #[napi(value = "ended")]
  Ended,
  #[napi(value = "error")]
  Error,
  #[napi(value = "unknown")]
  Unknown,
}
