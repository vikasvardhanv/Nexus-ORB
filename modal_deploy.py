# modal_deploy.py - Cloud Proxy for Nexus-ORB Core
import modal
import os
import subprocess

# Define the image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("curl", "libpq-dev", "build-essential")
    .pip_install(
        "fastapi",
        "uvicorn",
        "alpaca-py",
        "pybit",
        "pandas",
        "numpy",
        "python-dotenv",
        "requests"
    )
    # We mount the current project files into the cloud container
    .add_local_python_source("api", "execution")
)

app = modal.App("nexus-orb-trader")

@app.function(
    image=image,
    timeout=3600
)
@modal.web_server(8000)
def run_bridge_api():
    """
    Launches the FastAPI bridge in the cloud.
    Allows your React dashboard to connect and execute trades remotely.
    """
    from api import app as fastapi_app
    import uvicorn
    uvicorn.run(fastapi_app, host="0.0.0.0", port=8000)
