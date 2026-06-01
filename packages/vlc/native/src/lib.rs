#![allow(unexpected_cfgs)]

mod api;
mod event;
mod ffi;
mod log;
mod platform;
mod state;
mod types;
mod util;

use std::env;
#[cfg(all(unix, not(target_os = "macos")))]
use std::ffi::c_uint;
use std::ffi::c_void;
use std::ffi::{c_char, c_float, c_int, c_longlong, CString};
use std::path::Path;
use std::ptr;

use napi::bindgen_prelude::{Buffer, Function, Result as NapiResult, Status};
use napi::threadsafe_function::ThreadsafeCallContext;
use napi::Error;
use napi_derive::napi;

use api::LibVlcApi;
use event::{event_name_to_vlc_type, event_types, on_vlc_event, VlcEventPayload, VlcEventTsfn};
use ffi::{LibvlcInstance, LibvlcMediaPlayer};

use state::{default_instance_id, lock_instances, next_instance_index};
use types::{CreateOptions, CreatePath, Track, VlcPlayerState};
use util::{is_http_media, latest_vlc_error, normalize_media_path, state_from_raw, to_napi_error, track_list};

fn frame_buffer_size(pitch: u32, height: u32) -> usize {
  (pitch.saturating_mul(height)).max(4) as usize
}

fn apply_pending_frame_format_if_safe(state: &mut state::VlcAddonState) {
  if state.frame_in_use {
    return;
  }

  let Some(frame) = state.pending_frame.take() else {
    return;
  };

  state.current_frame = frame;
  state.frame_buffer = vec![0; frame_buffer_size(frame.pitch, frame.height)];
  state.frame_dirty = false;
}

unsafe extern "C" fn video_lock_callback(
  _opaque: *mut c_void,
  planes: *mut *mut c_void,
) -> *mut c_void {
  let instance_index = _opaque as usize;
  match lock_instances() {
    Ok(mut instances) => {
      let state = instances.values_mut().find(|s| s.index == instance_index);
      match state {
        Some(state) => {
          if state.frame_buffer.is_empty() {
            let size = frame_buffer_size(state.current_frame.pitch, state.current_frame.height);
            state.frame_buffer.resize(size, 0);
          }
          state.frame_in_use = true;
          if !planes.is_null() {
            let ptr = state.frame_buffer.as_mut_ptr() as *mut c_void;
            *planes = ptr;
            return ptr;
          }
          ptr::null_mut()
        }
        None => ptr::null_mut(),
      }
    }
    Err(_) => ptr::null_mut(),
  }
}

unsafe extern "C" fn video_unlock_callback(
  _opaque: *mut c_void,
  _picture: *mut c_void,
  _planes: *mut *mut c_void,
) {
  let instance_index = _opaque as usize;
  if let Ok(mut instances) = lock_instances() {
    if let Some(state) = instances.values_mut().find(|s| s.index == instance_index) {
      state.frame_in_use = false;
      state.frame_dirty = true;
    }
  }
}

unsafe extern "C" fn video_display_callback(_opaque: *mut c_void, _picture: *mut c_void) {}

fn resolve_instance_id(id: Option<String>) -> String {
  id.unwrap_or_else(default_instance_id)
}

fn load_dylib(instance_id: &str, lib_path: String, plugin_path: Option<String>) -> NapiResult<()> {
  let mut instances = lock_instances()?;

  if lib_path.trim().is_empty() || !Path::new(&lib_path).exists() {
    return Err(to_napi_error(format!("lib_path not found: {lib_path}",)));
  }
  env::set_var("VLC_LIB_PATH", &lib_path);

  if let Some(path) = plugin_path {
    if Path::new(&path).exists() {
      env::set_var("VLC_PLUGIN_PATH", path);
    }
  }

  let api = LibVlcApi::load(&lib_path).map_err(to_napi_error)?;

  let args_raw = vec!["--no-video-title-show"];
  let args: Vec<CString> = args_raw
    .into_iter()
    .map(|s| CString::new(s).unwrap())
    .collect();
  let arg_ptrs: Vec<*const c_char> = args.iter().map(|s| s.as_ptr()).collect();

  let vlc_instance = unsafe { (api.libvlc_new)(arg_ptrs.len() as c_int, arg_ptrs.as_ptr()) };
  if vlc_instance.is_null() {
    let vlc_err = latest_vlc_error(&api, "unknown error");
    return Err(to_napi_error(format!(
      "failed to initialize libVLC instance: {vlc_err}"
    )));
  }

  let index = next_instance_index();
  let mut state = state::VlcAddonState::new(index);
  state.api = Some(api);
  state.context = Some(state::PlayerContext {
    instance: vlc_instance,
    player: ptr::null_mut(),
  });

  instances.insert(instance_id.to_string(), state);

  Ok(())
}

