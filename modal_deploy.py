# modal_deploy.py - Cloud Proxy for Streamlit Backend
import modal
import os
import sys
import subprocess

# Define the image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("curl", "libpq-dev", "build-essential")
    .pip_install(
        "streamlit",
        "alpaca-py",
        "pandas",
        "numpy",
        "python-dotenv",
        "plotly",
        "requests"
    )
    .add_local_dir("/Users/vikashvardhan/IdeaProjects/ProjectNexusAI/orb_deploy", remote_path="/root/orb_deploy")
    .add_local_dir("/Users/vikashvardhan/IdeaProjects/ProjectNexusAI/execution", remote_path="/root/execution")
)

app = modal.App("nexus-orb-trader")

@app.function(
    image=image,
    timeout=3600
)
@modal.web_server(8501)
def run_streamlit():
    # Start streamlit in the background and let it run
    # Note: modal.web_server expects the process to keep running
    subprocess.Popen([
        "streamlit", "run", "/root/orb_deploy/app.py", 
        "--server.port=8501", 
        "--server.address=0.0.0.0",
        "--server.enableCORS=false",
        "--server.enableXsrfProtection=false"
    ])
