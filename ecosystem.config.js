module.exports = {
  apps: [
    {
      name: "kopipos-backend",
      script: "venv/bin/uvicorn",
      args: "app.main:app --host 127.0.0.1 --port 8000",
      cwd: "./backend",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "kopipos-frontend",
      script: "npm",
      args: "run preview -- --port 5173",
      cwd: "./frontend",
      env: {
        NODE_ENV: "production",
      }
    }
  ]
};