fn load_media(instance_id: &str, options: CreateOptions) -> NapiResult<()> {
  let CreateOptions {
    url: media_path,
    headers,
    volume,
    playback_rate,
    autoplay,
    start_time,
    buffer_cache,
    debug,
    muted,
    ..
  } = options;

  let media_path = media_path.trim();
  if media_path.is_empty() {
    return Err(Error::new(
      Status::InvalidArg,
      "options.url is required".to_string(),
    ));
  }

  let is_network_media = is_http_media(media_path);

  let api: *const LibVlcApi;
  let vlc_instance: *mut LibvlcInstance;
  let instance_index: usize;
  {
    let mut instances = lock_instances()?;
    let state = instances
      .get_mut(instance_id)
      .ok_or_else(|| to_napi_error(format!("instance not found: {instance_id}")))?;
    state.debug_enabled = debug.unwrap_or(false);
    api = state.api()? as *const LibVlcApi;
    vlc_instance = state.context()?.instance;
    instance_index = state.index;
  }
  let api = unsafe { &*api };

  // Create media
  let media_cstr = if is_network_media {
    CString::new(media_path)
  } else {
    CString::new(normalize_media_path(media_path))
  }
  .map_err(|e| to_napi_error(e.to_string()))?;

  let media = unsafe {
    if is_network_media {
      (api.libvlc_media_new_location)(vlc_instance, media_cstr.as_ptr())
    } else {
      (api.libvlc_media_new_path)(vlc_instance, media_cstr.as_ptr())
    }
  };

  if media.is_null() {
    return Err(to_napi_error(latest_vlc_error(
      api,
      "failed to create media",
    )));
  }

  // log level
  if debug.unwrap_or(false) {
    let opt = CString::new(":verbose=2").map_err(|e| to_napi_error(e.to_string()))?;
    unsafe { (api.libvlc_media_add_option)(media, opt.as_ptr()); }
  }

  // start_time (ms → seconds)
  if let Some(start_time) = start_time {
    let start_secs = start_time.max(0) as f64 / 1000.0;
    let opt =
      CString::new(format!(":start-time={start_secs}")).map_err(|e| to_napi_error(e.to_string()))?;
    unsafe { (api.libvlc_media_add_option)(media, opt.as_ptr()); }
  }

  // buffer caching
  if let Some(buffer_cache) = buffer_cache {
    let caching_ms = buffer_cache.saturating_mul(1000);
    let opt = CString::new(format!(
      "{}={caching_ms}",
      if is_network_media { ":network-caching" } else { ":file-caching" }
    ))
    .map_err(|e| to_napi_error(e.to_string()))?;
    unsafe { (api.libvlc_media_add_option)(media, opt.as_ptr()); }
  }

  // network headers
  if is_network_media {
    let mut custom_headers: Vec<String> = Vec::new();

    if let Some(headers) = headers.as_ref() {
      for (key, value) in headers {
        let key = key.trim();
        let value = value.trim();

        if key.is_empty() || value.is_empty() {
          continue;
        }

        if key.eq_ignore_ascii_case("referer") || key.eq_ignore_ascii_case("referrer") {
          let opt = CString::new(format!(":http-referrer={value}"))
            .map_err(|e| to_napi_error(e.to_string()))?;
          unsafe { (api.libvlc_media_add_option)(media, opt.as_ptr()); }
        } else if key.eq_ignore_ascii_case("user-agent") || key.eq_ignore_ascii_case("useragent")
        {
          let opt = CString::new(format!(":http-user-agent={value}"))
            .map_err(|e| to_napi_error(e.to_string()))?;
          unsafe { (api.libvlc_media_add_option)(media, opt.as_ptr()); }
        } else {
          custom_headers.push(format!("{key}: {value}"));
        }
      }
    }

    if !custom_headers.is_empty() {
      let opt = CString::new(format!(":http-custom-header={}", custom_headers.join("\n")))
        .map_err(|e| to_napi_error(e.to_string()))?;
      unsafe { (api.libvlc_media_add_option)(media, opt.as_ptr()); }
    }
  }

  let player = unsafe { (api.libvlc_media_player_new_from_media)(media) };
  unsafe {
    (api.libvlc_media_release)(media);
  }

  if player.is_null() {
    return Err(to_napi_error(latest_vlc_error(
      api,
      "failed to create media player",
    )));
  }

  // Configure player + register events under a single lock
  {
    let mut instances = lock_instances()?;
    let state = instances
      .get_mut(instance_id)
      .ok_or_else(|| to_napi_error(format!("instance not found: {instance_id}")))?;

    apply_pending_frame_format_if_safe(state);

    {
      let context = state.context_mut()?;
      context.player = player;
    }

    // Extract function pointers to release the immutable borrow on state
    let api = state.api()?;
    let set_format_fn = api.libvlc_video_set_format;
    let set_callbacks_fn = api.libvlc_video_set_callbacks;
    let get_manager_fn = api.libvlc_media_player_event_manager;
    let attach_fn = api.libvlc_event_attach;

    // Video format
    if let Some(set_format) = set_format_fn {
      let chroma = CString::new("RV32").map_err(|e| to_napi_error(e.to_string()))?;
      unsafe {
        set_format(
          player,
          chroma.as_ptr(),
          state.current_frame.width,
          state.current_frame.height,
          state.current_frame.pitch,
        );
      }
    }

    // Video callbacks — pass instance_index as opaque for callback routing
    if let Some(set_callbacks) = set_callbacks_fn {
      unsafe {
        set_callbacks(
          player,
          Some(video_lock_callback),
          Some(video_unlock_callback),
          Some(video_display_callback),
          instance_index as *mut c_void,
        );
      }
    }

    // Register events
    if !player.is_null() && state.attached_events.is_empty() {
      let manager = unsafe { get_manager_fn(player) };
      if manager.is_null() {
        return Err(to_napi_error("failed to get media player event manager"));
      }

      for event in event_types() {
        let raw = unsafe {
          attach_fn(
            manager,
            event.vlc_type,
            on_vlc_event,
            instance_index as *mut c_void,
          )
        };
        if raw != 0 {
          return Err(to_napi_error(format!(
            "failed to attach event: {}",
            event.name
          )));
        }
        state.attached_events.push(event.vlc_type);
      }
    }
  }

  // Volume
  let initial_volume = volume.unwrap_or(0.5).clamp(0.0, 1.0);
  let vlc_volume = (initial_volume.powi(3) * 200.0).round() as i32;
  let volume_code = unsafe { (api.libvlc_audio_set_volume)(player, vlc_volume) };
  if volume_code == -1 {
    return Err(to_napi_error(latest_vlc_error(
      api,
      "failed to apply player volume",
    )));
  }

  // Mute
  if let Some(muted) = muted {
    let raw = unsafe { (api.libvlc_audio_get_mute)(player) };
    let is_muted = raw != 0;
    if is_muted != muted {
      unsafe { (api.libvlc_audio_toggle_mute)(player); }
    }
  }

  if autoplay.unwrap_or(false) {
    // Play
    let play_code = unsafe { (api.libvlc_media_player_play)(player) };
    if play_code != 0 {
      return Err(to_napi_error(latest_vlc_error(
        api,
        "failed to start media playback",
      )));
    }

    if let Some(rate) = playback_rate {
      unsafe { (api.libvlc_media_player_set_rate)(player, rate as c_float); }
    }
  }

  Ok(())
}

