use std::ffi::{c_char, c_float, c_int, c_longlong, c_uint, c_void};
use std::path::Path;

use libloading::{Library, Symbol};

use crate::ffi::{
  LibvlcCallback, LibvlcEventManager, LibvlcEventType, LibvlcInstance, LibvlcMedia,
  LibvlcMediaPlayer, LibvlcTrackDescriptionT, LibvlcVideoDisplayCb, LibvlcVideoLockCb,
  LibvlcVideoUnlockCb,
};

#[allow(non_camel_case_types)]
type libvlc_new_t = unsafe extern "C" fn(c_int, *const *const c_char) -> *mut LibvlcInstance;
#[allow(non_camel_case_types)]
type libvlc_release_t = unsafe extern "C" fn(*mut LibvlcInstance);
#[allow(non_camel_case_types)]
type libvlc_media_new_location_t =
  unsafe extern "C" fn(*mut LibvlcInstance, *const c_char) -> *mut LibvlcMedia;
#[allow(non_camel_case_types)]
type libvlc_media_new_path_t =
  unsafe extern "C" fn(*mut LibvlcInstance, *const c_char) -> *mut LibvlcMedia;
#[allow(non_camel_case_types)]
type libvlc_media_add_option_t = unsafe extern "C" fn(*mut LibvlcMedia, *const c_char);
#[allow(non_camel_case_types)]
type libvlc_media_release_t = unsafe extern "C" fn(*mut LibvlcMedia);
#[allow(non_camel_case_types)]
type libvlc_media_player_new_from_media_t =
  unsafe extern "C" fn(*mut LibvlcMedia) -> *mut LibvlcMediaPlayer;
#[allow(non_camel_case_types)]
type libvlc_media_player_release_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer);
#[allow(non_camel_case_types)]
type libvlc_media_player_play_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer) -> c_int;
#[allow(non_camel_case_types)]
type libvlc_media_player_stop_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer);
#[allow(non_camel_case_types)]
type libvlc_media_player_pause_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer);
#[allow(non_camel_case_types)]
type libvlc_media_player_set_pause_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer, c_int);
#[allow(non_camel_case_types)]
type libvlc_media_player_is_playing_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer) -> c_int;
#[allow(non_camel_case_types)]
type libvlc_media_player_get_time_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer) -> c_longlong;
#[allow(non_camel_case_types)]
type libvlc_media_player_set_time_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer, c_longlong);
#[allow(non_camel_case_types)]
type libvlc_media_player_get_position_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer) -> c_float;
#[allow(non_camel_case_types)]
type libvlc_media_player_set_position_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer, c_float);
#[allow(non_camel_case_types)]
type libvlc_media_player_get_length_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer) -> c_longlong;
#[allow(non_camel_case_types)]
type libvlc_media_player_get_buffering_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer) -> c_float;
#[allow(non_camel_case_types)]
type libvlc_media_player_get_rate_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer) -> c_float;
#[allow(non_camel_case_types)]
type libvlc_media_player_set_rate_t =
  unsafe extern "C" fn(*mut LibvlcMediaPlayer, c_float) -> c_int;
#[allow(non_camel_case_types)]
type libvlc_audio_set_volume_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer, c_int) -> c_int;
#[allow(non_camel_case_types)]
type libvlc_audio_get_volume_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer) -> c_int;
#[allow(non_camel_case_types)]
type libvlc_media_player_get_state_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer) -> c_int;
#[allow(non_camel_case_types)]
type libvlc_media_player_event_manager_t =
  unsafe extern "C" fn(*mut LibvlcMediaPlayer) -> *mut LibvlcEventManager;
#[allow(non_camel_case_types)]
type libvlc_event_attach_t = unsafe extern "C" fn(
  *mut LibvlcEventManager,
  LibvlcEventType,
  LibvlcCallback,
  *mut c_void,
) -> c_int;
#[allow(non_camel_case_types)]
type libvlc_event_detach_t =
  unsafe extern "C" fn(*mut LibvlcEventManager, LibvlcEventType, LibvlcCallback, *mut c_void);
#[allow(non_camel_case_types)]
type libvlc_video_get_spu_description_t =
  unsafe extern "C" fn(*mut LibvlcMediaPlayer) -> *mut LibvlcTrackDescriptionT;
#[allow(non_camel_case_types)]
type libvlc_video_get_spu_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer) -> c_int;
#[allow(non_camel_case_types)]
type libvlc_video_set_spu_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer, c_int) -> c_int;
#[allow(non_camel_case_types)]
type libvlc_video_set_subtitle_file_t =
  unsafe extern "C" fn(*mut LibvlcMediaPlayer, *const c_char) -> c_int;
#[allow(non_camel_case_types)]
type libvlc_audio_get_track_description_t =
  unsafe extern "C" fn(*mut LibvlcMediaPlayer) -> *mut LibvlcTrackDescriptionT;
