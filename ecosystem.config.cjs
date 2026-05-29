module.exports = {
  apps: [
    {
      name: 'icc-qodesh',
      script: 'npx',
      args: 'vite preview --host 0.0.0.0 --port 3000',
      cwd: '/home/user/webapp',
      env: { NODE_ENV: 'production', PORT: 3000 },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
