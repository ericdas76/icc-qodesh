module.exports = {
  apps: [
    {
      name: 'icc-qodesh',
      script: 'node',
      args: 'server.cjs',
      cwd: '/home/user/webapp',
      env: { NODE_ENV: 'production' },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