#[allow(non_camel_case_types)]
type libvlc_audio_get_track_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer) -> c_int;
#[allow(non_camel_case_types)]
type libvlc_audio_set_track_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer, c_int) -> c_int;
#[allow(non_camel_case_types)]
type libvlc_track_description_list_release_t = unsafe extern "C" fn(*mut LibvlcTrackDescriptionT);
#[allow(non_camel_case_types)]
type libvlc_errmsg_t = unsafe extern "C" fn() -> *const c_char;
#[allow(non_camel_case_types)]
type libvlc_media_player_set_hwnd_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer, *mut c_void);
#[allow(non_camel_case_types)]
type libvlc_media_player_set_xwindow_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer, c_uint);
#[allow(non_camel_case_types)]
type libvlc_media_player_set_nsobject_t = unsafe extern "C" fn(*mut LibvlcMediaPlayer, *mut c_void);
#[allow(non_camel_case_types)]
type libvlc_video_set_callbacks_t = unsafe extern "C" fn(
  *mut LibvlcMediaPlayer,
  Option<LibvlcVideoLockCb>,
  Option<LibvlcVideoUnlockCb>,
  Option<LibvlcVideoDisplayCb>,
  *mut c_void,
);
#[allow(non_camel_case_types)]
type libvlc_video_set_format_t =
  unsafe extern "C" fn(*mut LibvlcMediaPlayer, *const c_char, c_uint, c_uint, c_uint);

#[allow(dead_code)]
pub struct LibVlcApi {
  pub _lib: Library,
  pub libvlc_new: libvlc_new_t,
  pub libvlc_release: libvlc_release_t,
  pub libvlc_media_new_location: libvlc_media_new_location_t,
  pub libvlc_media_new_path: libvlc_media_new_path_t,
  pub libvlc_media_add_option: libvlc_media_add_option_t,
  pub libvlc_media_release: libvlc_media_release_t,
  pub libvlc_media_player_new_from_media: libvlc_media_player_new_from_media_t,
  pub libvlc_media_player_release: libvlc_media_player_release_t,
  pub libvlc_media_player_play: libvlc_media_player_play_t,
  pub libvlc_media_player_stop: libvlc_media_player_stop_t,
  pub libvlc_media_player_pause: libvlc_media_player_pause_t,
  pub libvlc_media_player_set_pause: libvlc_media_player_set_pause_t,
  pub libvlc_media_player_is_playing: libvlc_media_player_is_playing_t,
  pub libvlc_media_player_get_time: libvlc_media_player_get_time_t,
  pub libvlc_media_player_set_time: libvlc_media_player_set_time_t,
  pub libvlc_media_player_get_position: libvlc_media_player_get_position_t,
  pub libvlc_media_player_set_position: libvlc_media_player_set_position_t,
  pub libvlc_media_player_get_length: libvlc_media_player_get_length_t,
  pub libvlc_media_player_get_buffering: Option<libvlc_media_player_get_buffering_t>,
  pub libvlc_media_player_get_rate: libvlc_media_player_get_rate_t,
  pub libvlc_media_player_set_rate: libvlc_media_player_set_rate_t,
  pub libvlc_audio_set_volume: libvlc_audio_set_volume_t,
  pub libvlc_audio_get_volume: libvlc_audio_get_volume_t,
  pub libvlc_media_player_get_state: libvlc_media_player_get_state_t,
  pub libvlc_media_player_event_manager: libvlc_media_player_event_manager_t,
  pub libvlc_event_attach: libvlc_event_attach_t,
  pub libvlc_event_detach: libvlc_event_detach_t,
  pub libvlc_video_get_spu_description: libvlc_video_get_spu_description_t,
  pub libvlc_video_get_spu: libvlc_video_get_spu_t,
  pub libvlc_video_set_spu: libvlc_video_set_spu_t,
  pub libvlc_video_set_subtitle_file: libvlc_video_set_subtitle_file_t,
  pub libvlc_audio_get_track_description: libvlc_audio_get_track_description_t,
  pub libvlc_audio_get_track: libvlc_audio_get_track_t,
  pub libvlc_audio_set_track: libvlc_audio_set_track_t,
  pub libvlc_track_description_list_release: libvlc_track_description_list_release_t,
  pub libvlc_errmsg: libvlc_errmsg_t,
  pub libvlc_media_player_set_hwnd: Option<libvlc_media_player_set_hwnd_t>,
  pub libvlc_media_player_set_xwindow: Option<libvlc_media_player_set_xwindow_t>,
  pub libvlc_media_player_set_nsobject: Option<libvlc_media_player_set_nsobject_t>,
  pub libvlc_video_set_callbacks: Option<libvlc_video_set_callbacks_t>,
  pub libvlc_video_set_format: Option<libvlc_video_set_format_t>,
}