fn restart_player(api: &LibVlcApi, player: *mut LibvlcMediaPlayer, progress: f64) {
  let progress = progress.clamp(0.0, 1.0) as c_float;
  unsafe {
    (api.libvlc_media_player_stop)(player);
    (api.libvlc_media_player_play)(player);
    (api.libvlc_media_player_set_position)(player, progress);
  }
}

fn is_at_end(api: &LibVlcApi, player: *mut LibvlcMediaPlayer) -> bool {
  let duration = unsafe { (api.libvlc_media_player_get_length)(player) };
  if duration <= 0 {
    return false;
  }

  let time = unsafe { (api.libvlc_media_player_get_time)(player) };
  let position = unsafe { (api.libvlc_media_player_get_position)(player) };
  time >= duration.saturating_sub(100) || position >= 0.999
}

enum PlaybackAction {
  Pause,
  Resume,
  Start,
  Restart(f64),
}

fn run_playback_action(api: &LibVlcApi, player: *mut LibvlcMediaPlayer, action: PlaybackAction) {
  match action {
    PlaybackAction::Pause => unsafe {
      (api.libvlc_media_player_set_pause)(player, 1);
    },
    PlaybackAction::Resume => unsafe {
      (api.libvlc_media_player_set_pause)(player, 0);
    },
    PlaybackAction::Start => unsafe {
      (api.libvlc_media_player_play)(player);
    },
    PlaybackAction::Restart(progress) => restart_player(api, player, progress),
  }
}

