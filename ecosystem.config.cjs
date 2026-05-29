module.exports = {
  apps: [
    {
      name: 'icc-qodesh',
      script: '/home/user/webapp/start.sh',
      cwd: '/home/user/webapp',
      env: { NODE_ENV: 'production' },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
