use std::{fs, path::Path};

use tauri::Manager;

const DEFAULT_WINDOW_WIDTH: u32 = 1920;
const DEFAULT_WINDOW_HEIGHT: u32 = 1080;
const MIN_WINDOW_WIDTH: u32 = 640;
const MIN_WINDOW_HEIGHT: u32 = 360;
const LANDSCAPE_WINDOW_WIDTH_RATIO: f64 = 0.5;
const PORTRAIT_WINDOW_WIDTH_RATIO: f64 = 0.9;
const MAX_DROPPED_FILE_BYTES: u64 = 100 * 1024 * 1024;
const SUPPORTED_DROPPED_EXTENSIONS: &[&str] = &[
    "aparallax",
    "avif",
    "bmp",
    "gif",
    "ico",
    "jfif",
    "jpeg",
    "jpg",
    "png",
    "svg",
    "webp",
];

fn is_supported_dropped_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            SUPPORTED_DROPPED_EXTENSIONS
                .iter()
                .any(|supported| extension.eq_ignore_ascii_case(supported))
        })
}

#[tauri::command]
fn read_dropped_file(path: String) -> Result<tauri::ipc::Response, String> {
    let path = Path::new(&path);
    if !path.is_file() {
        return Err("The dropped path is not a readable file.".to_string());
    }
    if !is_supported_dropped_file(path) {
        return Err("The dropped file type is not supported.".to_string());
    }

    let metadata =
        fs::metadata(path).map_err(|error| format!("Failed to inspect file: {error}"))?;
    if metadata.len() > MAX_DROPPED_FILE_BYTES {
        return Err("The dropped file is larger than 100 MB.".to_string());
    }

    let bytes = fs::read(path).map_err(|error| format!("Failed to read file: {error}"))?;
    Ok(tauri::ipc::Response::new(bytes))
}

fn clamp_window_dimension(value: u32, min: u32, monitor_max: u32) -> u32 {
    let max = monitor_max.max(1);
    value.max(min.min(max)).min(max)
}

fn initial_window_size(monitor_width: u32, monitor_height: u32) -> tauri::PhysicalSize<u32> {
    let width_ratio = if monitor_width < monitor_height {
        PORTRAIT_WINDOW_WIDTH_RATIO
    } else {
        LANDSCAPE_WINDOW_WIDTH_RATIO
    };
    let aspect = DEFAULT_WINDOW_HEIGHT as f64 / DEFAULT_WINDOW_WIDTH as f64;
    let mut width = (monitor_width as f64 * width_ratio).round();
    let mut height = (width * aspect).round();
    let max_height = (monitor_height as f64 * 0.9).round().max(1.0);

    if height > max_height {
        height = max_height;
        width = (height / aspect).round();
    }

    tauri::PhysicalSize::new(width.max(1.0) as u32, height.max(1.0) as u32)
}

fn apply_initial_window_size(app: &tauri::App) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let monitor_size = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())
        .map(|monitor| *monitor.size());
    let monitor_width = monitor_size
        .as_ref()
        .map(|size| size.width)
        .unwrap_or(DEFAULT_WINDOW_WIDTH);
    let monitor_height = monitor_size
        .as_ref()
        .map(|size| size.height)
        .unwrap_or(DEFAULT_WINDOW_HEIGHT);
    let size = initial_window_size(monitor_width, monitor_height);
    let size = tauri::PhysicalSize::new(
        clamp_window_dimension(size.width, MIN_WINDOW_WIDTH, monitor_width),
        clamp_window_dimension(size.height, MIN_WINDOW_HEIGHT, monitor_height),
    );

    if let Err(error) = window.set_size(tauri::Size::Physical(size)) {
        eprintln!("Failed to initialize window size: {error}");
    }
    let _ = window.center();
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_dropped_file])
        .setup(|app| {
            apply_initial_window_size(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

#[cfg(test)]
mod tests {
    use super::is_supported_dropped_file;
    use std::path::Path;

    #[test]
    fn dropped_file_extensions_are_checked_case_insensitively() {
        assert!(is_supported_dropped_file(Path::new("source.PNG")));
        assert!(is_supported_dropped_file(Path::new("depth.webp")));
        assert!(is_supported_dropped_file(Path::new("scene.aparallax")));
        assert!(!is_supported_dropped_file(Path::new("notes.txt")));
    }
}