// --- NAPI functions ---

#[napi]
pub fn on_event(
  event_name: String,
  callback: Function<'_, (String, f64, String), ()>,
  instance_id: Option<String>,
) -> NapiResult<()> {
  let id = resolve_instance_id(instance_id);
  let mut instances = lock_instances()?;
  let state = instances
    .get_mut(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;

  if state.context()?.player.is_null() {
    return Err(to_napi_error("media player is not created"));
  }

  if event_name_to_vlc_type(&event_name).is_none() {
    return Err(to_napi_error(format!(
      "unsupported event type: {event_name}"
    )));
  }

  let tsfn: VlcEventTsfn = callback
    .build_threadsafe_function::<VlcEventPayload>()
    .callee_handled::<true>()
    .build_callback(|ctx: ThreadsafeCallContext<VlcEventPayload>| {
      let payload = ctx.value;
      Ok((payload.event_type, payload.value, payload.additional_info))
    })?;

  state.event_callbacks.insert(event_name, tsfn);

  Ok(())
}

#[napi]
pub fn attach(handle: Buffer, instance_id: Option<String>) -> NapiResult<()> {
  let id = resolve_instance_id(instance_id);
  let mut instances = lock_instances()?;
  let state = instances
    .get_mut(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;

  let api_ptr = state.api()? as *const LibVlcApi;
  let player = state.context()?.player;

  if player.is_null() {
    return Err(to_napi_error("media player is not created"));
  }

  unsafe {
    #[cfg(target_os = "macos")]
    {
      if handle.len() < std::mem::size_of::<usize>() {
        return Err(Error::new(
          Status::InvalidArg,
          "invalid NSView handle".to_string(),
        ));
      }

      let parent_view = *(handle.as_ref().as_ptr() as *const *mut objc::runtime::Object);

      if parent_view.is_null() {
        return Err(Error::new(
          Status::InvalidArg,
          "window handle must not be zero".to_string(),
        ));
      }

      state.output_parent_view = parent_view;

      {
        let api = &*api_ptr;
        platform::macos::apply_output_window(api, player, state)?;
      }

      return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
      const SIZE: usize = std::mem::size_of::<usize>();

      if handle.len() < SIZE {
        return Err(Error::new(
          Status::InvalidArg,
          "invalid HWND handle".to_string(),
        ));
      }

      let raw = usize::from_le_bytes(handle.as_ref()[..SIZE].try_into().unwrap());

      if raw < 0 {
        return Err(Error::new(
          Status::InvalidArg,
          "window handle must not be zero".to_string(),
        ));
      }

      match state.api()?.libvlc_media_player_set_hwnd {
        Some(setter) => setter(player, raw as *mut c_void),
        None => return Err(to_napi_error("libVLC does not expose hwnd setter")),
      };
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
      const SIZE: usize = std::mem::size_of::<u32>();

      if handle.len() < SIZE {
        return Err(Error::new(
          Status::InvalidArg,
          "invalid XWindow handle".to_string(),
        ));
      }

      let raw = u32::from_le_bytes(handle.as_ref()[..SIZE].try_into().unwrap());
      if raw < 0 {
        return Err(Error::new(
          Status::InvalidArg,
          "window handle must not be zero".to_string(),
        ));
      }

      match state.api()?.libvlc_media_player_set_xwindow {
        Some(setter) => setter(player, raw as c_uint),
        None => return Err(to_napi_error("libVLC does not expose xwindow setter")),
      };
    }
  }

  #[allow(unreachable_code)]
  Ok(())
}

#[napi]
pub fn set_frame_format(width: u32, height: u32, instance_id: Option<String>) -> NapiResult<()> {
  if width == 0 || height == 0 {
    return Err(Error::new(
      Status::InvalidArg,
      "width and height must be greater than zero".to_string(),
    ));
  }

  let id = resolve_instance_id(instance_id);
  let mut instances = lock_instances()?;
  let state = instances
    .get_mut(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;

  let clamped_w = width.min(3840);
  let clamped_h = height.min(2160);
  let pitch = clamped_w.saturating_mul(4);
  state.pending_frame = Some(state::FrameFormat::new(clamped_w, clamped_h, pitch));

  let has_active_player = state
    .context
    .as_ref()
    .is_some_and(|ctx| !ctx.player.is_null());

  if has_active_player || state.frame_in_use {
    return Ok(());
  }

  apply_pending_frame_format_if_safe(state);

  Ok(())
}

#[napi]
pub fn get_frame_rgba(instance_id: Option<String>) -> NapiResult<Option<Buffer>> {
  let id = resolve_instance_id(instance_id);
  let mut instances = lock_instances()?;
  let state = instances
    .get_mut(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;

  if state.frame_buffer.is_empty() || !state.frame_dirty {
    return Ok(None);
  }

  let mut data = state.frame_buffer.clone();
  for px in data.chunks_exact_mut(4) {
    px.swap(0, 2);
    px[3] = 255;
  }
  state.frame_dirty = false;

  Ok(Some(Buffer::from(data)))
}

#[napi]
pub fn get_state(instance_id: Option<String>) -> NapiResult<VlcPlayerState> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(VlcPlayerState::NothingSpecial);
  }

  let raw = unsafe { (api.libvlc_media_player_get_state)(context.player) };
  Ok(state_from_raw(raw))
}

#[napi]
pub fn get_ended(instance_id: Option<String>) -> NapiResult<bool> {
  Ok(matches!(get_state(instance_id)?, VlcPlayerState::Ended))
}

#[napi]
pub fn get_playing(instance_id: Option<String>) -> NapiResult<bool> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(false);
  }

  let raw = unsafe { (api.libvlc_media_player_is_playing)(context.player) };
  Ok(raw != 0)
}

