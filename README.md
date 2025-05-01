# Open OnDemand RStudio Server App (Apptainer) - Moffitt HPC Customization

This repository contains the necessary files to deploy an RStudio Server application within an Apptainer container on an Open OnDemand (OOD) platform, specifically customized for the Moffitt HPC environment. This setup provides a consistent and reproducible environment for R development, ensuring that users have access to the required R packages and dependencies without needing to manage them directly on the shared OOD system. This implementation includes specific configurations for authentication, logging, and persistent state management tailored to this environment.

**Important:** This README and the associated scripts are highly customized for the Moffitt HPC environment. They may not be directly applicable to other systems without significant modification.

## Features

*   **Containerized Environment:** RStudio Server runs inside an Apptainer container, isolating it from the host system and ensuring consistent behavior. Uses a specific Docker image from Docker Hub.
*   **Reproducibility:** The Apptainer container image encapsulates the entire R environment, including R version, installed packages, and system libraries, making it easy to reproduce results.
*   **Simplified Dependency Management:** Users don't need to install R packages or manage dependencies on the OOD system. All dependencies are pre-installed within the container.
*   **Easy Deployment:** The provided OOD app simplifies the deployment and management of the RStudio Server application.
*   **Custom Authentication:** Uses a PAM-based authentication helper script for secure user login.
*   **Persistent State:** RStudio Server state (e.g., project settings, package installations) is persisted across sessions using bind mounts to the user's home directory.
*   **Custom Logging:** Configured for detailed logging to a session-specific directory.
*   **Temporary Directory Management:** Uses a unique temporary directory for each session.
*   **R Version Control:** Allows specifying the R version via the OOD form.

## Prerequisites

*   **Open OnDemand Installation:** You must have a working Open OnDemand installation.
*   **Apptainer Installation:** Apptainer (Singularity) must be installed and configured on your OOD system.
*   **Docker Image:** The system relies on a specific Docker image: `dockerhub.moffitt.org/hpc/rocker-rstudio`. Ensure this image is accessible to your Apptainer installation. Contact your HPC administrator if you have questions about image availability.
*   **PAM Configuration:** The system uses PAM for authentication. Ensure that PAM is configured correctly on the compute nodes.
*   **Shared Filesystem:** Users' home directories must be accessible from the compute nodes where the RStudio Server instances will run.

## Installation

1.  **Clone the Repository:**

    ```bash
    git clone https://github.com/<your-username>/ood-rstudio-apptainer.git
    cd ood-rstudio-apptainer
    ```

2.  **Copy the App to the OOD Apps Directory:**

    Copy the `rstudio-apptainer` directory to the appropriate OOD apps directory. Consult your OOD administrator for the correct location. This is typically located at `/var/www/ood/apps/sys/` for system apps or `~/ood/apps/dev/` for development apps.

    ```bash
    sudo cp -r rstudio-apptainer /var/www/ood/apps/sys/
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
