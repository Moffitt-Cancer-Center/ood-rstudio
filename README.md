# OOD RStudio Server App (Apptainer) — Moffitt Cancer Center HPC

An [Open OnDemand](https://openondemand.org/) batch-connect app that launches RStudio Server inside an Apptainer container on Moffitt's Red cluster (Slurm). Users select a container image, allocate resources, and get a one-click auto-login directly into a running RStudio session.

> **Note:** This app is customized for the Moffitt HPC environment and may require adaptation for other sites.

---

## How It Works

1. The user fills out the OOD launch form (image, CPUs, memory, GPUs, wall time, QoS).
2. OOD submits a Slurm job to the `red` queue.
3. The job script (`template/script.sh.erb`):
   - Creates session-specific directories for RStudio state, logs, and a temp dir.
   - Generates a random 16-character password and writes it to `$TMP_DIR/rstudio-server/rstudio-passwd` (mode `0600`), which is bind-mounted to `/tmp` inside the container.
   - Writes `rsession.sh` and `auth` helper scripts into the session's `bin/` directory.
   - Pulls and executes the selected container image via `apptainer exec`.
   - Starts `rserver` with the custom PAM auth helper and session-specific bind mounts.
4. OOD's `view.html.erb` sets a CSRF cookie and auto-submits a login form to `/auth-do-sign-in`, signing the user in without manual password entry.

---

## Container Images

Images are selected via the `r_version` form field. The mapping is:

| Form Label | Image |
|---|---|
| Moffitt-ML | `dockerhub.moffitt.org/ood/rocker-multi:latest` |
| Moffitt-modified | `dockerhub.moffitt.org/ood/rocker-rstudio-modified:latest` |
| Rocker-tidyverse | `docker://rocker/tidyverse:latest` |
| Rocker-shiny-verse | `docker://rocker/shiny-verse:latest` |
| Rocker-r-ver | `docker://rocker/r-ver:latest` |
| Rocker-r-base | `docker://rocker/r-base:latest` |
| Rocker-geospatial | `docker://rocker/geospatial:latest` |
| Rocker-shiny | `docker://rocker/shiny:latest` |
| Rocker-rstudio-stable | `docker://rocker/rstudio-stable:latest` |
| Rocker-verse | `docker://rocker/verse:latest` |
| Rocker-binder | `docker://rocker/binder:latest` |
| Rocker-cuda | `docker://rocker/cuda:latest` |
| Rocker-r2u | `docker://rocker/r2u:latest` |
| Rocker-ml-verse | `docker://rocker/ml-verse:latest` |
| Rocker-ropensci | `docker://rocker/ropensci:latest` |
| Rocker-ml (GPU) | `docker://rocker/ml:latest` |

**First launch note:** If Apptainer needs to pull and convert a Docker image, the initial startup can take up to 5 minutes. Progress is visible in the session's `output.log`.

---

## Authentication

RStudio Server is started with `--auth-none 0` and `--auth-pam-helper-path` pointing to `template/bin/auth`. This custom PAM helper:

1. Reads the session password from `/tmp/rstudio-server/rstudio-passwd` inside the container (the file written by `script.sh.erb`).
2. Falls back to the `RSTUDIO_PASSWORD` environment variable if the file is not present.
3. Compares the resolved password against what the user typed on the RStudio login screen.

This two-source approach ensures compatibility across all supported images. Moffitt images (older rserver build) work via env var; stock Rocker images (newer rserver that strips env vars from PAM subprocesses) work via the password file.

The OOD `view.html.erb` auto-submits the login form using the generated password, so users normally never see the login screen.

---

## File Structure

```
├── manifest.yml          # OOD app metadata (name, category, role)
├── form.yml              # Launch form definition (image, CPUs, memory, GPU, QoS, etc.)
├── submit.yml.erb        # Slurm submission parameters
├── view.html.erb         # Auto-login connect button (sets CSRF cookie + POST to /auth-do-sign-in)
└── template/
    ├── before.sh.erb     # Pre-job setup: port discovery, password generation, CSRF token
    ├── script.sh.erb     # Main job script: directory setup, bind mounts, apptainer exec
    ├── after.sh.erb      # Post-job: waits for RStudio port to become available
    └── bin/
        └── auth          # Custom PAM helper: validates username/password inside container
```

---

## Key Bind Mounts

`TMP_DIR` is a per-session `mktemp -d` directory. All bind mounts keep system-level RStudio paths pointing to user-writable locations:

| Host path | Container path | Purpose |
|---|---|---|
| `~/.local/share/rstudio_server/etc/database.conf` | `/etc/rstudio/database.conf` | SQLite DB config |
| `~/.local/share/rstudio_server/etc/logging.conf` | `/etc/rstudio/logging.conf` | Log level/destination |
| `<session_log_dir>` | `/var/log/rstudio` | RStudio log output |
| `~/.local/share/rstudio_server/var/lib` | `/var/lib/rstudio-server` | Persistent server state |
| `<session_dir>/var/run` | `/run/rstudio-server` | PID file |
| `~/.local/share/rstudio_server/opt/share` | `/opt/share` | Shared R libs |
| `TMP_DIR` | `/tmp` | Temp files + password file |

RStudio user state (`~/.local/share/rstudio`) persists naturally via the shared home filesystem and is not explicitly bind-mounted.

---

## Persistent State

RStudio user preferences, project history, and installed packages in `~/.local/share/rstudio` persist across sessions automatically because the user's home directory is available on all compute nodes.

Server-level state (database, logs, lib) is stored in `~/.local/share/rstudio_server` and is likewise persistent.

---

## Cluster / Queue Configuration

Jobs are submitted to the `red` queue on the `slurm` cluster. Available QoS levels:

| QoS | Max CPUs | Max wall time |
|---|---|---|
| normal | 64 | 12 hrs |
| partsmall | 250 | 90 days |
| small | 475 | 90 days |
| medium | 950 | 45 days |
| large | 1425 | 1 day |
| xlarge | 1800 | 4 hrs |
| xxlarge | 3000 | 12 hrs |

---

## Installation

```bash
git clone git@github.com:Moffitt-Cancer-Center/ood-rstudio.git

# Deploy to system apps:
sudo cp -r ood-rstudio /var/www/ood/apps/sys/rstudio

# OR deploy to your dev sandbox:
cp -r ood-rstudio ~/ondemand/dev/rstudio
```

Restart the OOD passenger app or reload nginx as appropriate for your site.

---

## Prerequisites

- Open OnDemand >= 3.x
- Apptainer installed and accessible on compute nodes
- Slurm scheduler with the `red` partition and configured QoS levels
- Moffitt internal Docker registry (`dockerhub.moffitt.org`) reachable from compute nodes for Moffitt images; internet access or a local proxy for public Rocker images
- Shared home filesystem mounted on all compute nodes