#[napi]
pub fn create(
  path: CreatePath,
  options: CreateOptions,
  instance_id: Option<String>,
) -> NapiResult<String> {
  let id = resolve_instance_id(instance_id);
  destroy(Some(id.clone()))?;
  load_dylib(&id, path.lib_path, path.plugin_path)?;
  load_media(&id, options)?;

  Ok(id)
}

#[napi]
pub fn play(instance_id: Option<String>) -> NapiResult<()> {
  let id = resolve_instance_id(instance_id);
  let mut instances = lock_instances()?;
  let state = instances
    .get_mut(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let pending_progress = state.pending_start_progress.take();
  let api = state.api()? as *const LibVlcApi;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(());
  }

  let raw_state = unsafe { ((*api).libvlc_media_player_get_state)(context.player) };
  let player_state = state_from_raw(raw_state);
  let player = context.player;
  let action = if matches!(player_state, VlcPlayerState::Paused) {
    PlaybackAction::Resume
  } else if matches!(player_state, VlcPlayerState::Ended)
    || matches!(player_state, VlcPlayerState::Stopped) && is_at_end(unsafe { &*api }, player)
  {
    PlaybackAction::Restart(pending_progress.unwrap_or(0.0))
  } else if matches!(player_state, VlcPlayerState::Stopped) {
    match pending_progress {
      Some(progress) => PlaybackAction::Restart(progress),
      None => PlaybackAction::Start,
    }
  } else {
    PlaybackAction::Start
  };

  // Drop lock before calling VLC to avoid deadlock with video_lock_callback
  drop(instances);

  let api = unsafe { &*api };
  run_playback_action(api, player, action);

  Ok(())
}

