use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    env,
    fs::{self, OpenOptions},
    net::TcpListener,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::Duration,
};
use tauri::Manager;

#[derive(Default)]
struct AppState {
    codex: Mutex<Option<CodexProcess>>,
}

struct CodexProcess {
    child: Child,
    endpoint: String,
    project_root: String,
}

impl Drop for CodexProcess {
    fn drop(&mut self) {
        terminate_child(&mut self.child);
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SubscriptionStatus {
    command: String,
    installed: bool,
    version: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GoalView {
    id: String,
    parent_id: Option<String>,
    objective: String,
    status: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskView {
    id: String,
    goal_id: Option<String>,
    repo_root: String,
    worktree_path: String,
    objective: String,
    status: String,
    runtime: String,
    runtime_ref: Option<String>,
    commit_sha: Option<String>,
    summary: Option<String>,
    report: Option<Value>,
    error: Option<String>,
    updated_at: String,
    events: Vec<TaskEventView>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskEventView {
    id: i64,
    event_type: String,
    payload: Value,
    created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Bootstrap {
    tandem_home: String,
    project_root: String,
    runtime: String,
    outer_label: String,
    worker_label: String,
    codex: SubscriptionStatus,
    claude: SubscriptionStatus,
    goals: Vec<GoalView>,
    tasks: Vec<TaskView>,
}

#[derive(Debug, Serialize)]
struct CodexEndpoint {
    endpoint: String,
}

#[derive(Debug, Deserialize)]
struct TandemConfig {
    #[serde(default = "default_runtime")]
    runtime: String,
    #[serde(default)]
    profiles: Vec<Profile>,
    routing: Option<Routing>,
}

#[derive(Debug, Deserialize)]
struct Profile {
    id: String,
    provider: String,
    transport: String,
    command: String,
    model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Routing {
    outer: String,
    worker: String,
}

#[tauri::command]
fn desktop_bootstrap() -> Result<Bootstrap, String> {
    let home = tandem_home();
    let config = read_config(&home);
    let project_root = tandem_repo_root();
    let (goals, tasks) = read_ledger(&home);

    let outer = routed_profile(&config, true);
    let worker = routed_profile(&config, false);
    let runtime = config.runtime.clone();

    Ok(Bootstrap {
        tandem_home: home.to_string_lossy().into_owned(),
        project_root: project_root.to_string_lossy().into_owned(),
        runtime,
        outer_label: profile_label(outer, "Codex CLI"),
        worker_label: profile_label(worker, "Claude CLI"),
        codex: probe_command(
            outer
                .map(|profile| profile.command.as_str())
                .unwrap_or("codex"),
        ),
        claude: probe_command(
            worker
                .map(|profile| profile.command.as_str())
                .unwrap_or("claude"),
        ),
        goals,
        tasks,
    })
}

#[tauri::command]
fn desktop_tasks() -> Vec<TaskView> {
    read_tasks(&tandem_home())
}

#[tauri::command]
fn start_codex(
    project_root: String,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<CodexEndpoint, String> {
    let canonical = PathBuf::from(&project_root)
        .canonicalize()
        .map_err(|error| format!("Project folder is unavailable: {error}"))?;
    if !canonical.is_dir() {
        return Err("The selected project is not a folder.".into());
    }
    let project_root = canonical.to_string_lossy().into_owned();
    let mut process = state
        .codex
        .lock()
        .map_err(|_| "Codex state is unavailable.")?;

    if let Some(existing) = process.as_mut() {
        if existing.project_root == project_root
            && existing.child.try_wait().ok().flatten().is_none()
        {
            return Ok(CodexEndpoint {
                endpoint: existing.endpoint.clone(),
            });
        }
        *process = None;
    }

    let endpoint = reserve_endpoint()?;
    let home = tandem_home();
    let config = read_config(&home);
    let codex_command = routed_profile(&config, true)
        .map(|profile| profile.command.clone())
        .unwrap_or_else(|| "codex".into());
    let executable = resolve_command(&codex_command)
        .ok_or_else(|| format!("Codex CLI was not found: {codex_command}"))?;
    let node = resolve_command("node").ok_or("Node.js was not found.")?;
    let (mcp_entry, worker_entry) = runtime_assets(&app)?;
    if !mcp_entry.exists() {
        return Err(format!(
            "Tandem must be built before launching the desktop app: {}",
            mcp_entry.display()
        ));
    }
    let logs = home.join("logs");
    fs::create_dir_all(&logs)
        .map_err(|error| format!("Could not create Tandem log folder: {error}"))?;
    let app_server_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(logs.join("codex-app-server.log"))
        .map_err(|error| format!("Could not open Codex app-server log: {error}"))?;
    let app_server_error = app_server_log
        .try_clone()
        .map_err(|error| format!("Could not prepare Codex app-server logging: {error}"))?;

    let mut command = Command::new(executable);
    command
        .arg("app-server")
        .arg("-c")
        .arg(format!(
            "mcp_servers.tandem.command={}",
            json_string(&node.to_string_lossy())
        ))
        .arg("-c")
        .arg(format!(
            "mcp_servers.tandem.args=[{}]",
            json_string(&mcp_entry.to_string_lossy())
        ))
        .arg("-c")
        .arg(
            "mcp_servers.tandem.env_vars=[\"TANDEM_HOME\",\"TANDEM_PROJECT_ROOT\",\"TANDEM_WORKER_ENTRY\",\"CMUX_WORKSPACE_ID\",\"CMUX_SURFACE_ID\",\"CMUX_SOCKET_PATH\",\"CMUX_SOCKET_PASSWORD\"]",
        )
        .arg("--listen")
        .arg(&endpoint)
        // Keep the long-lived server out of macOS-protected project folders.
        // Each Codex thread still receives its selected cwd through thread/start.
        .current_dir(user_home())
        .env("TANDEM_HOME", &home)
        .env("TANDEM_PROJECT_ROOT", &project_root)
        .env("TANDEM_WORKER_ENTRY", &worker_entry)
        // Codex app-server exits when stdin reaches EOF, even while its WebSocket
        // listener is active. Keep the pipe owned by Child open for its lifetime.
        .stdin(Stdio::piped())
        .stdout(Stdio::from(app_server_log))
        .stderr(Stdio::from(app_server_error));

    let child = command
        .spawn()
        .map_err(|error| format!("Could not start Codex app-server: {error}"))?;
    *process = Some(CodexProcess {
        child,
        endpoint: endpoint.clone(),
        project_root,
    });

    Ok(CodexEndpoint { endpoint })
}

fn tandem_home() -> PathBuf {
    if let Ok(path) = env::var("TANDEM_HOME") {
        if !path.trim().is_empty() {
            return PathBuf::from(path);
        }
    }
    user_home().join(".tandem")
}

fn user_home() -> PathBuf {
    env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn tandem_repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..")
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.."))
}

fn runtime_assets(app: &tauri::AppHandle) -> Result<(PathBuf, PathBuf), String> {
    let source_resources = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources");
    if cfg!(debug_assertions) && source_resources.join("mcp-server.mjs").exists() {
        return Ok((
            source_resources.join("mcp-server.mjs"),
            source_resources.join("cli.mjs"),
        ));
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Could not locate Tandem desktop resources: {error}"))?;
    let resources = resource_dir.join("resources");
    Ok((resources.join("mcp-server.mjs"), resources.join("cli.mjs")))
}

fn default_runtime() -> String {
    "auto".into()
}

fn read_config(home: &Path) -> TandemConfig {
    let fallback = TandemConfig {
        runtime: "auto".into(),
        profiles: vec![],
        routing: None,
    };
    let Ok(raw) = fs::read_to_string(home.join("config.json")) else {
        return fallback;
    };
    serde_json::from_str(&raw).unwrap_or(fallback)
}

fn routed_profile(config: &TandemConfig, outer: bool) -> Option<&Profile> {
    let id = config.routing.as_ref().map(|routing| {
        if outer {
            routing.outer.as_str()
        } else {
            routing.worker.as_str()
        }
    });
    id.and_then(|id| config.profiles.iter().find(|profile| profile.id == id))
        .or_else(|| {
            config.profiles.iter().find(|profile| {
                if outer {
                    profile.transport == "codex-cli"
                } else {
                    profile.transport == "claude-cli"
                }
            })
        })
}

fn profile_label(profile: Option<&Profile>, fallback: &str) -> String {
    let Some(profile) = profile else {
        return fallback.into();
    };
    let provider = capitalize(&profile.provider);
    match &profile.model {
        Some(model) => format!("{provider} · {model}"),
        None => format!("{provider} CLI"),
    }
}

fn capitalize(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

fn read_ledger(home: &Path) -> (Vec<GoalView>, Vec<TaskView>) {
    let path = home.join("tandem.sqlite");
    let Ok(connection) = Connection::open_with_flags(
        path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    ) else {
        return (vec![], vec![]);
    };

    let goals = connection
        .prepare(
            "SELECT id, parent_id, objective, status, updated_at
             FROM goals ORDER BY updated_at DESC LIMIT 50",
        )
        .and_then(|mut statement| {
            statement
                .query_map([], |row| {
                    Ok(GoalView {
                        id: row.get(0)?,
                        parent_id: row.get(1)?,
                        objective: row.get(2)?,
                        status: row.get(3)?,
                        updated_at: row.get(4)?,
                    })
                })?
                .collect()
        })
        .unwrap_or_default();

    let tasks = read_tasks_from_connection(&connection);

    (goals, tasks)
}

fn read_tasks(home: &Path) -> Vec<TaskView> {
    let path = home.join("tandem.sqlite");
    let Ok(connection) = Connection::open_with_flags(
        path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    ) else {
        return vec![];
    };
    read_tasks_from_connection(&connection)
}

fn read_tasks_from_connection(connection: &Connection) -> Vec<TaskView> {
    connection
        .prepare(
            "SELECT id, goal_id, repo_root, worktree_path, objective, status,
                    runtime, runtime_ref, commit_sha, summary, report_json,
                    error, updated_at
             FROM tasks ORDER BY updated_at DESC LIMIT 100",
        )
        .and_then(|mut statement| {
            statement
                .query_map([], |row| {
                    let task_id: String = row.get(0)?;
                    let report_json: Option<String> = row.get(10)?;
                    Ok(TaskView {
                        events: read_task_events(connection, &task_id),
                        id: task_id,
                        goal_id: row.get(1)?,
                        repo_root: row.get(2)?,
                        worktree_path: row.get(3)?,
                        objective: row.get(4)?,
                        status: row.get(5)?,
                        runtime: row.get(6)?,
                        runtime_ref: row.get(7)?,
                        commit_sha: row.get(8)?,
                        summary: row.get(9)?,
                        report: report_json
                            .and_then(|raw| serde_json::from_str::<Value>(&raw).ok()),
                        error: row.get(11)?,
                        updated_at: row.get(12)?,
                    })
                })?
                .collect()
        })
        .unwrap_or_default()
}

fn read_task_events(connection: &Connection, task_id: &str) -> Vec<TaskEventView> {
    connection
        .prepare(
            "SELECT id, type, payload_json, created_at
             FROM task_events WHERE task_id = ?
             ORDER BY id DESC LIMIT 12",
        )
        .and_then(|mut statement| {
            statement
                .query_map([task_id], |row| {
                    let payload_json: String = row.get(2)?;
                    Ok(TaskEventView {
                        id: row.get(0)?,
                        event_type: row.get(1)?,
                        payload: serde_json::from_str(&payload_json).unwrap_or(Value::Null),
                        created_at: row.get(3)?,
                    })
                })?
                .collect()
        })
        .map(|mut events: Vec<TaskEventView>| {
            events.reverse();
            events
        })
        .unwrap_or_default()
}

fn probe_command(command: &str) -> SubscriptionStatus {
    let executable = resolve_command(command);
    let version = executable.as_ref().and_then(|path| {
        Command::new(path)
            .arg("--version")
            .stdin(Stdio::null())
            .stderr(Stdio::null())
            .output()
            .ok()
            .filter(|output| output.status.success())
            .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
    });
    SubscriptionStatus {
        command: command.into(),
        installed: executable.is_some(),
        version,
    }
}

fn resolve_command(command: &str) -> Option<PathBuf> {
    let direct = PathBuf::from(command);
    if direct.components().count() > 1 && direct.exists() {
        return Some(direct);
    }
    let output = Command::new("/bin/zsh")
        .arg("-lc")
        .arg(format!("command -v {}", shell_quote(command)))
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        None
    } else {
        Some(PathBuf::from(path))
    }
}

fn reserve_endpoint() -> Result<String, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|error| format!("Could not reserve a local Codex port: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("Could not read the local Codex port: {error}"))?
        .port();
    drop(listener);
    std::thread::sleep(Duration::from_millis(10));
    Ok(format!("ws://127.0.0.1:{port}"))
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn json_string(value: &str) -> String {
    serde_json::to_string(&Value::String(value.to_string())).unwrap_or_else(|_| "\"\"".into())
}

fn stop_codex(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    if let Ok(mut process) = state.codex.lock() {
        *process = None;
    };
}

fn terminate_child(child: &mut Child) {
    if child.try_wait().ok().flatten().is_some() {
        return;
    }
    let _ = Command::new("/bin/kill")
        .arg("-TERM")
        .arg(child.id().to_string())
        .status();
    for _ in 0..20 {
        if child.try_wait().ok().flatten().is_some() {
            return;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    let _ = child.kill();
    let _ = child.wait();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_websocket::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            desktop_bootstrap,
            desktop_tasks,
            start_codex
        ])
        .build(tauri::generate_context!())
        .expect("error while building Tandem desktop");
    app.run(|app_handle, event| {
        if matches!(
            event,
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
        ) {
            stop_codex(app_handle);
        }
    });
}
