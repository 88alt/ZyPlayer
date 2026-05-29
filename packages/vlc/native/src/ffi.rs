use std::ffi::{c_char, c_float, c_int, c_longlong, c_uint, c_void};

pub type LibvlcInstance = c_void;
pub type LibvlcMedia = c_void;
pub type LibvlcMediaPlayer = c_void;
pub type LibvlcEventManager = c_void;
pub type LibvlcEventType = c_uint;

pub const LIBVLC_EVENT_MEDIA_PLAYER_BUFFERING: LibvlcEventType = 259;
pub const LIBVLC_EVENT_MEDIA_PLAYER_PLAYING: LibvlcEventType = 260;
pub const LIBVLC_EVENT_MEDIA_PLAYER_PAUSED: LibvlcEventType = 261;
pub const LIBVLC_EVENT_MEDIA_PLAYER_STOPPED: LibvlcEventType = 262;
pub const LIBVLC_EVENT_MEDIA_PLAYER_END_REACHED: LibvlcEventType = 265;
pub const LIBVLC_EVENT_MEDIA_PLAYER_ENCOUNTERED_ERROR: LibvlcEventType = 266;
pub const LIBVLC_EVENT_MEDIA_PLAYER_TIME_CHANGED: LibvlcEventType = 267;
pub const LIBVLC_EVENT_MEDIA_PLAYER_POSITION_CHANGED: LibvlcEventType = 268;

#[repr(C)]
pub struct LibvlcTrackDescriptionT {
  pub i_id: c_int,
  pub psz_name: *mut c_char,
  pub p_next: *mut LibvlcTrackDescriptionT,
}

#[repr(C)]
#[derive(Copy, Clone)]
pub struct LibvlcEventMediaPlayerBuffering {
  pub new_cache: c_float,
}

#[repr(C)]
#[derive(Copy, Clone)]
pub struct LibvlcEventMediaPlayerPositionChanged {
  pub new_position: c_float,
}

#[repr(C)]
#[derive(Copy, Clone)]
pub struct LibvlcEventMediaPlayerTimeChanged {
  pub new_time: c_longlong,
}

#[repr(C)]
pub union LibvlcEventUnion {
  pub media_player_buffering: LibvlcEventMediaPlayerBuffering,
  pub media_player_position_changed: LibvlcEventMediaPlayerPositionChanged,
  pub media_player_time_changed: LibvlcEventMediaPlayerTimeChanged,
}

#[repr(C)]
pub struct LibvlcEventT {
  pub event_type: LibvlcEventType,
  pub object: *mut c_void,
  pub u: LibvlcEventUnion,
}

pub type LibvlcCallback = unsafe extern "C" fn(*const LibvlcEventT, *mut c_void);

pub type LibvlcVideoLockCb = unsafe extern "C" fn(*mut c_void, *mut *mut c_void) -> *mut c_void;
pub type LibvlcVideoUnlockCb = unsafe extern "C" fn(*mut c_void, *mut c_void, *mut *mut c_void);
pub type LibvlcVideoDisplayCb = unsafe extern "C" fn(*mut c_void, *mut c_void);