#[napi]
pub fn pause(instance_id: Option<String>) -> NapiResult<()> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(());
  }

  let raw_state = unsafe { (api.libvlc_media_player_get_state)(context.player) };
  if matches!(state_from_raw(raw_state), VlcPlayerState::Playing) {
    unsafe {
      (api.libvlc_media_player_set_pause)(context.player, 1);
    }
  }

  Ok(())
}

#[napi]
pub fn toggle(instance_id: Option<String>) -> NapiResult<()> {
  let id = resolve_instance_id(instance_id);
  let mut instances = lock_instances()?;
  let state = instances
    .get_mut(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let pending_progress = state.pending_start_progress.take();
  let api = state.api()? as *const LibVlcApi;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(());
  }

  let raw_state = unsafe { ((*api).libvlc_media_player_get_state)(context.player) };
  let player_state = state_from_raw(raw_state);
  let player = context.player;
  let action = if matches!(player_state, VlcPlayerState::Playing) {
    PlaybackAction::Pause
  } else if matches!(player_state, VlcPlayerState::Paused) {
    PlaybackAction::Resume
  } else if matches!(player_state, VlcPlayerState::Ended)
    || matches!(player_state, VlcPlayerState::Stopped) && is_at_end(unsafe { &*api }, player)
  {
    PlaybackAction::Restart(pending_progress.unwrap_or(0.0))
  } else if matches!(player_state, VlcPlayerState::Stopped) {
    match pending_progress {
      Some(progress) => PlaybackAction::Restart(progress),
      None => PlaybackAction::Start,
    }
  } else {
    PlaybackAction::Start
  };

  // Drop lock before calling VLC to avoid deadlock with video_lock_callback
  drop(instances);

  let api = unsafe { &*api };
  run_playback_action(api, player, action);

  Ok(())
}

#[napi]
pub fn stop(instance_id: Option<String>) -> NapiResult<()> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(());
  }

  unsafe {
    (api.libvlc_media_player_stop)(context.player);
  }

  Ok(())
}

#[napi]
pub fn set_volume(volume: f64, instance_id: Option<String>) -> NapiResult<()> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(());
  }

  if !volume.is_finite() {
    return Ok(());
  }

  let raw_volume = volume.clamp(0.0, 1.0);
  let vlc_volume = (raw_volume.powi(3) * 200.0).round() as i32;

  let raw = unsafe { (api.libvlc_audio_set_volume)(context.player, vlc_volume) };
  if raw < 0 {
    return Ok(());
  }

  Ok(())
}

#[napi]
pub fn get_volume(instance_id: Option<String>) -> NapiResult<f64> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(f64::NAN);
  }

  let raw = unsafe { (api.libvlc_audio_get_volume)(context.player) };
  if raw < 0 {
    return Ok(f64::NAN);
  }

  let volume = ((raw as f64).clamp(0.0, 200.0) / 200.0).cbrt();
  Ok(volume)
}

#[napi]
pub fn set_muted(muted: bool, instance_id: Option<String>) -> NapiResult<()> {
  let id = resolve_instance_id(instance_id);
  let mut instances = lock_instances()?;
  let state = instances
    .get_mut(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(());
  }

  let raw = unsafe { (api.libvlc_audio_get_mute)(context.player) };
  if raw < 0 {
    return Ok(());
  }

  let vlc_muted = raw != 0;

  if vlc_muted != muted {
    unsafe {
      (api.libvlc_audio_toggle_mute)(context.player);
    }
  }

  Ok(())
}

#[napi]
pub fn get_muted(instance_id: Option<String>) -> NapiResult<bool> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(false);
  }

  let raw = unsafe { (api.libvlc_audio_get_mute)(context.player) };
  if raw < 0 {
    return Ok(false);
  }

  Ok(raw != 0)
}

#[napi]
pub fn seek(time: i64, instance_id: Option<String>) -> NapiResult<()> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(());
  }

  let duration = unsafe { (api.libvlc_media_player_get_length)(context.player) };

  let target = if duration > 0 {
    (time as c_longlong).clamp(0, duration)
  } else {
    (time as c_longlong).max(0)
  };

  unsafe {
    (api.libvlc_media_player_set_time)(context.player, target);
  }

  Ok(())
}

