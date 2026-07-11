use tauri::Manager;

const DEFAULT_WINDOW_WIDTH: u32 = 1920;
const DEFAULT_WINDOW_HEIGHT: u32 = 1080;
const MIN_WINDOW_WIDTH: u32 = 640;
const MIN_WINDOW_HEIGHT: u32 = 360;
const LANDSCAPE_WINDOW_WIDTH_RATIO: f64 = 0.5;
const PORTRAIT_WINDOW_WIDTH_RATIO: f64 = 0.9;

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
        .setup(|app| {
            apply_initial_window_size(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