impl LibVlcApi {
  pub fn load(lib_path: &str) -> Result<Self, String> {
    let path = Path::new(lib_path);
    let parent = path
      .parent()
      .ok_or_else(|| format!("invalid lib path: {lib_path}"))?;

    // Pre-load libvlccore from the same directory so libvlc can resolve it
    let core_name = if cfg!(target_os = "macos") {
      "libvlccore.dylib"
    } else if cfg!(target_os = "windows") {
      "libvlccore.dll"
    } else {
      "libvlccore.so"
    };
    let core = parent.join(core_name);
    if core.exists() {
      let _ = unsafe { Library::new(&core) };
    }

    let lib =
      unsafe { Library::new(lib_path) }.map_err(|e| format!("failed to load {lib_path}: {e}"))?;

    unsafe { Self::from_library(lib) }
  }

  unsafe fn from_library(lib: Library) -> Result<Self, String> {
    let libvlc_new = *load_sym::<libvlc_new_t>(&lib, b"libvlc_new\0")?;
    let libvlc_release = *load_sym::<libvlc_release_t>(&lib, b"libvlc_release\0")?;
    let libvlc_media_new_location =
      *load_sym::<libvlc_media_new_location_t>(&lib, b"libvlc_media_new_location\0")?;
    let libvlc_media_new_path =
      *load_sym::<libvlc_media_new_path_t>(&lib, b"libvlc_media_new_path\0")?;
    let libvlc_media_add_option =
      *load_sym::<libvlc_media_add_option_t>(&lib, b"libvlc_media_add_option\0")?;
    let libvlc_media_release =
      *load_sym::<libvlc_media_release_t>(&lib, b"libvlc_media_release\0")?;
    let libvlc_media_player_new_from_media = *load_sym::<libvlc_media_player_new_from_media_t>(
      &lib,
      b"libvlc_media_player_new_from_media\0",
    )?;
    let libvlc_media_player_release =
      *load_sym::<libvlc_media_player_release_t>(&lib, b"libvlc_media_player_release\0")?;
    let libvlc_media_player_play =
      *load_sym::<libvlc_media_player_play_t>(&lib, b"libvlc_media_player_play\0")?;
    let libvlc_media_player_stop =
      *load_sym::<libvlc_media_player_stop_t>(&lib, b"libvlc_media_player_stop\0")?;
    let libvlc_media_player_pause =
      *load_sym::<libvlc_media_player_pause_t>(&lib, b"libvlc_media_player_pause\0")?;
    let libvlc_media_player_set_pause =
      *load_sym::<libvlc_media_player_set_pause_t>(&lib, b"libvlc_media_player_set_pause\0")?;
    let libvlc_media_player_is_playing =
      *load_sym::<libvlc_media_player_is_playing_t>(&lib, b"libvlc_media_player_is_playing\0")?;
    let libvlc_media_player_get_time =
      *load_sym::<libvlc_media_player_get_time_t>(&lib, b"libvlc_media_player_get_time\0")?;
    let libvlc_media_player_set_time =
      *load_sym::<libvlc_media_player_set_time_t>(&lib, b"libvlc_media_player_set_time\0")?;
    let libvlc_media_player_get_position =
      *load_sym::<libvlc_media_player_get_position_t>(&lib, b"libvlc_media_player_get_position\0")?;
    let libvlc_media_player_set_position =
      *load_sym::<libvlc_media_player_set_position_t>(&lib, b"libvlc_media_player_set_position\0")?;
    let libvlc_media_player_get_length =
      *load_sym::<libvlc_media_player_get_length_t>(&lib, b"libvlc_media_player_get_length\0")?;
    let libvlc_media_player_get_buffering = load_optional_sym::<libvlc_media_player_get_buffering_t>(
      &lib,
      b"libvlc_media_player_get_buffering\0",
    );
    let libvlc_media_player_get_rate =
      *load_sym::<libvlc_media_player_get_rate_t>(&lib, b"libvlc_media_player_get_rate\0")?;
    let libvlc_media_player_set_rate =
      *load_sym::<libvlc_media_player_set_rate_t>(&lib, b"libvlc_media_player_set_rate\0")?;
    let libvlc_audio_set_volume =
      *load_sym::<libvlc_audio_set_volume_t>(&lib, b"libvlc_audio_set_volume\0")?;
    let libvlc_audio_get_volume =
      *load_sym::<libvlc_audio_get_volume_t>(&lib, b"libvlc_audio_get_volume\0")?;
    let libvlc_media_player_get_state =
      *load_sym::<libvlc_media_player_get_state_t>(&lib, b"libvlc_media_player_get_state\0")?;
    let libvlc_media_player_event_manager = *load_sym::<libvlc_media_player_event_manager_t>(
      &lib,
      b"libvlc_media_player_event_manager\0",
    )?;
    let libvlc_event_attach = *load_sym::<libvlc_event_attach_t>(&lib, b"libvlc_event_attach\0")?;
    let libvlc_event_detach = *load_sym::<libvlc_event_detach_t>(&lib, b"libvlc_event_detach\0")?;
    let libvlc_video_get_spu_description =
      *load_sym::<libvlc_video_get_spu_description_t>(&lib, b"libvlc_video_get_spu_description\0")?;
    let libvlc_video_get_spu =
      *load_sym::<libvlc_video_get_spu_t>(&lib, b"libvlc_video_get_spu\0")?;
    let libvlc_video_set_spu =
      *load_sym::<libvlc_video_set_spu_t>(&lib, b"libvlc_video_set_spu\0")?;
    let libvlc_video_set_subtitle_file =
      *load_sym::<libvlc_video_set_subtitle_file_t>(&lib, b"libvlc_video_set_subtitle_file\0")?;
    let libvlc_audio_get_track_description = *load_sym::<libvlc_audio_get_track_description_t>(
      &lib,
      b"libvlc_audio_get_track_description\0",
    )?;
    let libvlc_audio_get_track =
      *load_sym::<libvlc_audio_get_track_t>(&lib, b"libvlc_audio_get_track\0")?;
    let libvlc_audio_set_track =
      *load_sym::<libvlc_audio_set_track_t>(&lib, b"libvlc_audio_set_track\0")?;
    let libvlc_track_description_list_release = *load_sym::<libvlc_track_description_list_release_t>(
      &lib,
      b"libvlc_track_description_list_release\0",
    )?;
    let libvlc_errmsg = *load_sym::<libvlc_errmsg_t>(&lib, b"libvlc_errmsg\0")?;

    let libvlc_media_player_set_hwnd =
      load_optional_sym::<libvlc_media_player_set_hwnd_t>(&lib, b"libvlc_media_player_set_hwnd\0");
    let libvlc_media_player_set_xwindow = load_optional_sym::<libvlc_media_player_set_xwindow_t>(
      &lib,
      b"libvlc_media_player_set_xwindow\0",
    );
    let libvlc_media_player_set_nsobject = load_optional_sym::<libvlc_media_player_set_nsobject_t>(
      &lib,
      b"libvlc_media_player_set_nsobject\0",
    );
    let libvlc_video_set_callbacks =
      load_optional_sym::<libvlc_video_set_callbacks_t>(&lib, b"libvlc_video_set_callbacks\0");
    let libvlc_video_set_format =
      load_optional_sym::<libvlc_video_set_format_t>(&lib, b"libvlc_video_set_format\0");

    Ok(Self {
      _lib: lib,
      libvlc_new,
      libvlc_release,
      libvlc_media_new_location,
      libvlc_media_new_path,
      libvlc_media_add_option,
      libvlc_media_release,
      libvlc_media_player_new_from_media,
      libvlc_media_player_release,
      libvlc_media_player_play,
      libvlc_media_player_stop,
      libvlc_media_player_pause,
      libvlc_media_player_set_pause,
      libvlc_media_player_is_playing,
      libvlc_media_player_get_time,
      libvlc_media_player_set_time,
      libvlc_media_player_get_position,
      libvlc_media_player_set_position,
      libvlc_media_player_get_length,
      libvlc_media_player_get_buffering,
      libvlc_media_player_get_rate,
      libvlc_media_player_set_rate,
      libvlc_audio_set_volume,
      libvlc_audio_get_volume,
      libvlc_media_player_get_state,
      libvlc_media_player_event_manager,
      libvlc_event_attach,
      libvlc_event_detach,
      libvlc_video_get_spu_description,
      libvlc_video_get_spu,
      libvlc_video_set_spu,
      libvlc_video_set_subtitle_file,
      libvlc_audio_get_track_description,
      libvlc_audio_get_track,
      libvlc_audio_set_track,
      libvlc_track_description_list_release,
      libvlc_errmsg,
      libvlc_media_player_set_hwnd,
      libvlc_media_player_set_xwindow,
      libvlc_media_player_set_nsobject,
      libvlc_video_set_callbacks,
      libvlc_video_set_format,
    })
  }
}

unsafe fn load_sym<'a, T>(lib: &'a Library, name: &'static [u8]) -> Result<Symbol<'a, T>, String> {
  lib
    .get::<T>(name)
    .map_err(|err| format!("missing symbol {}: {}", String::from_utf8_lossy(name), err))
}

unsafe fn load_optional_sym<T>(lib: &Library, name: &'static [u8]) -> Option<T>
where
  T: Copy,
{
  lib.get::<T>(name).ok().map(|s| *s)
}
