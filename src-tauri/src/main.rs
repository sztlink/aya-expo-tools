// AYA Expo Tools — Tauri App Shell
// Minimal Rust: just window + Node.js sidecar management

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Command, Child};
use std::sync::Mutex;
use tauri::Manager;

struct NodeServer(Mutex<Option<Child>>);

fn start_node_server() -> Option<Child> {
    // Look for node in app directory first, then PATH
    let node_paths = vec![
        "node\\node.exe".to_string(),
        "node.exe".to_string(),
    ];

    for node_path in &node_paths {
        if let Ok(child) = Command::new(node_path)
            .arg("index.js")
            .current_dir(std::env::current_dir().unwrap_or_default())
            .spawn()
        {
            println!("[Tauri] Node.js server started (pid: {})", child.id());
            return Some(child);
        }
    }

    // Fallback: try node from PATH
    if let Ok(child) = Command::new("node")
        .arg("index.js")
        .spawn()
    {
        println!("[Tauri] Node.js server started from PATH (pid: {})", child.id());
        return Some(child);
    }

    eprintln!("[Tauri] Failed to start Node.js server");
    None
}

fn main() {
    tauri::Builder::default()
        //.plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Start Node.js server as sidecar
            let child = start_node_server();
            app.manage(NodeServer(Mutex::new(child)));

            // Wait a bit for server to start, then load
            std::thread::sleep(std::time::Duration::from_secs(2));

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Kill Node.js server when window closes
                if let Some(state) = window.try_state::<NodeServer>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(ref mut child) = *guard {
                            let _ = child.kill();
                            println!("[Tauri] Node.js server stopped");
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
