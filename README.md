# Open OnDemand RStudio Server App (Apptainer) - Moffitt HPC

This repository contains the necessary files to deploy an RStudio Server application within an Apptainer container on an Open OnDemand (OOD) platform, specifically customized for the Moffitt HPC environment. This setup provides a consistent and reproducible environment for R development.

**Important:** This app is highly customized for the Moffitt HPC environment and may require modifications for other systems.

## Features

* **Containerized Environment:** RStudio Server runs inside an Apptainer container using Docker images from `dockerhub.moffitt.org/ood/rocker-multi`
* **Version Selection:** Choose between multiple R/RStudio versions including Latest, Latest-ML, and specific versions
* **GPU Support:** Optional NVIDIA A30 GPU allocation via checkbox selection
* **Conda Environment Integration:** Optional conda environment binding for custom R/Python packages
* **Persistent State:** RStudio Server state persists across sessions via bind mounts
* **Custom Authentication:** PAM-based authentication for secure user login
* **Advanced Options:** QoS tier selection, conda environment, and reservation support available via toggle

## Prerequisites

* Open OnDemand installation (version 2.0+)
* Apptainer/Singularity installed on compute nodes
* Access to `dockerhub.moffitt.org/ood/rocker-multi` container images
* Slurm job scheduler
* Shared filesystem accessible from compute nodes
* PAM configuration on compute nodes

## Form Fields

### Basic Options

* **Request GPU:** Checkbox to request 1 NVIDIA A30 GPU
* **Cores:** Number of CPU cores (default: 1)
* **Memory (GB):** Memory allocation in GB (default: 2)
* **Runtime (hours):** Job walltime in hours (1-336, default: 1)
* **Nodes:** Number of nodes (default: 1)
* **Partition:** Slurm partition (default: red)
* **R/RStudio Version:** Select from available versions
  - Latest-ML: ML-optimized with GPU support
  - Latest: Standard latest build
  - Latest-modified: Latest with additional packages
  - Specific versions (4.4.3, 4.4.2, 4.4.1)

### Advanced Options (Hidden by default)

* **Show Advanced Options:** Checkbox to reveal advanced settings
* **QoS:** Quality of Service tier (default: normal)
* **Conda Environment:** Optional conda environment name to bind into container
* **Reservation:** Optional Slurm reservation name

## Installation

1. **Copy the app directory:**

    ```bash
    # For system-wide deployment
    sudo cp -r rstudio /var/www/ood/apps/sys/
    # OR
    cp -r rstudio-apptainer ~/ood/apps/dev/
    ```

3.  **Configure the App:**

    Edit the `manifest.yml`, `form.yml`, `submit.yml.erb`, and `view.html.erb` files in the `rstudio-apptainer` directory. Pay close attention to the following settings:

    *   `title`: The name of the app as it will appear in the OOD dashboard.
    *   `description`: A brief description of the app.
    *   `icon`: Path to an icon for the app.
    *   `form`: Defines the form fields that users will see when launching the app (e.g., CPU cores, memory, wall time, R version). **Ensure that the `r_version` field in the form matches the available tags in the `dockerhub.moffitt.org/hpc/rocker-rstudio` Docker image.**

    Edit the `template/script.sh.erb` file. This script is executed on the compute node to start the RStudio Server instance. This script is heavily customized for the Moffitt HPC environment. **Carefully review and understand the script before deploying.**

    **Key Configuration Details in `template/script.sh.erb`:**

    *   **Docker Image:** The script uses the `dockerhub.moffitt.org/hpc/rocker-rstudio:$R_VERSION` Docker image.
    *   **Authentication:** The script uses a PAM-based authentication helper script (`bin/auth`) located at `${BIN_DIR}/auth`. It's invoked using the `--auth-pam-helper-path` option of `rserver`. Authentication is enabled with `--auth-none 0` and password encryption is disabled with `--auth-encrypt-password 0`.
    *   **Bind Mounts:** The script defines bind mounts to redirect system directories within the container to user-level locations, ensuring persistent state and proper logging. These are passed to `apptainer exec` using the `-B` option.  The key bind mounts are:
        *   `${RSTUDIO_ETC}/database.conf:/etc/rstudio/database.conf`
        *   `${RSTUDIO_ETC}/logging.conf:/etc/rstudio/logging.conf`
        *   `${RSTUDIO_VAR_LOG}:/var/log/rstudio`
        *   `${RSTUDIO_VAR_LIB}:/var/lib/rstudio-server`
        *   `${RSTUDIO_VAR_RUN}:/run/rstudio-server`
        *   `${TMP_DIR}:/tmp`
    *   **Temporary Directory:** A unique temporary directory (`${TMP_DIR}`) is created for each session and used for RStudio Server's data directory and secure cookie key file using the `--server-data-dir` and `--secure-cookie-key-file` options of `rserver`.
    *   **Rsession Wrapper:** The script creates a wrapper script (`${BIN_DIR}/rsession.sh`) to set up the environment for R sessions launched from within RStudio Server. This wrapper sets environment variables like `TZ`, `HOME`, `R_LIBS_SITE`, and `OMP_NUM_THREADS`.
    *   **Apptainer Execution:** The script uses `apptainer exec` to run the RStudio Server within the container.
    *   **Configuration Files:** The script creates and configures `logging.conf` and `database.conf` in `${RSTUDIO_ETC}`.

4.  **Configure R Version Selection (OOD Form):**

    The `script.sh.erb` file uses the `R_VERSION` variable to select the appropriate Docker image tag. You need to configure the OOD form to allow users to select the R version. Edit the `manifest.yml` file and add a form field for `r_version`. For example:

    ```yaml
    form:
      - r_version:
          widget: select
          label: R Version
          help: Select the R version to use.
          options:
            - "4.2.3"
            - "4.3.2"
            - "latest"
    ```

    **Important:** The options in the `options` list must match the available tags in the `dockerhub.moffitt.org/hpc/rocker-rstudio` Docker image.

5.  **Create a "Connect" App (Optional, but Recommended):**

    To make it easier for users to connect to the RStudio Server instance, create a separate OOD app that provides a link to the running RStudio Server. This app would:

    *   Read the `port` from the job's standard output (passed via the `--www-port` option).
    *   Construct the URL to the RStudio Server instance (e.g., `http://<node_name>:<port>`).
    *   Display the URL to the user.

    This "connect" app is beyond the scope of this README, but there are examples available in the Open OnDemand documentation and community forums.

## Building the Apptainer Image (If Customization is Needed)

If you need to customize the R environment, you can build your own Apptainer image based on the `dockerhub.moffitt.org/hpc/rocker-rstudio` image. Here's an example `Singularity` file:

```singularity
Bootstrap: docker
From: dockerhub.moffitt.org/hpc/rocker-rstudio:latest

%post
    # Install any additional R packages
    R -e "install.packages(c('tidyverse', 'shiny', 'ggplot2'))"

    # Install system dependencies (if needed)
    apt-get update && apt-get install -y --no-install-recommends \
        libxml2-dev \
        libcurl4-openssl-dev

%environment
    # Set environment variables
    export R_LIBS_USER="/opt/R/library"

%runscript
    # Start RStudio Server
    exec /usr/lib/rstudio-server/bin/rserver --www-port 8787 --www-address=0.0.0.0
