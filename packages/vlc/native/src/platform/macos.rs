use std::ffi::c_void;

use napi::bindgen_prelude::Result as NapiResult;
use objc::declare::ClassDecl;
use objc::msg_send;
use objc::runtime::{Class, Object, Sel};
use objc::sel;
use objc::sel_impl;

use crate::api::LibVlcApi;
use crate::ffi::LibvlcMediaPlayer;
use crate::state::VlcAddonState;
use crate::util::to_napi_error;

const CSS_X: &str = "_cssX";
const CSS_Y: &str = "_cssY";
const CSS_W: &str = "_cssW";
const CSS_H: &str = "_cssH";

#[repr(C)]
struct NSPoint {
  x: f64,
  y: f64,
}

#[repr(C)]
struct NSSize {
  width: f64,
  height: f64,
}

#[repr(C)]
struct NSRect {
  origin: NSPoint,
  size: NSSize,
}

/// Convert a CSS rect (top-left origin) to a macOS rect (bottom-left origin).
fn css_to_ns_rect(css: [f64; 4], parent_height: f64) -> NSRect {
  NSRect {
    origin: NSPoint {
      x: css[0],
      y: parent_height - css[1] - css[3],
    },
    size: NSSize {
      width: css[2],
      height: css[3],
    },
  }
}

/// `layout` override — repositions the view when the parent resizes.
extern "C" fn vlc_video_view_layout(this: &Object, _sel: Sel) {
  unsafe {
    let superclass = Class::get("NSView").unwrap();
    let _: () = msg_send![super(this, superclass), layout];

    let superview: *mut Object = msg_send![this, superview];
    if superview.is_null() {
      return;
    }
    let parent_frame: NSRect = msg_send![superview, frame];
    let css = [
      *this.get_ivar::<f64>(CSS_X),
      *this.get_ivar::<f64>(CSS_Y),
      *this.get_ivar::<f64>(CSS_W),
      *this.get_ivar::<f64>(CSS_H),
    ];
    let frame = css_to_ns_rect(css, parent_frame.size.height);
    let _: () = msg_send![this, setFrame: frame];
  }
}

/// Register `VlcVideoView` once and return its `&'static Class`.
fn vlc_video_view_class() -> &'static Class {
  static INIT: std::sync::Once = std::sync::Once::new();
  static mut CLS: *const Class = std::ptr::null();

  INIT.call_once(|| unsafe {
    let superclass = Class::get("NSView").unwrap();
    let mut decl = ClassDecl::new("VlcVideoView", superclass).unwrap();
    decl.add_ivar::<f64>(CSS_X);
    decl.add_ivar::<f64>(CSS_Y);
    decl.add_ivar::<f64>(CSS_W);
    decl.add_ivar::<f64>(CSS_H);
    decl.add_method(
      sel!(layout),
      vlc_video_view_layout as extern "C" fn(&Object, Sel),
    );
    CLS = decl.register();
  });

  unsafe { &*CLS }
}

unsafe fn set_css_rect_ivars(view: &mut Object, rect: [f64; 4]) {
  view.set_ivar(CSS_X, rect[0]);
  view.set_ivar(CSS_Y, rect[1]);
  view.set_ivar(CSS_W, rect[2]);
  view.set_ivar(CSS_H, rect[3]);
}

pub unsafe fn apply_output_window(
  api: &LibVlcApi,
  player: *mut LibvlcMediaPlayer,
  state: &mut VlcAddonState,
) -> NapiResult<()> {
  let parent_view = state.output_parent_view;
  let css_rect = state.video_rect;
  let parent_frame: NSRect = msg_send![parent_view, frame];
  let frame = css_to_ns_rect(css_rect, parent_frame.size.height);

  if !state.vlc_subview.is_null() {
    let _: () = msg_send![state.vlc_subview, setFrame: frame];
    set_css_rect_ivars(&mut *state.vlc_subview, css_rect);
    match api.libvlc_media_player_set_nsobject {
      Some(setter) => setter(player, state.vlc_subview as *mut c_void),
      None => return Err(to_napi_error("libVLC does not expose nsobject setter")),
    }
    return Ok(());
  }

  let cls = vlc_video_view_class();
  let ns_view: *mut Object = msg_send![cls, alloc];
  let ns_view: *mut Object = msg_send![ns_view, initWithFrame: frame];
  set_css_rect_ivars(&mut *ns_view, css_rect);

  let _: () = msg_send![ns_view, setWantsLayer: true];
  // Flexible margins — the `layout` override repositions on resize
  let _: () = msg_send![ns_view, setAutoresizingMask: 45_u64];
  let _: () = msg_send![parent_view, addSubview: ns_view positioned: -1_i32 relativeTo: std::ptr::null_mut::<Object>()];

  state.vlc_subview = ns_view;

  match api.libvlc_media_player_set_nsobject {
    Some(setter) => setter(player, ns_view as *mut c_void),
    None => return Err(to_napi_error("libVLC does not expose nsobject setter")),
  }
  Ok(())
}
