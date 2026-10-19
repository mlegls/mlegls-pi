# Workspace

- `/workspace <path>` forks the conversation and switches this pi to that directory. Model requests (`workspace_request`) require `/workspace accept`.
- Under bb, bb owns the thread's directory: move a thread with `update_environment_directory`, and manage threads with `bb thread`.
