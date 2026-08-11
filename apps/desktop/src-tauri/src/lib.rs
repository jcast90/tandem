use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    env,
    fs::{self, OpenOptions},
    net::{SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{Duration, Instant},
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
        terminate_child_tree(&mut self.child);
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SubscriptionStatus {
    command: String,
    resolved_path: Option<String>,
    installed: bool,
    version: Option<String>,
    authenticated: Option<bool>,
    auth_label: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
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
    profile_id: String,
    repo_root: String,
    worktree_path: String,
    objective: String,
    status: String,
    runtime: String,
    runtime_ref: Option<String>,
    worker_model: Option<String>,
    permission_mode: Option<String>,
    commit_sha: Option<String>,
    summary: Option<String>,
    report: Option<Value>,
    error: Option<String>,
    created_at: String,
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
struct ExecutionRunView {
    id: String,
    goal_id: Option<String>,
    repo_root: String,
    objective: String,
    status: String,
    source_sha: String,
    policy: Value,
    integration_commit_sha: Option<String>,
    error: Option<String>,
    created_at: String,
    updated_at: String,
    task_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskFileView {
    path: String,
    absolute_path: String,
    additions: Option<u32>,
    deletions: Option<u32>,
    status: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FilePreview {
    path: String,
    content: String,
    truncated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Bootstrap {
    tandem_home: String,
    project_root: String,
    log_path: String,
    runtime: String,
    outer_label: String,
    worker_label: String,
    codex: SubscriptionStatus,
    claude: SubscriptionStatus,
    goals: Vec<GoalView>,
    tasks: Vec<TaskView>,
    runs: Vec<ExecutionRunView>,
    routing_profiles: Vec<RoutingProfileView>,
    routing_rules: Vec<TaskRoutingRule>,
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
    #[serde(default)]
    role: String,
    provider: String,
    transport: String,
    command: String,
    model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Routing {
    outer: String,
    worker: String,
    #[serde(default)]
    reviewer: Option<String>,
    #[serde(default, rename = "taskRules")]
    task_rules: Vec<TaskRoutingRule>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskRoutingRule {
    task_class: String,
    profile_id: String,
    #[serde(default = "default_fallback_profile_ids")]
    fallback_profile_ids: Vec<String>,
    model: Option<String>,
    effort: Option<String>,
    max_concurrency: u8,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RoutingProfileView {
    id: String,
    role: String,
    provider: String,
    transport: String,
    model: Option<String>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSettings {
    codex_command: Option<String>,
    claude_command: Option<String>,
}

#[tauri::command]
async fn desktop_bootstrap() -> Result<Bootstrap, String> {
    run_blocking(desktop_bootstrap_blocking).await
}

fn desktop_bootstrap_blocking() -> Result<Bootstrap, String> {
    let home = tandem_home();
    let config = read_config(&home);
    let settings = read_desktop_settings(&home);
    let project_root = tandem_repo_root();
    let (goals, tasks, runs) = read_ledger(&home);

    let outer = routed_profile(&config, true);
    let worker = routed_profile(&config, false);
    let runtime = config.runtime.clone();
    let codex_command = settings
        .codex_command
        .as_deref()
        .or_else(|| outer.map(|profile| profile.command.as_str()))
        .unwrap_or("codex");
    let claude_command = settings
        .claude_command
        .as_deref()
        .or_else(|| worker.map(|profile| profile.command.as_str()))
        .unwrap_or("claude");

    Ok(Bootstrap {
        tandem_home: home.to_string_lossy().into_owned(),
        project_root: project_root.to_string_lossy().into_owned(),
        log_path: home
            .join("logs")
            .join("codex-app-server.log")
            .to_string_lossy()
            .into_owned(),
        runtime,
        outer_label: profile_label(outer, "Codex CLI"),
        worker_label: profile_label(worker, "Claude CLI"),
        codex: probe_command(codex_command, "codex"),
        claude: probe_command(claude_command, "claude"),
        goals,
        tasks,
        runs,
        routing_profiles: config
            .profiles
            .iter()
            .map(|profile| RoutingProfileView {
                id: profile.id.clone(),
                role: profile.role.clone(),
                provider: profile.provider.clone(),
                transport: profile.transport.clone(),
                model: profile.model.clone(),
            })
            .collect(),
        routing_rules: routing_rules(&config),
    })
}

#[tauri::command]
async fn save_desktop_settings(
    settings: DesktopSettings,
    app: tauri::AppHandle,
) -> Result<Bootstrap, String> {
    run_blocking(move || save_desktop_settings_blocking(settings, &app)).await
}

fn save_desktop_settings_blocking(
    settings: DesktopSettings,
    app: &tauri::AppHandle,
) -> Result<Bootstrap, String> {
    let settings = DesktopSettings {
        codex_command: clean_command(settings.codex_command),
        claude_command: clean_command(settings.claude_command),
    };
    let home = tandem_home();
    fs::create_dir_all(&home)
        .map_err(|error| format!("Could not create Tandem settings folder: {error}"))?;
    let contents = serde_json::to_string_pretty(&settings)
        .map_err(|error| format!("Could not prepare Tandem settings: {error}"))?;
    let temporary = home.join("desktop-settings.json.tmp");
    fs::write(&temporary, format!("{contents}\n"))
        .map_err(|error| format!("Could not save Tandem settings: {error}"))?;
    fs::rename(&temporary, home.join("desktop-settings.json"))
        .map_err(|error| format!("Could not finish saving Tandem settings: {error}"))?;
    let state = app.state::<AppState>();
    if let Ok(mut process) = state.codex.lock() {
        *process = None;
    }
    desktop_bootstrap_blocking()
}

#[tauri::command]
async fn save_routing_settings(rules: Vec<TaskRoutingRule>) -> Result<Bootstrap, String> {
    run_blocking(move || save_routing_settings_blocking(rules)).await
}

fn save_routing_settings_blocking(rules: Vec<TaskRoutingRule>) -> Result<Bootstrap, String> {
    validate_routing_rules(&rules)?;
    let home = tandem_home();
    let config = read_config(&home);
    for rule in &rules {
        if !config
            .profiles
            .iter()
            .any(|profile| profile.id == rule.profile_id)
        {
            return Err(format!("Unknown routing profile: {}", rule.profile_id));
        }
        for fallback_id in &rule.fallback_profile_ids {
            if fallback_id == &rule.profile_id {
                return Err(format!(
                    "Fallback profile must differ from the primary profile: {fallback_id}"
                ));
            }
            if !config
                .profiles
                .iter()
                .any(|profile| &profile.id == fallback_id)
            {
                return Err(format!("Unknown fallback routing profile: {fallback_id}"));
            }
        }
    }
    let path = home.join("config.json");
    fs::create_dir_all(&home)
        .map_err(|error| format!("Could not create Tandem settings folder: {error}"))?;
    let mut value: Value = match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw)
            .map_err(|error| format!("Could not parse Tandem configuration: {error}"))?,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => fallback_config_value(),
        Err(error) => return Err(format!("Could not read Tandem configuration: {error}")),
    };
    let routing = value
        .get_mut("routing")
        .and_then(Value::as_object_mut)
        .ok_or_else(|| "Tandem configuration is missing its routing section.".to_string())?;
    routing.insert(
        "taskRules".into(),
        serde_json::to_value(rules)
            .map_err(|error| format!("Could not prepare routing settings: {error}"))?,
    );
    let contents = serde_json::to_string_pretty(&value)
        .map_err(|error| format!("Could not prepare Tandem configuration: {error}"))?;
    let temporary = home.join("config.json.tmp");
    fs::write(&temporary, format!("{contents}\n"))
        .map_err(|error| format!("Could not save routing settings: {error}"))?;
    fs::rename(&temporary, path)
        .map_err(|error| format!("Could not finish saving routing settings: {error}"))?;
    desktop_bootstrap_blocking()
}

#[tauri::command]
async fn open_provider_login(provider: String) -> Result<String, String> {
    run_blocking(move || open_provider_login_blocking(provider)).await
}

fn open_provider_login_blocking(provider: String) -> Result<String, String> {
    if provider != "codex" && provider != "claude" {
        return Err("Unknown provider.".into());
    }
    let home = tandem_home();
    let config = read_config(&home);
    let settings = read_desktop_settings(&home);
    let configured = if provider == "codex" {
        settings
            .codex_command
            .or_else(|| routed_profile(&config, true).map(|profile| profile.command.clone()))
            .unwrap_or_else(|| "codex".into())
    } else {
        settings
            .claude_command
            .or_else(|| routed_profile(&config, false).map(|profile| profile.command.clone()))
            .unwrap_or_else(|| "claude".into())
    };
    let executable = resolve_command(&configured)
        .ok_or_else(|| format!("{} CLI was not found.", capitalize(&provider)))?;
    let actions = home.join("actions");
    fs::create_dir_all(&actions)
        .map_err(|error| format!("Could not create Tandem actions folder: {error}"))?;
    let script = actions.join(format!("{provider}-login.command"));
    let arguments = if provider == "codex" {
        "login"
    } else {
        "auth login"
    };
    let title = capitalize(&provider);
    let contents = format!(
        "#!/bin/zsh\nclear\nprintf '\\nTandem — Connect {title}\\n\\n'\nexport PATH={}\n{} {arguments}\nresult=$?\nprintf '\\n'\nif [ $result -eq 0 ]; then\n  printf '{title} is connected. Return to Tandem and choose Retry.\\n'\nelse\n  printf '{title} login did not complete. You can retry this command or close the window.\\n'\nfi\nprintf '\\nPress any key to close…'\nread -k 1\n",
        shell_quote(&command_path(&executable)),
        shell_quote(&executable.to_string_lossy())
    );
    fs::write(&script, contents)
        .map_err(|error| format!("Could not prepare {title} login: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&script, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Could not prepare {title} login permissions: {error}"))?;
    }
    Command::new("/usr/bin/open")
        .arg("-a")
        .arg("Terminal")
        .arg(&script)
        .spawn()
        .map_err(|error| format!("Could not open Terminal for {title}: {error}"))?;
    Ok(format!("{title} login opened in Terminal."))
}

#[tauri::command]
fn reveal_connection_log() -> Result<(), String> {
    let path = tandem_home().join("logs").join("codex-app-server.log");
    if !path.exists() {
        return Err("No Codex connection log exists yet.".into());
    }
    Command::new("/usr/bin/open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map_err(|error| format!("Could not reveal the connection log: {error}"))?;
    Ok(())
}

#[tauri::command]
async fn desktop_tasks() -> Result<Vec<TaskView>, String> {
    run_blocking(|| Ok(read_tasks(&tandem_home()))).await
}

#[tauri::command]
async fn desktop_runs() -> Result<Vec<ExecutionRunView>, String> {
    run_blocking(|| {
        let home = tandem_home();
        let path = home.join("tandem.sqlite");
        let connection = Connection::open_with_flags(
            path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(|error| format!("Could not open Tandem's run ledger: {error}"))?;
        Ok(read_runs_from_connection(&connection))
    })
    .await
}

#[tauri::command]
async fn desktop_benchmarks(app: tauri::AppHandle) -> Result<Value, String> {
    run_blocking(move || {
        let output = run_tandem_command(&app, &["benchmark", "export"])?;
        serde_json::from_str(&output)
            .map_err(|error| format!("Could not read Tandem benchmarks: {error}"))
    })
    .await
}

#[tauri::command]
async fn desktop_benchmark_create(
    name: String,
    budget_dollars: f64,
    app: tauri::AppHandle,
) -> Result<(), String> {
    run_blocking(move || {
        if name.trim().is_empty() {
            return Err("Benchmark name cannot be empty.".into());
        }
        let budget = budget_dollars.to_string();
        run_tandem_command(
            &app,
            &["benchmark", "create", name.trim(), "--budget", &budget],
        )?;
        Ok(())
    })
    .await
}

#[tauri::command]
async fn desktop_benchmark_add(
    benchmark_id: String,
    variant: String,
    label: String,
    task_class: String,
    difficulty: u8,
    run_id: Option<String>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    run_blocking(move || {
        let difficulty_value = difficulty.to_string();
        let mut args = vec![
            "benchmark".to_string(),
            "add".to_string(),
            benchmark_id,
            "--variant".to_string(),
            variant,
            "--label".to_string(),
            label,
            "--class".to_string(),
            task_class,
            "--difficulty".to_string(),
            difficulty_value,
        ];
        if let Some(run_id) = run_id.filter(|value| !value.trim().is_empty()) {
            args.push("--run".to_string());
            args.push(run_id);
        }
        let refs = args.iter().map(String::as_str).collect::<Vec<_>>();
        run_tandem_command(&app, &refs)?;
        Ok(())
    })
    .await
}

#[tauri::command]
async fn desktop_benchmark_score(
    trial_id: String,
    accepted: bool,
    quality_score: f64,
    wall_time_minutes: f64,
    human_minutes: f64,
    revision_count: u32,
    codex_usage_percent_delta: Option<f64>,
    claude_usage_percent_delta: Option<f64>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    run_blocking(move || {
        let mut args = vec![
            "benchmark".to_string(),
            "score".to_string(),
            trial_id,
            "--accepted".to_string(),
            if accepted { "yes" } else { "no" }.to_string(),
            "--quality".to_string(),
            quality_score.to_string(),
            "--wall-minutes".to_string(),
            wall_time_minutes.to_string(),
            "--human-minutes".to_string(),
            human_minutes.to_string(),
            "--revisions".to_string(),
            revision_count.to_string(),
        ];
        for (option, value) in [
            ("--codex-usage", codex_usage_percent_delta),
            ("--claude-usage", claude_usage_percent_delta),
        ] {
            if let Some(value) = value {
                args.push(option.to_string());
                args.push(value.to_string());
            }
        }
        let refs = args.iter().map(String::as_str).collect::<Vec<_>>();
        run_tandem_command(&app, &refs)?;
        Ok(())
    })
    .await
}

#[tauri::command]
async fn desktop_goal_create(
    objective: String,
    parent_id: Option<String>,
    app: tauri::AppHandle,
) -> Result<GoalView, String> {
    run_blocking(move || {
        let objective = objective.trim();
        if objective.is_empty() {
            return Err("Goal objective cannot be empty.".into());
        }
        let output = if let Some(parent_id) = parent_id.as_deref() {
            run_tandem_command(&app, &["goal", "create", "--parent", parent_id, objective])?
        } else {
            run_tandem_command(&app, &["goal", "create", objective])?
        };
        serde_json::from_str(&output)
            .map_err(|error| format!("Could not read created goal: {error}"))
    })
    .await
}

#[tauri::command]
async fn desktop_goal_update(
    goal_id: String,
    status: String,
    app: tauri::AppHandle,
) -> Result<GoalView, String> {
    run_blocking(move || {
        if !matches!(
            status.as_str(),
            "active" | "complete" | "blocked" | "canceled"
        ) {
            return Err(format!("Unsupported goal status: {status}"));
        }
        let output = run_tandem_command(&app, &["goal", "update", &goal_id, &status])?;
        serde_json::from_str(&output)
            .map_err(|error| format!("Could not read updated goal: {error}"))
    })
    .await
}

#[tauri::command]
async fn desktop_task_cancel(task_id: String, app: tauri::AppHandle) -> Result<TaskView, String> {
    run_blocking(move || {
        run_tandem_command(&app, &["task", "cancel", &task_id])?;
        find_task(&task_id)
    })
    .await
}

#[tauri::command]
async fn desktop_task_steer(
    task_id: String,
    message: String,
    app: tauri::AppHandle,
) -> Result<TaskView, String> {
    run_blocking(move || {
        if message.trim().is_empty() {
            return Err("Steering guidance cannot be empty.".into());
        }
        run_tandem_command(&app, &["task", "steer", &task_id, message.trim()])?;
        find_task(&task_id)
    })
    .await
}

#[tauri::command]
async fn desktop_task_files(task_id: String) -> Result<Vec<TaskFileView>, String> {
    run_blocking(move || desktop_task_files_blocking(task_id)).await
}

fn desktop_task_files_blocking(task_id: String) -> Result<Vec<TaskFileView>, String> {
    let task = find_task(&task_id)?;
    let worktree = PathBuf::from(&task.worktree_path);
    let mut files = Vec::<TaskFileView>::new();
    let output = if let Some(commit) = &task.commit_sha {
        Command::new("git")
            .args([
                "-C",
                &task.worktree_path,
                "show",
                "--numstat",
                "--format=",
                commit,
            ])
            .output()
    } else {
        Command::new("git")
            .args(["-C", &task.worktree_path, "diff", "--numstat", "HEAD"])
            .output()
    }
    .map_err(|error| format!("Could not inspect task files: {error}"))?;
    if output.status.success() {
        for line in String::from_utf8_lossy(&output.stdout).lines() {
            let mut fields = line.splitn(3, '\t');
            let additions = fields.next().and_then(|value| value.parse::<u32>().ok());
            let deletions = fields.next().and_then(|value| value.parse::<u32>().ok());
            let Some(path) = fields.next() else { continue };
            files.push(TaskFileView {
                path: path.into(),
                absolute_path: worktree.join(path).to_string_lossy().into_owned(),
                additions,
                deletions,
                status: if task.commit_sha.is_some() {
                    "committed"
                } else {
                    "modified"
                }
                .into(),
            });
        }
    }

    if task.commit_sha.is_none() {
        let status = Command::new("git")
            .args(["-C", &task.worktree_path, "status", "--porcelain"])
            .output()
            .map_err(|error| format!("Could not inspect task status: {error}"))?;
        if status.status.success() {
            for line in String::from_utf8_lossy(&status.stdout).lines() {
                if line.len() < 4 {
                    continue;
                }
                let path = line[3..].trim();
                let path = path.split(" -> ").last().unwrap_or(path);
                if files.iter().any(|file| file.path == path) {
                    continue;
                }
                files.push(TaskFileView {
                    path: path.into(),
                    absolute_path: worktree.join(path).to_string_lossy().into_owned(),
                    additions: None,
                    deletions: None,
                    status: line[..2].trim().into(),
                });
            }
        }
    }
    Ok(files)
}

#[tauri::command]
async fn preview_local_file(path: String, project_root: String) -> Result<FilePreview, String> {
    run_blocking(move || preview_local_file_blocking(path, project_root)).await
}

fn preview_local_file_blocking(path: String, project_root: String) -> Result<FilePreview, String> {
    let canonical = allowed_local_path(&path, &project_root)?;
    if !canonical.is_file() {
        return Err("That path is not a file.".into());
    }
    const LIMIT: usize = 1_000_000;
    let bytes = fs::read(&canonical).map_err(|error| format!("Could not read file: {error}"))?;
    if bytes.iter().take(8_192).any(|byte| *byte == 0) {
        return Err("Binary files cannot be previewed in Tandem.".into());
    }
    let truncated = bytes.len() > LIMIT;
    let content = String::from_utf8_lossy(&bytes[..bytes.len().min(LIMIT)]).into_owned();
    Ok(FilePreview {
        path: canonical.to_string_lossy().into_owned(),
        content,
        truncated,
    })
}

#[tauri::command]
fn open_local_file(path: String, project_root: String) -> Result<(), String> {
    let canonical = allowed_local_path(&path, &project_root)?;
    Command::new("/usr/bin/open")
        .arg(&canonical)
        .spawn()
        .map_err(|error| format!("Could not open file: {error}"))?;
    Ok(())
}

#[tauri::command]
fn open_project_terminal(path: String, project_root: String) -> Result<(), String> {
    let canonical = allowed_local_path(&path, &project_root)?;
    let directory = if canonical.is_dir() {
        canonical
    } else {
        canonical
            .parent()
            .ok_or("Could not locate the file's folder.")?
            .to_path_buf()
    };
    Command::new("/usr/bin/open")
        .args(["-a", "Terminal"])
        .arg(directory)
        .spawn()
        .map_err(|error| format!("Could not open Terminal: {error}"))?;
    Ok(())
}

#[tauri::command]
async fn start_codex(
    project_root: String,
    force_restart: Option<bool>,
    app: tauri::AppHandle,
) -> Result<CodexEndpoint, String> {
    run_blocking(move || start_codex_blocking(project_root, force_restart, &app)).await
}

fn start_codex_blocking(
    project_root: String,
    force_restart: Option<bool>,
    app: &tauri::AppHandle,
) -> Result<CodexEndpoint, String> {
    let canonical = PathBuf::from(&project_root)
        .canonicalize()
        .map_err(|error| format!("Project folder is unavailable: {error}"))?;
    if !canonical.is_dir() {
        return Err("The selected project is not a folder.".into());
    }
    let project_root = canonical.to_string_lossy().into_owned();
    let state = app.state::<AppState>();
    let mut process = state
        .codex
        .lock()
        .map_err(|_| "Codex state is unavailable.")?;

    if force_restart.unwrap_or(false) {
        *process = None;
    } else if let Some(existing) = process.as_mut() {
        if existing.project_root == project_root
            && existing.child.try_wait().ok().flatten().is_none()
            && endpoint_ready(&existing.endpoint)
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
    let settings = read_desktop_settings(&home);
    let codex_command = settings
        .codex_command
        .or_else(|| routed_profile(&config, true).map(|profile| profile.command.clone()))
        .unwrap_or_else(|| "codex".into());
    let executable = resolve_command(&codex_command)
        .ok_or_else(|| format!("Codex CLI was not found: {codex_command}"))?;
    let node = resolve_command("node").ok_or("Node.js was not found.")?;
    let (mcp_entry, worker_entry) = runtime_assets(app)?;
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

    let mut command = Command::new(&executable);
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
        .env("PATH", command_path(&executable))
        .env("TANDEM_HOME", &home)
        .env("TANDEM_PROJECT_ROOT", &project_root)
        .env("TANDEM_WORKER_ENTRY", &worker_entry)
        // Codex app-server exits when stdin reaches EOF, even while its WebSocket
        // listener is active. Keep the pipe owned by Child open for its lifetime.
        .stdin(Stdio::piped())
        .stdout(Stdio::from(app_server_log))
        .stderr(Stdio::from(app_server_error));
    isolate_process_group(&mut command);

    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start Codex app-server: {error}"))?;
    if let Err(error) = wait_for_endpoint(&endpoint, &mut child, Duration::from_secs(12)) {
        terminate_child_tree(&mut child);
        return Err(format!(
            "{error} {}",
            recent_log_hint(&home.join("logs").join("codex-app-server.log"))
        ));
    }
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

async fn run_blocking<T, F>(operation: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(operation)
        .await
        .map_err(|error| format!("Tandem background operation stopped unexpectedly: {error}"))?
}

fn run_tandem_command(app: &tauri::AppHandle, args: &[&str]) -> Result<String, String> {
    let node = resolve_command("node").ok_or("Node.js was not found.")?;
    let (_, cli) = runtime_assets(app)?;
    if !cli.exists() {
        return Err("Tandem desktop resources are incomplete. Rebuild the app.".into());
    }
    let output = Command::new(&node)
        .arg(&cli)
        .args(args)
        .env("PATH", command_path(&node))
        .env("TANDEM_HOME", tandem_home())
        .output()
        .map_err(|error| format!("Could not run Tandem action: {error}"))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            format!("Tandem action failed with {}.", output.status)
        } else {
            detail
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn find_task(task_id: &str) -> Result<TaskView, String> {
    read_tasks(&tandem_home())
        .into_iter()
        .find(|task| task.id == task_id)
        .ok_or_else(|| format!("Task not found: {task_id}"))
}

fn allowed_local_path(path: &str, project_root: &str) -> Result<PathBuf, String> {
    let canonical = PathBuf::from(path)
        .canonicalize()
        .map_err(|error| format!("File is unavailable: {error}"))?;
    let project = PathBuf::from(project_root).canonicalize().ok();
    let mut allowed = project
        .as_ref()
        .is_some_and(|root| canonical.starts_with(root));
    if !allowed {
        allowed = read_tasks(&tandem_home()).iter().any(|task| {
            PathBuf::from(&task.worktree_path)
                .canonicalize()
                .ok()
                .is_some_and(|root| canonical.starts_with(root))
        });
    }
    if !allowed {
        allowed = agent_artifact_roots().iter().any(|root| {
            root.canonicalize()
                .ok()
                .is_some_and(|root| canonical.starts_with(root))
        });
    }
    if !allowed {
        return Err(
            "Tandem only opens files inside the selected project, a task worktree, or an agent's generated output."
                .into(),
        );
    }
    Ok(canonical)
}

/// Directories where agents write artifacts they then ask Tandem to open.
///
/// Deliberately narrow: these are output-only directories. Never add a
/// provider home such as `~/.codex` itself, which holds `auth.json`,
/// `config.toml`, and databases containing conversation history. This
/// allowlist is what stops an agent talking Tandem into opening those.
fn agent_artifact_roots() -> Vec<PathBuf> {
    vec![user_home().join(".codex").join("generated_images")]
}

fn default_runtime() -> String {
    "auto".into()
}

fn read_config(home: &Path) -> TandemConfig {
    let fallback = fallback_config();
    let Ok(raw) = fs::read_to_string(home.join("config.json")) else {
        return fallback;
    };
    let mut config: TandemConfig = serde_json::from_str(&raw).unwrap_or(fallback);
    if !config
        .profiles
        .iter()
        .any(|profile| profile.id == "fallback-freebuff")
    {
        config.profiles.push(freebuff_profile());
    }
    config
}

fn freebuff_profile() -> Profile {
    Profile {
        id: "fallback-freebuff".into(),
        role: "utility".into(),
        provider: "freebuff".into(),
        transport: "freebuff-cli".into(),
        command: "freebuff".into(),
        model: None,
    }
}

fn fallback_config() -> TandemConfig {
    TandemConfig {
        runtime: "auto".into(),
        profiles: vec![
            Profile {
                id: "outer-primary".into(),
                role: "outer".into(),
                provider: "openai".into(),
                transport: "codex-cli".into(),
                command: "codex".into(),
                model: None,
            },
            freebuff_profile(),
            Profile {
                id: "worker-primary".into(),
                role: "worker".into(),
                provider: "anthropic".into(),
                transport: "claude-cli".into(),
                command: "claude".into(),
                model: None,
            },
        ],
        routing: Some(Routing {
            outer: "outer-primary".into(),
            worker: "worker-primary".into(),
            reviewer: None,
            task_rules: default_routing_rules(),
        }),
    }
}

fn fallback_config_value() -> Value {
    serde_json::json!({
        "version": 1,
        "runtime": "auto",
        "policy": { "permissionMode": "auto", "ponytailMode": "full" },
        "profiles": [
            {
                "id": "outer-primary",
                "role": "outer",
                "provider": "openai",
                "transport": "codex-cli",
                "command": "codex",
                "model": null,
                "settings": { "search": true, "permissionMode": "auto" }
            },
            {
                "id": "worker-primary",
                "role": "worker",
                "provider": "anthropic",
                "transport": "claude-cli",
                "command": "claude",
                "model": null,
                "settings": { "permissionMode": "auto", "effort": "high" }
            },
            {
                "id": "fallback-freebuff",
                "role": "utility",
                "provider": "freebuff",
                "transport": "freebuff-cli",
                "command": "freebuff",
                "model": null,
                "settings": { "interactiveOnly": true, "fallbackOnly": true }
            }
        ],
        "routing": {
            "outer": "outer-primary",
            "worker": "worker-primary",
            "reviewer": null,
            "taskRules": []
        }
    })
}

fn default_routing_rules() -> Vec<TaskRoutingRule> {
    vec![
        routing_rule("conversation", "outer-primary", None, None, 1),
        routing_rule("quick", "outer-primary", None, Some("low"), 1),
        routing_rule("research", "outer-primary", None, Some("high"), 3),
        routing_rule("architecture", "outer-primary", None, Some("high"), 2),
        routing_rule("implementation", "worker-primary", None, Some("high"), 3),
        routing_rule("verification", "outer-primary", None, Some("high"), 2),
    ]
}

fn default_fallback_profile_ids() -> Vec<String> {
    vec!["fallback-freebuff".into()]
}

fn routing_rule(
    task_class: &str,
    profile_id: &str,
    model: Option<&str>,
    effort: Option<&str>,
    max_concurrency: u8,
) -> TaskRoutingRule {
    TaskRoutingRule {
        task_class: task_class.into(),
        profile_id: profile_id.into(),
        fallback_profile_ids: vec!["fallback-freebuff".into()],
        model: model.map(str::to_string),
        effort: effort.map(str::to_string),
        max_concurrency,
    }
}

fn routing_rules(config: &TandemConfig) -> Vec<TaskRoutingRule> {
    let configured = config.routing.as_ref();
    let rules = configured
        .map(|routing| routing.task_rules.as_slice())
        .unwrap_or_default();
    default_routing_rules()
        .into_iter()
        .map(|mut fallback| {
            if let Some(routing) = configured {
                // Defaults only. An explicit taskRules entry still wins below.
                fallback.profile_id = match fallback.task_class.as_str() {
                    "implementation" => routing.worker.clone(),
                    // Verification is the cross-provider review step, so it
                    // follows the configured reviewer when there is one.
                    "verification" => routing
                        .reviewer
                        .clone()
                        .unwrap_or_else(|| routing.outer.clone()),
                    _ => routing.outer.clone(),
                };
            }
            rules
                .iter()
                .find(|rule| rule.task_class == fallback.task_class)
                .cloned()
                .unwrap_or(fallback)
        })
        .collect()
}

fn validate_routing_rules(rules: &[TaskRoutingRule]) -> Result<(), String> {
    let expected = [
        "conversation",
        "quick",
        "research",
        "architecture",
        "implementation",
        "verification",
    ];
    if rules.len() != expected.len() {
        return Err("Routing settings must include each task category exactly once.".into());
    }
    for task_class in expected {
        if rules
            .iter()
            .filter(|rule| rule.task_class == task_class)
            .count()
            != 1
        {
            return Err(format!(
                "Routing settings are missing a unique {task_class} rule."
            ));
        }
    }
    if rules
        .iter()
        .any(|rule| rule.max_concurrency == 0 || rule.max_concurrency > 8)
    {
        return Err("Routing concurrency must be between 1 and 8.".into());
    }
    Ok(())
}

fn read_desktop_settings(home: &Path) -> DesktopSettings {
    let Ok(raw) = fs::read_to_string(home.join("desktop-settings.json")) else {
        return DesktopSettings::default();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn clean_command(command: Option<String>) -> Option<String> {
    command
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
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

fn read_ledger(home: &Path) -> (Vec<GoalView>, Vec<TaskView>, Vec<ExecutionRunView>) {
    let path = home.join("tandem.sqlite");
    let Ok(connection) = Connection::open_with_flags(
        path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    ) else {
        return (vec![], vec![], vec![]);
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
    let runs = read_runs_from_connection(&connection);

    (goals, tasks, runs)
}

fn read_runs_from_connection(connection: &Connection) -> Vec<ExecutionRunView> {
    connection
        .prepare(
            "SELECT id, goal_id, repo_root, objective, status, source_sha, policy_json,
                    integration_commit_sha, error, created_at, updated_at
             FROM execution_groups ORDER BY updated_at DESC LIMIT 50",
        )
        .and_then(|mut statement| {
            statement
                .query_map([], |row| {
                    let run_id: String = row.get(0)?;
                    let policy_json: String = row.get(6)?;
                    let task_ids = connection
                        .prepare(
                            "SELECT id FROM tasks WHERE execution_group_id = ?
                             ORDER BY ordinal ASC, created_at ASC",
                        )
                        .and_then(|mut task_statement| {
                            task_statement
                                .query_map([&run_id], |task_row| task_row.get::<_, String>(0))?
                                .collect()
                        })
                        .unwrap_or_default();
                    Ok(ExecutionRunView {
                        id: run_id,
                        goal_id: row.get(1)?,
                        repo_root: row.get(2)?,
                        objective: row.get(3)?,
                        status: row.get(4)?,
                        source_sha: row.get(5)?,
                        policy: serde_json::from_str(&policy_json).unwrap_or(Value::Null),
                        integration_commit_sha: row.get(7)?,
                        error: row.get(8)?,
                        created_at: row.get(9)?,
                        updated_at: row.get(10)?,
                        task_ids,
                    })
                })?
                .collect()
        })
        .unwrap_or_default()
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
            "SELECT id, goal_id, profile_id, repo_root, worktree_path, objective, status,
                    runtime, runtime_ref, worker_model, permission_mode, commit_sha, summary,
                    report_json, error, created_at, updated_at
             FROM tasks ORDER BY updated_at DESC LIMIT 100",
        )
        .and_then(|mut statement| {
            statement
                .query_map([], |row| {
                    let task_id: String = row.get(0)?;
                    let report_json: Option<String> = row.get(13)?;
                    Ok(TaskView {
                        events: read_task_events(connection, &task_id),
                        id: task_id,
                        goal_id: row.get(1)?,
                        profile_id: row.get(2)?,
                        repo_root: row.get(3)?,
                        worktree_path: row.get(4)?,
                        objective: row.get(5)?,
                        status: row.get(6)?,
                        runtime: row.get(7)?,
                        runtime_ref: row.get(8)?,
                        worker_model: row.get(9)?,
                        permission_mode: row.get(10)?,
                        commit_sha: row.get(11)?,
                        summary: row.get(12)?,
                        report: report_json
                            .and_then(|raw| serde_json::from_str::<Value>(&raw).ok()),
                        error: row.get(14)?,
                        created_at: row.get(15)?,
                        updated_at: row.get(16)?,
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
             ORDER BY id DESC LIMIT 100",
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

fn probe_command(command: &str, provider: &str) -> SubscriptionStatus {
    let executable = resolve_command(command);
    let version = executable.as_ref().and_then(|path| {
        Command::new(path)
            .arg("--version")
            .env("PATH", command_path(path))
            .stdin(Stdio::null())
            .stderr(Stdio::null())
            .output()
            .ok()
            .filter(|output| output.status.success())
            .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
    });
    let (authenticated, auth_label, error) = executable
        .as_ref()
        .map(|path| probe_authentication(path, provider))
        .unwrap_or((None, None, Some(format!("{provider} CLI was not found."))));
    SubscriptionStatus {
        command: command.into(),
        resolved_path: executable
            .as_ref()
            .map(|path| path.to_string_lossy().into_owned()),
        installed: executable.is_some(),
        version,
        authenticated,
        auth_label,
        error,
    }
}

fn resolve_command(command: &str) -> Option<PathBuf> {
    let direct = PathBuf::from(command);
    if direct.components().count() > 1 && direct.is_file() {
        return Some(direct);
    }

    if let Some(path) = resolve_from_path(command) {
        return Some(path);
    }

    let output = Command::new("/bin/zsh")
        // Finder-launched apps do not inherit interactive shell PATH entries.
        // Loading the user's interactive shell restores NVM/asdf/Homebrew setup.
        .arg("-lic")
        .arg(format!("command -v {}", shell_quote(command)))
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !path.is_empty() {
        let resolved = PathBuf::from(path);
        if resolved.is_file() {
            return Some(resolved);
        }
    }

    resolve_from_known_locations(command)
}

fn resolve_from_path(command: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;
    env::split_paths(&path)
        .map(|directory| directory.join(command))
        .find(|candidate| candidate.is_file())
}

fn resolve_from_known_locations(command: &str) -> Option<PathBuf> {
    let home = user_home();
    let direct_locations = [
        home.join(".local").join("bin").join(command),
        home.join(".cargo").join("bin").join(command),
        home.join(".bun").join("bin").join(command),
        home.join(".asdf").join("shims").join(command),
        home.join("Library").join("pnpm").join(command),
        PathBuf::from("/opt/homebrew/bin").join(command),
        PathBuf::from("/usr/local/bin").join(command),
        PathBuf::from("/Applications/ChatGPT.app/Contents/Resources").join(command),
    ];
    if let Some(found) = direct_locations
        .into_iter()
        .find(|candidate| candidate.is_file())
    {
        return Some(found);
    }

    let versions = home.join(".nvm").join("versions").join("node");
    let mut candidates = fs::read_dir(versions)
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path().join("bin").join(command))
        .filter(|candidate| candidate.is_file())
        .collect::<Vec<_>>();
    candidates.sort();
    candidates.pop()
}

fn command_path(executable: &Path) -> String {
    let mut paths = Vec::<PathBuf>::new();
    if let Some(parent) = executable.parent() {
        paths.push(parent.to_path_buf());
    }
    let home = user_home();
    paths.extend([
        home.join(".local").join("bin"),
        home.join(".cargo").join("bin"),
        home.join(".bun").join("bin"),
        home.join(".asdf").join("shims"),
        home.join("Library").join("pnpm"),
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/bin"),
        PathBuf::from("/bin"),
        PathBuf::from("/usr/sbin"),
        PathBuf::from("/sbin"),
    ]);
    if let Some(current) = env::var_os("PATH") {
        paths.extend(env::split_paths(&current));
    }
    env::join_paths(paths)
        .unwrap_or_else(|_| "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin".into())
        .to_string_lossy()
        .into_owned()
}

fn probe_authentication(
    executable: &Path,
    provider: &str,
) -> (Option<bool>, Option<String>, Option<String>) {
    let arguments: &[&str] = if provider == "codex" {
        &["login", "status"]
    } else {
        &["auth", "status"]
    };
    let output = Command::new(executable)
        .args(arguments)
        .env("PATH", command_path(executable))
        .stdin(Stdio::null())
        .stderr(Stdio::piped())
        .output();
    let Ok(output) = output else {
        return (
            None,
            None,
            Some(format!("Could not check {provider} authentication.")),
        );
    };
    if !output.status.success() {
        return (
            Some(false),
            None,
            Some(format!("{provider} needs to be connected.")),
        );
    }
    if provider == "codex" {
        let status = format!(
            "{}\n{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        let label = if status.to_lowercase().contains("chatgpt") {
            "ChatGPT subscription"
        } else {
            "Codex authenticated"
        };
        return (Some(true), Some(label.into()), None);
    }

    let value = serde_json::from_slice::<Value>(&output.stdout).ok();
    let logged_in = value
        .as_ref()
        .and_then(|json| json.get("loggedIn"))
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let subscription = value
        .as_ref()
        .and_then(|json| json.get("subscriptionType"))
        .and_then(Value::as_str)
        .map(capitalize);
    let label = subscription
        .map(|name| format!("Claude {name}"))
        .unwrap_or_else(|| "Claude authenticated".into());
    (Some(logged_in), Some(label), None)
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

fn endpoint_address(endpoint: &str) -> Option<SocketAddr> {
    endpoint.strip_prefix("ws://")?.parse().ok()
}

fn endpoint_ready(endpoint: &str) -> bool {
    endpoint_address(endpoint)
        .and_then(|address| TcpStream::connect_timeout(&address, Duration::from_millis(150)).ok())
        .is_some()
}

fn wait_for_endpoint(endpoint: &str, child: &mut Child, timeout: Duration) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    loop {
        if endpoint_ready(endpoint) {
            return Ok(());
        }
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("Could not inspect Codex app-server: {error}"))?
        {
            return Err(format!(
                "Codex app-server exited before it became ready ({status})."
            ));
        }
        if Instant::now() >= deadline {
            return Err("Codex app-server did not become ready within 12 seconds.".into());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

fn recent_log_hint(path: &Path) -> String {
    if path.exists() {
        format!("Details are available in {}.", path.display())
    } else {
        "No Codex app-server log was created.".into()
    }
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

fn isolate_process_group(command: &mut Command) {
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
}

fn terminate_child_tree(child: &mut Child) {
    signal_child_tree(child, false);
    for _ in 0..20 {
        let child_exited = child.try_wait().ok().flatten().is_some();
        if child_exited && !child_tree_alive(child.id()) {
            return;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    signal_child_tree(child, true);
    let _ = child.wait();
}

fn signal_child_tree(child: &mut Child, force: bool) {
    #[cfg(unix)]
    unsafe {
        let signal = if force { libc::SIGKILL } else { libc::SIGTERM };
        // Every Codex launcher is placed in its own process group. Signaling the
        // negative group ID reaches the Node launcher, native Codex binary, and
        // MCP descendants without touching Tandem itself.
        let _ = libc::kill(-(child.id() as i32), signal);
    }
    #[cfg(not(unix))]
    {
        let _ = child.kill();
    }
}

fn child_tree_alive(child_id: u32) -> bool {
    #[cfg(unix)]
    unsafe {
        if libc::kill(-(child_id as i32), 0) == 0 {
            return true;
        }
        std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
    }
    #[cfg(not(unix))]
    {
        let _ = child_id;
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_complete_provider_neutral_routing_matrix() {
        let mut rules = default_routing_rules();
        assert!(validate_routing_rules(&rules).is_ok());

        rules[0].max_concurrency = 0;
        assert_eq!(
            validate_routing_rules(&rules).unwrap_err(),
            "Routing concurrency must be between 1 and 8."
        );

        let mut missing = default_routing_rules();
        missing.pop();
        assert_eq!(
            validate_routing_rules(&missing).unwrap_err(),
            "Routing settings must include each task category exactly once."
        );
    }

    #[cfg(unix)]
    #[test]
    fn terminates_descendant_listener_after_launcher_exits() {
        let reserved = TcpListener::bind("127.0.0.1:0").expect("reserve test port");
        let port = reserved.local_addr().expect("read test port").port();
        drop(reserved);

        let mut command = Command::new("/bin/sh");
        command.arg("-c").arg(format!(
            "trap '' HUP; /usr/bin/nc -lk 127.0.0.1 {port} >/dev/null 2>&1 &"
        ));
        isolate_process_group(&mut command);
        let mut child = command.spawn().expect("spawn launcher and descendant");
        let endpoint = format!("ws://127.0.0.1:{port}");
        let deadline = Instant::now() + Duration::from_secs(3);
        let mut ready = false;
        while !ready && Instant::now() < deadline {
            ready = endpoint_ready(&endpoint);
            if ready {
                break;
            }
            std::thread::sleep(Duration::from_millis(25));
        }
        assert!(ready, "descendant listener became ready");
        assert!(
            child.wait().expect("launcher exited").success(),
            "launcher should exit before its descendant"
        );
        assert!(
            child_tree_alive(child.id()),
            "descendant should outlive its launcher before cleanup"
        );

        terminate_child_tree(&mut child);
        assert!(
            !child_tree_alive(child.id()),
            "descendant process group survived launcher termination"
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_websocket::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            desktop_bootstrap,
            desktop_benchmark_add,
            desktop_benchmark_create,
            desktop_benchmark_score,
            desktop_benchmarks,
            desktop_goal_create,
            desktop_goal_update,
            desktop_task_cancel,
            desktop_task_files,
            desktop_task_steer,
            desktop_tasks,
            desktop_runs,
            open_local_file,
            open_project_terminal,
            open_provider_login,
            preview_local_file,
            reveal_connection_log,
            save_desktop_settings,
            save_routing_settings,
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
