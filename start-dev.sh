#!/usr/bin/env bash

set -euo pipefail

# ============================================================
# Lexora - Development Environment Manager
# Compatible with macOS (Bash 3.2+) and Linux
# ============================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="$ROOT_DIR/.logs"

BACKEND_VENV="$BACKEND_DIR/.venv"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

PIP_TIMEOUT="${PIP_TIMEOUT:-120}"
PIP_RETRIES="${PIP_RETRIES:-8}"
NPM_FETCH_TIMEOUT="${NPM_FETCH_TIMEOUT:-120000}"
NPM_FETCH_RETRIES="${NPM_FETCH_RETRIES:-8}"

CHECK_ONLY=false
NO_INSTALL=false
COMPILED=false
FORCE_INSTALL=false

BACKEND_PID=""
FRONTEND_PID=""
CLEANING_UP=false

# ============================================================
# CLI Arguments
# ============================================================

usage() {
  cat <<'EOF'
Lexora Development Startup Manager

Usage:
  ./start-dev.sh [OPTIONS]

Options:
  --check-only      Validate project without changing files
  --no-install      Skip dependency installation
  --compiled        Build and run production frontend
  --force-install   Force dependency installation
  --help, -h        Show this help

Environment variables:
  BACKEND_PORT      Backend port (default: 8000)
  FRONTEND_PORT     Frontend port (default: 3000)
  PIP_TIMEOUT       Pip timeout in seconds (default: 120)
  PIP_RETRIES       Pip retries (default: 8)
  NPM_FETCH_TIMEOUT npm fetch timeout in milliseconds (default: 120000)
  NPM_FETCH_RETRIES npm fetch retries (default: 8)

Examples:
  ./start-dev.sh
  ./start-dev.sh --compiled
  ./start-dev.sh --no-install
  ./start-dev.sh --force-install
  BACKEND_PORT=9000 ./start-dev.sh
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check-only)
      CHECK_ONLY=true
      ;;
    --no-install)
      NO_INSTALL=true
      ;;
    --compiled)
      COMPILED=true
      ;;
    --force-install)
      FORCE_INSTALL=true
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

# ============================================================
# Logging
# ============================================================

info() {
  printf '\033[1;34m[lexora]\033[0m %s\n' "$*"
}

success() {
  printf '\033[1;32m[lexora] ✓\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[lexora] !\033[0m %s\n' "$*"
}

fail() {
  printf '\033[1;31m[lexora] ERROR:\033[0m %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 ||
    fail "Missing required command: $1"
}

# ============================================================
# Process Helpers (Zombie-Safe & Tree-Aware)
# ============================================================

is_pid_alive() {
  local pid="$1"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1

  local state
  state="$(ps -o state= -p "$pid" 2>/dev/null | tr -d '[:space:]')"
  [[ -n "$state" && "${state:0:1}" != "Z" ]]
}

get_descendant_pids() {
  local parent="$1"
  local children
  children="$(ps -eo pid=,ppid= 2>/dev/null | awk -v p="$parent" '$2 == p {print $1}')"

  local child
  for child in $children; do
    get_descendant_pids "$child"
    printf '%s\n' "$child"
  done
}

terminate_process_tree() {
  local root_pid="$1"
  local label="$2"

  [[ -n "$root_pid" ]] || return 0

  # Collect descendants bottom-up before sending signals so PPID links are intact
  local all_pids
  all_pids="$(
    {
      get_descendant_pids "$root_pid"
      printf '%s\n' "$root_pid"
    } | awk '!seen[$0]++'
  )"

  local any_alive=false
  local pid
  for pid in $all_pids; do
    if is_pid_alive "$pid"; then
      any_alive=true
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done

  if [[ "$any_alive" == false ]]; then
    wait "$root_pid" 2>/dev/null || true
    return 0
  fi

  # Wait up to 5 seconds (50 x 0.1s) for graceful exit
  local attempt
  for ((attempt=1; attempt<=50; attempt++)); do
    local still_running=false
    for pid in $all_pids; do
      if is_pid_alive "$pid"; then
        still_running=true
        break
      fi
    done

    if [[ "$still_running" == false ]]; then
      wait "$root_pid" 2>/dev/null || true
      return 0
    fi

    sleep 0.1
  done

  # Escalate to SIGKILL for stubborn processes
  warn "$label did not exit gracefully; forcing stop..."
  for pid in $all_pids; do
    if is_pid_alive "$pid"; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done

  wait "$root_pid" 2>/dev/null || true
}

# ============================================================
# Cross-platform SHA-256
# ============================================================

hash_file() {
  local file="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    fail "Missing SHA-256 utility (sha256sum or shasum)"
  fi
}

# ============================================================
# Node Version Management
# ============================================================

