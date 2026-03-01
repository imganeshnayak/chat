module.exports = {
    apps: [
        {
            name: 'krovaa-api',
            script: 'server.js',
            instances: 'max',        // Use all CPU cores
            exec_mode: 'cluster',    // Fork one process per core
            watch: false,            // Never watch in production
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production',
            },
            // Auto-restart on crash, with exponential backoff
            restart_delay: 1000,
            max_restarts: 10,
            // Logging
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            out_file: './logs/out.log',
            error_file: './logs/error.log',
            merge_logs: true,
        },
    ],
};