#[napi]
pub fn get_progress(instance_id: Option<String>) -> NapiResult<f64> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(f64::NAN);
  }

  let raw = unsafe { (api.libvlc_media_player_get_position)(context.player) } as f64;
  if raw < 0.0 {
    return Ok(f64::NAN);
  }

  let pos = raw.clamp(0.0, 1.0);
  Ok(pos)
}

#[napi]
pub fn set_progress(progress: f64, instance_id: Option<String>) -> NapiResult<()> {
  if !progress.is_finite() {
    return Ok(());
  }

  let id = resolve_instance_id(instance_id);
  let progress = progress.clamp(0.0, 1.0);
  let action = {
    let mut instances = lock_instances()?;
    let state = instances
      .get_mut(&id)
      .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
    let api = state.api()?;
    let context = state.context()?;

    if context.player.is_null() {
      return Ok(());
    }

    let raw_state = unsafe { (api.libvlc_media_player_get_state)(context.player) };
    let player_state = state_from_raw(raw_state);
    if matches!(player_state, VlcPlayerState::Ended)
      || matches!(player_state, VlcPlayerState::Stopped)
    {
      state.pending_start_progress = Some(progress);
      None
    } else {
      Some((api as *const LibVlcApi, context.player))
    }
  };

  let Some((api_ptr, player)) = action else {
    return Ok(());
  };

  let api = unsafe { &*api_ptr };
  unsafe {
    (api.libvlc_media_player_set_position)(player, progress as c_float);
  }

  Ok(())
}

#[napi]
pub fn get_duration(instance_id: Option<String>) -> NapiResult<f64> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(f64::NAN);
  }

  let raw = unsafe { (api.libvlc_media_player_get_length)(context.player) } as f64;
  if raw < 0.0 {
    return Ok(f64::NAN);
  }

  Ok(raw)
}

#[napi]
pub fn get_played(instance_id: Option<String>) -> NapiResult<f64> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(f64::NAN);
  }

  let raw = unsafe { (api.libvlc_media_player_get_time)(context.player) } as f64;
  if raw < 0.0 {
    return Ok(f64::NAN);
  }

  Ok(raw)
}

#[napi]
pub fn get_buffered(instance_id: Option<String>) -> NapiResult<f64> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(f64::NAN);
  }

  let duration = unsafe { (api.libvlc_media_player_get_length)(context.player) } as f64;
  if duration < 0.0 {
    return Ok(f64::NAN);
  }
  let buffering_percent = match api.libvlc_media_player_get_buffering {
    Some(get_buffering) => (unsafe { get_buffering(context.player) }) as f64,
    None => state.latest_buffering_percent,
  };
  if buffering_percent < 0.0 {
    return Ok(f64::NAN);
  }

  let buffered = (duration * (buffering_percent.clamp(0.0, 100.0) / 100.0)).round();
  Ok(buffered)
}

#[napi]
pub fn get_playback_rate(instance_id: Option<String>) -> NapiResult<f64> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(f64::NAN);
  }

  let raw = unsafe { (api.libvlc_media_player_get_rate)(context.player) } as f64;
  if raw < 0.0 {
    return Ok(f64::NAN);
  }

  Ok(raw)
}

#[napi]
pub fn set_playback_rate(rate: f64, instance_id: Option<String>) -> NapiResult<()> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(());
  }

  if !rate.is_finite() {
    return Ok(());
  }

  let rate = rate.clamp(0.1, 8.0);
  let raw = unsafe { (api.libvlc_media_player_set_rate)(context.player, rate as c_float) };
  if raw < 0 {
    return Ok(());
  }

  Ok(())
}

#[napi]
pub fn get_subtitle_track(instance_id: Option<String>) -> NapiResult<Vec<Track>> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(Vec::new());
  }

  let current = unsafe { (api.libvlc_video_get_spu)(context.player) };
  let head = unsafe { (api.libvlc_video_get_spu_description)(context.player) };

  Ok(track_list(api, head, current))
}