load_nvm_if_available() {
  if [[ -n "${NVM_DIR:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
  elif [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
  fi

  if [[ -f "$ROOT_DIR/.nvmrc" ]] && command -v nvm >/dev/null 2>&1; then
    info "Loading Node version from .nvmrc"
    nvm use || fail "Required Node version unavailable. Run: nvm install"
  fi
}

# ============================================================
# Project Structure
# ============================================================

setup_directories() {
  info "Preparing project directories..."

  mkdir -p "$BACKEND_DIR"
  mkdir -p "$FRONTEND_DIR"
  mkdir -p "$LOG_DIR"

  mkdir -p "$BACKEND_DIR/app"
  mkdir -p "$BACKEND_DIR/uploads"
  mkdir -p "$BACKEND_DIR/data"
  mkdir -p "$BACKEND_DIR/tmp"

  mkdir -p "$FRONTEND_DIR/public"

  touch "$BACKEND_LOG"
  touch "$FRONTEND_LOG"

  success "Project directories ready"
}

# ============================================================
# Environment Files
# ============================================================

setup_env_file() {
  local directory="$1"
  local name="$2"
  local env_file="$directory/.env"

  if [[ "$name" == "Frontend" && -f "$directory/.env.local" ]]; then
    success "Frontend .env.local found"
    return
  fi

  if [[ -f "$env_file" ]]; then
    success "$name .env found"
    return
  fi

  if [[ -f "$directory/.env.example" ]]; then
    cp "$directory/.env.example" "$env_file"
    warn "$name .env created from .env.example"
  elif [[ -f "$directory/.env.template" ]]; then
    cp "$directory/.env.template" "$env_file"
    warn "$name .env created from .env.template"
  else
    touch "$env_file"
    warn "$name .env created empty"
    warn "Configure required environment variables before use"
  fi

  chmod 600 "$env_file"
}

setup_environment() {
  info "Checking environment configuration..."

  setup_env_file "$BACKEND_DIR" "Backend"
  setup_env_file "$FRONTEND_DIR" "Frontend"
}

# ============================================================
# Project Validation
# ============================================================

validate_project() {
  info "Validating project files..."

  [[ -f "$BACKEND_DIR/requirements.txt" ]] ||
    fail "Missing backend/requirements.txt"

  [[ -f "$BACKEND_DIR/app/main.py" ]] ||
    fail "Missing backend/app/main.py"

  [[ -f "$FRONTEND_DIR/package.json" ]] ||
    fail "Missing frontend/package.json"

  success "Project validation passed"
}

# ============================================================
# Python Virtual Environment
# ============================================================

setup_backend_venv() {
  info "Checking Python virtual environment..."

  if [[ -x "$BACKEND_VENV/bin/python" ]] && [[ -x "$BACKEND_VENV/bin/pip" ]]; then
    success "Existing Python virtual environment found"
    return
  fi

  if [[ -d "$BACKEND_VENV" ]]; then
    warn "Incomplete virtual environment detected"
    warn "Recreating backend virtual environment"
    rm -rf "$BACKEND_VENV"
  fi

  info "Creating Python virtual environment..."

  python3 -m venv "$BACKEND_VENV" ||
    fail "Unable to create Python virtual environment"

  success "Python virtual environment created"
}

# ============================================================
# Backend Dependencies
# ============================================================

install_backend_dependencies() {
  if [[ "$NO_INSTALL" == true ]]; then
    warn "Skipping backend dependency installation"
    return
  fi

  local requirements="$BACKEND_DIR/requirements.txt"
  local marker="$BACKEND_VENV/.requirements.sha256"
  local current_hash

  current_hash="$(hash_file "$requirements")"

  if [[ "$FORCE_INSTALL" == false ]] &&
     [[ -f "$marker" ]] &&
     [[ "$(cat "$marker")" == "$current_hash" ]]; then
    success "Backend dependencies already installed"
    return
  fi

  info "Installing Python dependencies..."
  info "PyPI timeout: ${PIP_TIMEOUT}s"
  info "PyPI retries: $PIP_RETRIES"

  if ! "$BACKEND_VENV/bin/python" -m pip install \
    --timeout "$PIP_TIMEOUT" \
    --retries "$PIP_RETRIES" \
    --disable-pip-version-check \
    -r "$requirements"; then
    warn "Python dependency installation failed"
    warn "Check internet connection or PyPI accessibility"
    fail "Could not install backend dependencies"
  fi

  printf '%s\n' "$current_hash" > "$marker"
  success "Backend dependencies installed"
}

# ============================================================
# Frontend Dependencies
# ============================================================

install_frontend_dependencies() {
  if [[ "$NO_INSTALL" == true ]]; then
    warn "Skipping frontend dependency installation"
    return
  fi

  local package_file="$FRONTEND_DIR/package.json"
  local lock_file="$FRONTEND_DIR/package-lock.json"
  local marker="$FRONTEND_DIR/node_modules/.lexora-deps.sha256"
  local current_hash

  if [[ -f "$lock_file" ]]; then
    current_hash="$(hash_file "$lock_file")"
  else
    current_hash="$(hash_file "$package_file")"
  fi

  if [[ "$FORCE_INSTALL" == false ]] &&
     [[ -d "$FRONTEND_DIR/node_modules" ]] &&
     [[ -f "$marker" ]] &&
     [[ "$(cat "$marker")" == "$current_hash" ]]; then
    success "Frontend dependencies already installed"
    return
  fi

  info "Installing frontend dependencies..."

  if [[ -f "$lock_file" ]]; then
    (
      cd "$FRONTEND_DIR"
      npm ci \
        --fetch-timeout "$NPM_FETCH_TIMEOUT" \
        --fetch-retries "$NPM_FETCH_RETRIES"
    ) || fail "npm ci failed"
  else
    (
      cd "$FRONTEND_DIR"
      npm install \
        --fetch-timeout "$NPM_FETCH_TIMEOUT" \
        --fetch-retries "$NPM_FETCH_RETRIES"
    ) || fail "npm install failed"
  fi

  mkdir -p "$FRONTEND_DIR/node_modules"

  if [[ -f "$lock_file" ]]; then
    current_hash="$(hash_file "$lock_file")"
  else
    current_hash="$(hash_file "$package_file")"
  fi

  printf '%s\n' "$current_hash" > "$marker"
  success "Frontend dependencies installed"
}

# ============================================================
# Frontend Production Build
# ============================================================

build_frontend() {
  if [[ "$COMPILED" != true ]]; then
    return
  fi

  info "Compiling frontend..."

  (
    cd "$FRONTEND_DIR"
    npm run build
  ) || fail "Frontend compilation failed"

  success "Frontend production build complete"
}

# ============================================================
# Port Availability
# ============================================================

port_in_use() {
  local port="$1"

  python3 - "$port" <<'PY'
import errno
import socket
import sys

port = int(sys.argv[1])

# 1. Check active listeners via connect_ex (avoids TIME_WAIT false positives)
for family, address in [
    (socket.AF_INET, ("127.0.0.1", port)),
    (socket.AF_INET6, ("::1", port)),
]:
    try:
        with socket.socket(family, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.2)
            if sock.connect_ex(address) == 0:
                sys.exit(0)
    except OSError:
        pass

# 2. Check wildcard bind with SO_REUSEADDR to detect non-loopback listeners
for family, address in [
    (socket.AF_INET, ("0.0.0.0", port)),
    (socket.AF_INET6, ("::", port)),
]:
    try:
        with socket.socket(family, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            if family == socket.AF_INET6:
                sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
            sock.bind(address)
    except OSError as exc:
        if family == socket.AF_INET6 and exc.errno in (
            getattr(errno, "EAFNOSUPPORT", -1),
            getattr(errno, "EADDRNOTAVAIL", -1),
        ):
            continue
        sys.exit(0)

sys.exit(1)
PY
}

describe_port_holder() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {printf " (PID %s: %s)", $2, $1}'
  fi
}

check_ports() {
  [[ "$BACKEND_PORT" =~ ^[0-9]+$ ]] ||
    fail "BACKEND_PORT must be a number"

  [[ "$FRONTEND_PORT" =~ ^[0-9]+$ ]] ||
    fail "FRONTEND_PORT must be a number"

  (( BACKEND_PORT >= 1 && BACKEND_PORT <= 65535 )) ||
    fail "Invalid backend port"

  (( FRONTEND_PORT >= 1 && FRONTEND_PORT <= 65535 )) ||
    fail "Invalid frontend port"

  [[ "$BACKEND_PORT" != "$FRONTEND_PORT" ]] ||
    fail "Backend and frontend ports must be different"

  if port_in_use "$BACKEND_PORT"; then
    fail "Backend port $BACKEND_PORT already in use$(describe_port_holder "$BACKEND_PORT")"
  fi

  if port_in_use "$FRONTEND_PORT"; then
    fail "Frontend port $FRONTEND_PORT already in use$(describe_port_holder "$FRONTEND_PORT")"
  fi

  success "Required ports are available"
}

# ============================================================
# Health Check
# ============================================================

wait_for_http() {
  local url="$1"
  local name="$2"
  local pid="$3"
  local retries="${4:-45}"
  local i

  for ((i=1; i<=retries; i++)); do
    if curl -fsS \
      --connect-timeout 2 \
      --max-time 3 \
      "$url" >/dev/null 2>&1; then
      success "$name is ready at $url"
      return 0
    fi

    if ! is_pid_alive "$pid"; then
      wait "$pid" 2>/dev/null || true
      warn "$name process exited unexpectedly"
      return 1
    fi

    sleep 1
  done

  return 1
}

# ============================================================
# Backend Startup
# ============================================================

start_backend() {
  info "Starting backend on port $BACKEND_PORT..."

  (
    cd "$BACKEND_DIR"

    exec "$BACKEND_VENV/bin/python" -m uvicorn \
      app.main:app \
      --host 0.0.0.0 \
      --port "$BACKEND_PORT" \
      > "$BACKEND_LOG" 2>&1
  ) &

  BACKEND_PID=$!

  if ! wait_for_http \
    "http://127.0.0.1:${BACKEND_PORT}/health" \
    "Backend" \
    "$BACKEND_PID" \
    45; then
    warn "Backend startup failed. Recent logs:"
    tail -n 60 "$BACKEND_LOG" || true
    fail "Backend could not start"
  fi
}

# ============================================================
# Frontend Startup
# ============================================================

start_frontend() {
  info "Starting frontend on port $FRONTEND_PORT..."

  (
    cd "$FRONTEND_DIR"

    if [[ "$COMPILED" == true ]]; then
      exec npm run start -- \
        --port "$FRONTEND_PORT" \
        > "$FRONTEND_LOG" 2>&1
    else
      exec npm run dev -- \
        --port "$FRONTEND_PORT" \
        > "$FRONTEND_LOG" 2>&1
    fi
  ) &

  FRONTEND_PID=$!

  if ! wait_for_http \
    "http://127.0.0.1:${FRONTEND_PORT}" \
    "Frontend" \
    "$FRONTEND_PID" \
    75; then
    warn "Frontend startup failed. Recent logs:"
    tail -n 60 "$FRONTEND_LOG" || true
    fail "Frontend could not start"
  fi
}

# ============================================================
# Cleanup
# ============================================================

cleanup() {
  local exit_code=$?

  if [[ "$CLEANING_UP" == true ]]; then
    return
  fi
  CLEANING_UP=true

  trap - EXIT INT TERM
  set +e

  echo
  info "Shutting down Lexora..."

  terminate_process_tree "$FRONTEND_PID" "Frontend"
  terminate_process_tree "$BACKEND_PID" "Backend"

  success "Lexora shutdown complete"
  exit "$exit_code"
}

# ============================================================
# Service Monitoring (Bash 3.2 compatible)
# ============================================================

monitor_services() {
  while true; do
    if ! is_pid_alive "$BACKEND_PID"; then
      wait "$BACKEND_PID" 2>/dev/null || true
      warn "Backend process stopped"
      break
    fi

    if ! is_pid_alive "$FRONTEND_PID"; then
      wait "$FRONTEND_PID" 2>/dev/null || true
      warn "Frontend process stopped"
      break
    fi

    # Background sleep + wait allows SIGINT/SIGTERM to interrupt immediately
    sleep 2 &
    wait $! 2>/dev/null || true
  done

  warn "A service exited. Stopping remaining services."
  return 1
}

# ============================================================
# Main
# ============================================================

main() {
  echo
  info "======================================"
  info "       Lexora Startup Manager"
  info "======================================"
  echo

  require_command python3
  require_command curl

  load_nvm_if_available

  require_command node
  require_command npm

  if [[ "$CHECK_ONLY" == true ]]; then
    validate_project
    check_ports
    success "All checks passed"
    return 0
  fi

  # 1. Prepare project directories
  setup_directories

  # 2. Configure environment files
  setup_environment

  # 3. Validate source files
  validate_project

  # 4. Check ports
  check_ports

  # 5. Create Python virtual environment
  setup_backend_venv

  # 6. Install dependencies if needed
  install_backend_dependencies
  install_frontend_dependencies

  # 7. Build frontend (optional)
  build_frontend

  # 8. Register cleanup handlers before starting background services
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  # 9. Start backend
  start_backend

  # 10. Start frontend
  start_frontend

  echo
  success "======================================"
  success "        Lexora is running!"
  success "======================================"
  echo

  info "Frontend: http://localhost:$FRONTEND_PORT"
  info "Backend:  http://localhost:$BACKEND_PORT"
  info "API Docs: http://localhost:$BACKEND_PORT/docs"

  echo
  info "Log files:"
  info "  Backend:  $BACKEND_LOG"
  info "  Frontend: $FRONTEND_LOG"

  echo
  info "Press Ctrl+C to stop Lexora"
  echo

  # 11. Keep services monitored
  monitor_services
}

main "$@"