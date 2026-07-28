#ifndef SENTINEL_EVENTS_H
#define SENTINEL_EVENTS_H

#define EVENT_EXECVE   1
#define EVENT_CONNECT  2
#define EVENT_ACCEPT   3
#define EVENT_OPENAT   4
#define EVENT_UNLINK   5
#define EVENT_RENAME   6
#define EVENT_SETUID   7

#define TASK_COMM_LEN  16
#define FILENAME_LEN   256

struct event {
    __u64 timestamp_ns;
    __u32 pid;
    __u32 tid;
    __u32 ppid;
    __u32 uid;
    char  comm[TASK_COMM_LEN];
    __u32 event_type;

    char   filename[FILENAME_LEN];
    __u32  dst_ip;
    __u16  dst_port;
    __u32  target_uid;
};

#endif
