use std::fmt;

const PREFIX: &str = "[vlc-native]";

pub fn print(enabled: bool, args: fmt::Arguments<'_>) {
  if !enabled {
    return;
  }

  eprintln!("{PREFIX} {args}");
}
