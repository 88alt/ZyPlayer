use std::collections::HashMap;
use std::ptr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Mutex, MutexGuard};

use napi::{Error, Status};
use once_cell::sync::Lazy;

use crate::api::LibVlcApi;
use crate::event::{on_vlc_event, VlcEventTsfn};
use crate::ffi::{LibvlcEventType, LibvlcInstance, LibvlcMediaPlayer};

pub struct PlayerContext {
  pub instance: *mut LibvlcInstance,
  pub player: *mut LibvlcMediaPlayer,
}

unsafe impl Send for PlayerContext {}

pub struct VlcAddonState {
  pub index: usize,
  pub api: Option<LibVlcApi>,
  pub context: Option<PlayerContext>,

  pub frame_width: u32,
  pub frame_height: u32,
  pub frame_pitch: u32,
  pub next_frame_width: u32,
  pub next_frame_height: u32,
  pub next_frame_pitch: u32,
  pub frame_format_pending: bool,
  pub frame_buffer: Vec<u8>,
  pub frame_dirty: bool,
  pub frame_in_use: bool,
  pub latest_buffering_percent: f64,

  pub event_callbacks: HashMap<String, VlcEventTsfn>,
  pub attached_events: Vec<LibvlcEventType>,
  pub log_enabled: bool,

  pub volume: f64,
  pub muted: bool,
  pub pending_start_progress: Option<f64>,

  #[cfg(target_os = "macos")]
  pub output_parent_view: *mut objc::runtime::Object,
  #[cfg(target_os = "macos")]
  pub video_rect: [f64; 4],
  #[cfg(target_os = "macos")]
  pub vlc_subview: *mut objc::runtime::Object,
}

unsafe impl Send for VlcAddonState {}

impl VlcAddonState {
  pub fn new(index: usize) -> Self {
    Self {
      index,
      api: None,
      context: None,
      frame_width: 1280,
      frame_height: 720,
      frame_pitch: 1280 * 4,
      next_frame_width: 1280,
      next_frame_height: 720,
      next_frame_pitch: 1280 * 4,
      frame_format_pending: false,
      frame_buffer: vec![0; (1280 * 720 * 4) as usize],
      frame_dirty: false,
      frame_in_use: false,
      latest_buffering_percent: 0.0,

      event_callbacks: HashMap::new(),
      attached_events: Vec::new(),
      log_enabled: false,

      volume: 0.5,
      muted: false,
      pending_start_progress: None,

      #[cfg(target_os = "macos")]
      output_parent_view: ptr::null_mut(),
      #[cfg(target_os = "macos")]
      video_rect: [0.0; 4],
      #[cfg(target_os = "macos")]
      vlc_subview: ptr::null_mut(),
    }
  }

  pub fn api(&self) -> Result<&LibVlcApi, Error> {
    self
      .api
      .as_ref()
      .ok_or_else(|| Error::new(Status::InvalidArg, "libVLC is not initialized".to_string()))
  }

  pub fn context(&self) -> Result<&PlayerContext, Error> {
    self.context.as_ref().ok_or_else(|| {
      Error::new(
        Status::InvalidArg,
        "media player is not created".to_string(),
      )
    })
  }

  pub fn context_mut(&mut self) -> Result<&mut PlayerContext, Error> {
    self.context.as_mut().ok_or_else(|| {
      Error::new(
        Status::InvalidArg,
        "media player is not created".to_string(),
      )
    })
  }

  pub fn clear_player(&mut self) {
    self.detach_events();
    if let (Some(api), Some(ctx)) = (self.api.as_ref(), self.context.as_mut()) {
      unsafe {
        if !ctx.player.is_null() {
          if let Some(set_callbacks) = api.libvlc_video_set_callbacks {
            set_callbacks(ctx.player, None, None, None, ptr::null_mut());
          }
          (api.libvlc_media_player_stop)(ctx.player);
          (api.libvlc_media_player_release)(ctx.player);
          ctx.player = ptr::null_mut();
        }
      }
    }
  }

  pub fn clear_all(&mut self) {
    self.clear_player();
    if let (Some(api), Some(ctx)) = (self.api.as_ref(), self.context.take()) {
      unsafe {
        if !ctx.instance.is_null() {
          (api.libvlc_release)(ctx.instance);
        }
      }
    }
    self.context = None;
    self.api = None;
    self.frame_format_pending = false;
    self.frame_in_use = false;
    self.frame_dirty = false;
    self.latest_buffering_percent = 0.0;
    self.log_enabled = false;
    self.volume = 0.5;
    self.muted = false;
    self.pending_start_progress = None;
    self.frame_buffer.clear();
  }

  pub fn detach_events(&mut self) {
    if let (Some(api), Some(ctx)) = (self.api.as_ref(), self.context.as_ref()) {
      unsafe {
        if !ctx.player.is_null() {
          let manager = (api.libvlc_media_player_event_manager)(ctx.player);
          if !manager.is_null() {
            for event in &self.attached_events {
              (api.libvlc_event_detach)(
                manager,
                *event,
                on_vlc_event,
                self.index as *mut std::ffi::c_void,
              );
            }
          }
        }
      }
    }
    self.attached_events.clear();
  }
}

impl Drop for VlcAddonState {
  fn drop(&mut self) {
    self.clear_all();
    self.event_callbacks.clear();
  }
}

pub static INSTANCE_COUNTER: AtomicUsize = AtomicUsize::new(0);

pub static INSTANCES: Lazy<Mutex<HashMap<String, VlcAddonState>>> =
  Lazy::new(|| Mutex::new(HashMap::new()));

pub fn next_instance_index() -> usize {
  INSTANCE_COUNTER.fetch_add(1, Ordering::Relaxed)
}

pub fn lock_instances() -> Result<MutexGuard<'static, HashMap<String, VlcAddonState>>, Error> {
  INSTANCES.lock().map_err(|_| {
    Error::new(
      Status::GenericFailure,
      "failed to acquire vlc instances lock".to_string(),
    )
  })
}

pub fn default_instance_id() -> String {
  "default".to_string()
}