#[napi]
pub fn set_subtitle_track(id: i32, instance_id: Option<String>) -> NapiResult<()> {
  let iid = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&iid)
    .ok_or_else(|| to_napi_error(format!("instance not found: {iid}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(());
  }

  let raw = unsafe { (api.libvlc_video_set_spu)(context.player, id) };
  if raw < 0 {
    return Ok(());
  }

  Ok(())
}

#[napi]
pub fn add_subtitle_file(path: String, instance_id: Option<String>) -> NapiResult<()> {
  let iid = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&iid)
    .ok_or_else(|| to_napi_error(format!("instance not found: {iid}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(());
  }

  if path.trim().is_empty() {
    return Ok(());
  }

  let subtitle_path = if path.starts_with("file://") {
    path.trim_start_matches("file://").to_string()
  } else {
    path
  };

  let path = CString::new(subtitle_path).map_err(|e| to_napi_error(e.to_string()))?;
  let raw = unsafe { (api.libvlc_video_set_subtitle_file)(context.player, path.as_ptr()) };
  if raw < 0 {
    return Ok(());
  }

  Ok(())
}

#[napi]
pub fn get_audio_track(instance_id: Option<String>) -> NapiResult<Vec<Track>> {
  let id = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&id)
    .ok_or_else(|| to_napi_error(format!("instance not found: {id}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(Vec::new());
  }

  let current = unsafe { (api.libvlc_audio_get_track)(context.player) };
  let head = unsafe { (api.libvlc_audio_get_track_description)(context.player) };

  Ok(track_list(api, head, current))
}

#[napi]
pub fn set_audio_track(id: i32, instance_id: Option<String>) -> NapiResult<()> {
  let iid = resolve_instance_id(instance_id);
  let instances = lock_instances()?;
  let state = instances
    .get(&iid)
    .ok_or_else(|| to_napi_error(format!("instance not found: {iid}")))?;
  let api = state.api()?;
  let context = state.context()?;

  if context.player.is_null() {
    return Ok(());
  }

  let raw = unsafe { (api.libvlc_audio_set_track)(context.player, id) };
  if raw < 0 {
    return Ok(());
  }

  Ok(())
}

#[napi]
pub fn destroy(instance_id: Option<String>) -> NapiResult<()> {
  let id = resolve_instance_id(instance_id);
  let (api, player, vlc_instance) = {
    let mut instances = lock_instances()?;

    let state = match instances.get_mut(&id) {
      Some(s) => s,
      None => return Ok(()),
    };

    let (player, vlc_instance) = state
      .context
      .as_ref()
      .map(|ctx| (ctx.player, ctx.instance))
      .unwrap_or((ptr::null_mut(), ptr::null_mut()));

    if let Some(api) = state.api.as_ref() {
      if !player.is_null() {
        unsafe {
          let manager = (api.libvlc_media_player_event_manager)(player);
          if !manager.is_null() {
            for event in &state.attached_events {
              (api.libvlc_event_detach)(manager, *event, on_vlc_event, state.index as *mut c_void);
            }
          }
          if let Some(set_callbacks) = api.libvlc_video_set_callbacks {
            set_callbacks(player, None, None, None, ptr::null_mut());
          }
        }
      }
    }

    state.attached_events.clear();
    state.event_callbacks.clear();
    if let Some(context) = state.context.as_mut() {
      context.player = ptr::null_mut();
    }
    let api = state.api.take();

    state.pending_frame = None;
    state.frame_in_use = false;
    state.frame_dirty = false;
    state.latest_buffering_percent = 0.0;
    #[cfg(target_os = "macos")]
    {
      state.output_parent_view = ptr::null_mut();
      state.video_rect = [0.0; 4];
      state.vlc_subview = ptr::null_mut();
    }

    (api, player, vlc_instance)
  };

  if let Some(api) = api.as_ref() {
    unsafe {
      if !player.is_null() {
        (api.libvlc_media_player_stop)(player);
        (api.libvlc_media_player_release)(player);
      }
      if !vlc_instance.is_null() {
        (api.libvlc_release)(vlc_instance);
      }
    }
  }

  let mut instances = lock_instances()?;
  if let Some(mut state) = instances.remove(&id) {
    state.context = None;
    state.frame_buffer.clear();
  }

  Ok(())
}

/// Destroy all instances. Called automatically when the module is unloaded.
#[napi]
pub fn cleanup() -> NapiResult<()> {
  let instances = lock_instances()?;
  let ids: Vec<String> = instances.keys().cloned().collect();
  drop(instances);

  for id in ids {
    destroy(Some(id))?;
  }

  Ok(())
}
